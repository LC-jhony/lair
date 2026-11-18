package daemon

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/lair-sh/lair/internal/app"
)

func freePort(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	return port
}

func TestRuntimeServesUI(t *testing.T) {
	root := t.TempDir()
	t.Setenv(app.EnvHome, root)
	paths, err := app.Resolve()
	if err != nil {
		t.Fatal(err)
	}
	cfg := Defaults(paths, nil)
	cfg.EnableDNS = false
	cfg.EnableWeb = false
	cfg.EnableAPI = false
	cfg.EnableUI = true
	cfg.UIPort = freePort(t)

	rt, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if rt.web.Router != rt.Engine.Web.Router {
		t.Fatal("web router is not shared with the engine")
	}

	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() { errCh <- rt.Run(ctx) }()

	urlPath := filepath.Join(paths.Run, "ui.url")
	tokenPath := filepath.Join(paths.Run, "ui.token")
	var url string
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if b, err := os.ReadFile(urlPath); err == nil && strings.TrimSpace(string(b)) != "" {
			url = strings.TrimSpace(string(b))
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if url == "" {
		cancel()
		t.Fatalf("ui.url was not written: %v", <-errCh)
	}
	if !strings.Contains(url, "#token=") {
		t.Fatalf("url has no token fragment: %s", url)
	}
	tok, err := os.ReadFile(tokenPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(url, strings.TrimSpace(string(tok))) {
		t.Fatal("url token does not match ui.token")
	}
	info, err := os.Stat(tokenPath)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("ui.token mode = %v, %v", info, err)
	}

	base := strings.SplitN(url, "#", 2)[0]
	resp, err := http.Get(base)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK || !strings.Contains(string(body), "Lair") {
		t.Fatalf("GET / = %d: %s", resp.StatusCode, body)
	}

	req, _ := http.NewRequest(http.MethodPost, base+"api", strings.NewReader(`{"action":"status"}`))
	req.Header.Set("X-Lair-Token", strings.TrimSpace(string(tok)))
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("POST /api = %d: %s", resp.StatusCode, body)
	}
	var env struct {
		OK   bool `json:"ok"`
		Data struct {
			Home string `json:"home"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &env); err != nil {
		t.Fatal(err)
	}
	if !env.OK || env.Data.Home != root {
		t.Fatalf("unexpected status payload: %s", body)
	}

	cancel()
	select {
	case err := <-errCh:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("runtime did not stop")
	}
	if _, err := os.Stat(urlPath); !os.IsNotExist(err) {
		t.Fatalf("ui.url not removed on shutdown: %v", err)
	}
}
