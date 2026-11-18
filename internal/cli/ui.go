package cli

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/lair-sh/lair/internal/app"
	"github.com/lair-sh/lair/internal/daemon"
)

// runUI opens the embedded administration interface. If the daemon is not
// running yet it is started detached; the URL (with its one-time token) is
// read from run/ui.url, a 0600 file inside the protected run directory.
func runUI(args []string, out, errOut io.Writer) error {
	for _, a := range args {
		if isHelp(a) {
			fmt.Fprintln(out, "usage: lair ui   Abre el panel de administración en el navegador")
			return nil
		}
	}
	paths, err := app.Resolve()
	if err != nil {
		return err
	}
	if err := paths.Ensure(); err != nil {
		return err
	}
	sock, err := paths.SocketPath("api")
	if err != nil {
		return err
	}
	urlPath := filepath.Join(paths.Run, "ui.url")

	if daemon.Available(sock) {
		url, err := readURL(urlPath)
		if err == nil && url != "" {
			return openUI(url, out, errOut)
		}
		return fmt.Errorf("el daemon está activo pero la interfaz web no está disponible; reinícialo con `lair daemon --foreground --ui-port 9797`")
	}

	// No daemon: start it in the background and wait for the UI to bind.
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	logPath := filepath.Join(paths.Log, "daemon-ui.log")
	log, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer log.Close()

	cmd := exec.Command(exe, "daemon", "--foreground")
	cmd.Stdout = log
	cmd.Stderr = log
	cmd.Dir = paths.Root
	cmd.Env = os.Environ()
	cmd.SysProcAttr = detachAttr()
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("no se pudo iniciar el daemon: %w", err)
	}

	url := ""
	for i := 0; i < 100; i++ { // up to 10 seconds
		if daemon.Available(sock) {
			if u, err := readURL(urlPath); err == nil && u != "" {
				url = u
				break
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	if url == "" {
		return fmt.Errorf("el daemon no publicó la interfaz web; revisa %s", logPath)
	}
	return openUI(url, out, errOut)
}

func readURL(path string) (string, error) {
	b, err := os.ReadFile(path)
	return strings.TrimSpace(string(b)), err
}

func openUI(url string, out, errOut io.Writer) error {
	fmt.Fprintf(out, "Lair UI: %s\n", url)
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		fmt.Fprintf(errOut, "lair: no se pudo abrir el navegador automáticamente: %v\n", err)
		return nil // the URL was already printed so the user can open it manually
	}
	return nil
}
