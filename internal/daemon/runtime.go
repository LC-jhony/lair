// Package daemon's Runtime wires together the local API, the DNS server, the
// embedded web server and the service supervisors. It is the long-running
// process started by `lair daemon --foreground` (or the systemd unit).
package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/lair-sh/lair/internal/app"
	"github.com/lair-sh/lair/internal/dns"
	"github.com/lair-sh/lair/internal/engine"
	"github.com/lair-sh/lair/internal/manifest"
	"github.com/lair-sh/lair/internal/services"
	"github.com/lair-sh/lair/internal/ui"
	"github.com/lair-sh/lair/internal/web"
)

// RuntimeConfig configures a daemon Runtime.
type RuntimeConfig struct {
	Paths     app.Paths
	Catalog   *manifest.Catalog
	Domain    string
	DNSPort   int
	HTTPPort  int
	HTTPSPort int
	UIPort    int
	EnableDNS bool
	EnableWeb bool
	EnableAPI bool
	EnableUI  bool
}

// Runtime owns all long-lived daemon components.
type Runtime struct {
	cfg     RuntimeConfig
	Engine  *engine.Engine
	api     *Server
	dns     *dns.Server
	web     *web.Server
	ui      *ui.Server
	token   string
	uiToken string
	uiURL   string
	sock    string

	stopOnce sync.Once
	stop     context.CancelFunc
}

// Defaults returns a RuntimeConfig with production defaults.
func Defaults(paths app.Paths, catalog *manifest.Catalog) RuntimeConfig {
	return RuntimeConfig{
		Paths: paths, Catalog: catalog, Domain: "test",
		DNSPort: dns.DefaultPort, HTTPPort: 80, HTTPSPort: 443,
		UIPort:    9797,
		EnableDNS: true, EnableWeb: true, EnableAPI: true, EnableUI: true,
	}
}

// New builds the runtime. No sockets are opened until Run is called.
func New(cfg RuntimeConfig) (*Runtime, error) {
	if cfg.Domain == "" {
		cfg.Domain = "test"
	}
	if cfg.DNSPort == 0 {
		cfg.DNSPort = dns.DefaultPort
	}
	if cfg.HTTPPort == 0 {
		cfg.HTTPPort = 80
	}
	if cfg.HTTPSPort == 0 {
		cfg.HTTPSPort = 443
	}
	if cfg.UIPort == 0 {
		cfg.UIPort = 9797
	}
	if err := cfg.Paths.Ensure(); err != nil {
		return nil, err
	}
	eng, err := engine.New(cfg.Paths, cfg.Catalog)
	if err != nil {
		return nil, err
	}
	r := &Runtime{cfg: cfg, Engine: eng}
	r.web = web.NewServer(cfg.Paths.Certs, cfg.Domain)
	r.web.HTTPPort = cfg.HTTPPort
	r.web.HTTPSPort = cfg.HTTPSPort
	// The engine registers sites on its own router; the listener must use the
	// very same router, otherwise parked sites would return 404 forever.
	r.web.Router = eng.Web.Router
	r.dns = dns.NewServer(cfg.Domain, cfg.DNSPort)
	r.sock, err = cfg.Paths.SocketPath("api")
	if err != nil {
		return nil, err
	}
	return r, nil
}

// Socket and Token return the API connection details for the CLI.
func (r *Runtime) Socket() string { return r.sock }
func (r *Runtime) Token() string  { return r.token }

// UIURL returns the loopback URL (including the token) that opens the admin
// interface. It is available once Run has started the UI server.
func (r *Runtime) UIURL() string { return r.uiURL }

// UIToken returns the token used by the UI bridge.
func (r *Runtime) UIToken() string { return r.uiToken }

// Run starts every enabled component and blocks until ctx is cancelled, a
// shutdown signal arrives, or a fatal component error occurs.
func (r *Runtime) Run(ctx context.Context) error {
	runCtx, cancel := context.WithCancel(ctx)
	r.stop = cancel
	defer cancel()

	// The catalog may have been started by the caller; starting it again is
	// safe (LoadFromCache is idempotent and the refresh loop honours ctx).
	if r.cfg.Catalog != nil {
		// A corrected build automatically replaces an installed yanked one.
		r.cfg.Catalog.Subscribe(func(*manifest.Manifest) {
			if err := r.Engine.ReplaceYanked(context.Background()); err != nil {
				fmt.Fprintf(os.Stderr, "lair: yanked-build replacement: %v\n", err)
			}
		})
		if err := r.cfg.Catalog.Start(runCtx); err != nil {
			return fmt.Errorf("start catalog: %w", err)
		}
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 4)

	// All local front-ends (unix API and embedded UI) share one dispatcher so
	// the browser and the CLI execute exactly the same set of actions.
	dispatcher := NewDispatcher(r.Engine, r.stop)
	dispatcher.Set(ActionRestart, func(context.Context, json.RawMessage) (any, error) {
		r.restartServices()
		return map[string]bool{"restarted": true}, nil
	})

	// DNS (unprivileged UDP on loopback).
	if r.cfg.EnableDNS {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := r.dns.ListenAndServe(runCtx); err != nil {
				errCh <- fmt.Errorf("dns: %w", err)
			}
		}()
	}

	// Web (80/443 on loopback), with conflict detection before binding. A
	// binding failure is non-fatal: DNS, the API and the UI stay up.
	if r.cfg.EnableWeb {
		if conflicts, _ := web.PortsInUse(); len(conflicts) > 0 {
			for _, c := range conflicts {
				fmt.Fprintf(os.Stderr, "lair: warning: %s\n", c.String())
			}
		} else if err := r.web.Start(); err != nil {
			fmt.Fprintf(os.Stderr, "lair: warning: web server: %v\n", err)
		} else {
			go func() {
				<-runCtx.Done()
				shutdownCtx, sCancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer sCancel()
				_ = r.web.Shutdown(shutdownCtx)
			}()
		}
	}

	// Local API over a token-protected unix socket.
	if r.cfg.EnableAPI {
		tok, err := NewToken()
		if err != nil {
			return err
		}
		r.token = tok
		if err := WriteToken(filepath.Join(r.cfg.Paths.Run, "api.token"), tok); err != nil {
			return fmt.Errorf("write api token: %w", err)
		}
		r.api = NewServer(r.sock, tok)
		Register(r.api, dispatcher)
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := r.api.Serve(runCtx); err != nil {
				errCh <- fmt.Errorf("api: %w", err)
			}
		}()
	}

	// Embedded administration UI on loopback. A dedicated token is written to
	// run/ui.token (0600) and the ready-to-open URL to run/ui.url (0600).
	if r.cfg.EnableUI {
		tok, err := NewToken()
		if err != nil {
			return err
		}
		r.uiToken = tok
		srv, err := ui.New(dispatcher, tok)
		if err != nil {
			return fmt.Errorf("ui: %w", err)
		}
		r.ui = srv
		tokenPath := filepath.Join(r.cfg.Paths.Run, "ui.token")
		urlPath := filepath.Join(r.cfg.Paths.Run, "ui.url")
		if err := WriteToken(tokenPath, tok); err != nil {
			return fmt.Errorf("write ui token: %w", err)
		}
		r.uiURL = fmt.Sprintf("http://127.0.0.1:%d/#token=%s", r.cfg.UIPort, tok)
		if err := os.WriteFile(urlPath, []byte(r.uiURL+"\n"), 0o600); err != nil {
			return fmt.Errorf("write ui url: %w", err)
		}
		_ = os.Chmod(urlPath, 0o600)
		wg.Add(1)
		go func() {
			defer wg.Done()
			addr := fmt.Sprintf("127.0.0.1:%d", r.cfg.UIPort)
			if err := r.ui.ListenAndServe(runCtx, addr); err != nil {
				fmt.Fprintf(os.Stderr, "lair: warning: ui server: %v\n", err)
			}
		}()
	}

	// Bring up all configured services under the supervisor.
	r.startConfiguredServices()

	// OS signals stop the daemon cleanly.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)
	defer signal.Stop(sigCh)

	var runErr error
	select {
	case <-runCtx.Done():
	case sig := <-sigCh:
		fmt.Fprintf(os.Stderr, "lair: received %s, shutting down\n", sig)
		cancel()
	case runErr = <-errCh:
		cancel()
	}

	// Stop supervised services before releasing other resources.
	r.Engine.Supervisors.StopAll()
	cancel()
	wg.Wait()
	_ = os.Remove(filepath.Join(r.cfg.Paths.Run, "api.token"))
	_ = os.Remove(filepath.Join(r.cfg.Paths.Run, "ui.token"))
	_ = os.Remove(filepath.Join(r.cfg.Paths.Run, "ui.url"))
	return runErr
}

// startConfiguredServices starts supervisors for services that have an active
// version and an installed build. Failures are non-fatal: a bad service should
// not prevent the environment from coming up.
func (r *Runtime) startConfiguredServices() {
	c, err := r.Engine.Config.View()
	if err != nil {
		return
	}
	for _, id := range services.IDs() {
		ver := c.Defaults[id]
		if ver == "" {
			continue
		}
		if err := r.Engine.StartService(id); err != nil {
			fmt.Fprintf(os.Stderr, "lair: skipping service %s: %v\n", id, err)
		}
	}
}

// restartServices reloads specs and restarts every configured supervisor.
func (r *Runtime) restartServices() {
	c, err := r.Engine.Config.View()
	if err != nil {
		return
	}
	for _, id := range services.IDs() {
		if c.Defaults[id] == "" {
			continue
		}
		if err := r.Engine.RestartService(id); err != nil {
			fmt.Fprintf(os.Stderr, "lair: restart %s: %v\n", id, err)
		}
	}
}

// Shutdown requests a clean stop from outside Run (used by tests).
func (r *Runtime) Shutdown() {
	if r.stop != nil {
		r.stopOnce.Do(r.stop)
	}
}
