package engine

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/lair-sh/lair/internal/config"
	"github.com/lair-sh/lair/internal/pki"
	"github.com/lair-sh/lair/internal/shims"
)

// Park registers the current directory as a *.test site named after it.
func (e *Engine) Park(projectPath string) (string, error) {
	abs, err := filepath.Abs(projectPath)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil || !info.IsDir() {
		return "", fmt.Errorf("not a directory: %s", abs)
	}
	name := strings.ToLower(filepath.Base(abs)) + ".test"
	if err := e.Link(name, abs); err != nil {
		return "", err
	}
	return name, nil
}

// Link registers a site with an explicit host name.
func (e *Engine) Link(name, projectPath string) error {
	name = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(name), "."))
	if name == "" || !strings.Contains(name, ".") || strings.ContainsAny(name, "/\\ ") {
		return fmt.Errorf("invalid site name %q", name)
	}
	abs, err := filepath.Abs(projectPath)
	if err != nil {
		return err
	}
	if info, err := os.Stat(abs); err != nil || !info.IsDir() {
		return fmt.Errorf("not a directory: %s", abs)
	}
	if err := e.Config.Update(func(c *config.Config) error {
		s := c.Sites[name]
		s.Path = abs
		c.Sites[name] = s
		return nil
	}); err != nil {
		return err
	}
	e.reloadSites()
	return nil
}

// Unlink removes a parked site from routing (project files are untouched).
func (e *Engine) Unlink(name string) error {
	name = strings.ToLower(strings.TrimSuffix(name, "."))
	if err := e.Config.Update(func(c *config.Config) error {
		delete(c.Sites, name)
		return nil
	}); err != nil {
		return err
	}
	e.Web.Router.Remove(name)
	return nil
}

// Secure ensures the local CA exists and issues a certificate for the site.
// The CA still needs to be trusted via the one-time privileged setup.
func (e *Engine) Secure(name string) error {
	name = strings.ToLower(strings.TrimSuffix(name, "."))
	if _, _, err := pki.EnsureCA(e.Paths.Certs); err != nil {
		return err
	}
	sans := []string{name}
	labels := strings.Split(name, ".")
	if len(labels) >= 3 {
		base := strings.Join(labels[1:], ".")
		sans = append(sans, base, "*."+base)
	} else {
		sans = append(sans, "*."+name)
	}
	_, _, err := pki.IssueSite(e.Paths.Certs, name, sans...)
	return err
}

// Pin writes a php= or node= key into the project's versionable .lairrc. If a
// legacy .flockrc exists, its contents are carried over so no pin is lost.
func (e *Engine) Pin(tool, value, projectDir string) error {
	if tool != "php" && tool != "node" {
		return fmt.Errorf("pin accepts only php or node")
	}
	path := filepath.Join(projectDir, ".lairrc")
	body, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		// Migrate existing projects without deleting the legacy file.
		body, err = os.ReadFile(filepath.Join(projectDir, ".flockrc"))
	}
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	lines := strings.Split(strings.TrimSuffix(string(body), "\n"), "\n")
	out := []string{}
	pfx := tool + "="
	for _, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), pfx) {
			continue
		}
		if line != "" {
			out = append(out, line)
		}
	}
	out = append(out, pfx+value)
	return os.WriteFile(path, []byte(strings.Join(out, "\n")+"\n"), 0o644)
}

// Isolate pins a version for a site in config.json (higher precedence than
// .lairrc). It is reversible with `lair isolate <tool> --off`.
func (e *Engine) Isolate(tool, value, projectDir string) error {
	if tool != "php" && tool != "node" {
		return fmt.Errorf("isolate accepts only php or node")
	}
	abs, err := filepath.Abs(projectDir)
	if err != nil {
		return err
	}
	return e.Config.Update(func(c *config.Config) error {
		for name, site := range c.Sites {
			if site.Path == abs {
				if tool == "php" {
					site.PHP = value
				} else {
					site.Node = value
				}
				c.Sites[name] = site
				return nil
			}
		}
		return fmt.Errorf("directory %s is not a parked site; run 'lair park' first", abs)
	})
}

// IsolatedVersion returns the site-specific pin for a directory, if any.
func (e *Engine) IsolatedVersion(tool, projectDir string) string {
	c, err := e.Config.View()
	if err != nil {
		return ""
	}
	abs, _ := filepath.Abs(projectDir)
	best := ""
	bestLen := -1
	for _, site := range c.Sites {
		if site.Path == "" || abs != site.Path && !strings.HasPrefix(abs, site.Path+string(os.PathSeparator)) {
			continue
		}
		var value string
		if tool == "php" {
			value = site.PHP
		} else {
			value = site.Node
		}
		if value != "" && len(site.Path) > bestLen {
			best, bestLen = value, len(site.Path)
		}
	}
	return best
}

// Uninstall removes every component Lair installed: shims and PATH snippets,
// PHP, Composer, Node, all service binaries, the local CA, daemon state and
// generated cache/log files. Service databases are preserved unless deleteData
// is set. The reversal scripts are deliberately kept by the CLI so the user can
// still remove the privileged system changes (unit, polkit, resolved, CA trust).
func (e *Engine) Uninstall(home, dataDir string, deleteData bool) error {
	e.Supervisors.StopAll()
	_ = shims.RemoveProfiles(home)

	if deleteData {
		return os.RemoveAll(dataDir)
	}

	// All runtimes and tools managed by Lair.
	for _, dir := range []string{
		e.Paths.Bin,
		e.Paths.Tools,
		e.Paths.PHP,
		e.Paths.Node,
		e.Paths.Cache,
		e.Paths.Certs,
		e.Paths.Run,
		e.Paths.Log,
	} {
		_ = os.RemoveAll(dir)
	}
	_ = os.RemoveAll(e.Paths.ConfigFile)

	// Remove every installed service version (MariaDB, PostgreSQL, Redis, ...)
	// but keep services/<id>/data so a later install can reuse the databases.
	serviceRoot := e.Paths.Services
	entries, _ := os.ReadDir(serviceRoot)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		idDir := filepath.Join(serviceRoot, entry.Name())
		sub, _ := os.ReadDir(idDir)
		for _, s := range sub {
			if s.IsDir() && s.Name() == "data" {
				continue
			}
			_ = os.RemoveAll(filepath.Join(idDir, s.Name()))
		}
	}

	// Older stacks could leave these under the data root. Lair itself never
	// installs system nginx/Laravel Valet/Mailcatcher, but clean up any legacy
	// directory found inside its own root.
	for _, name := range []string{"nginx", "valet", "laravel-valet", "mailcatcher", "mailpit"} {
		_ = os.RemoveAll(filepath.Join(dataDir, name))
	}
	return nil
}
