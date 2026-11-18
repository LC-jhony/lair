// Package ui serves Lair's embedded single-page administration interface on
// loopback. It reuses the daemon Caller so every control in the browser goes
// through the exact same actions and token as the CLI.
package ui

import (
	"context"
	"crypto/subtle"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"strings"
	"time"
)

//go:embed static/*
var staticFS embed.FS

// Caller mirrors daemon.Caller without importing daemon (which would create
// an import cycle: daemon starts the UI server).
type Caller interface {
	Call(ctx context.Context, action string, payload, out any) error
}

// Server serves the SPA and the JSON bridge to the daemon dispatcher.
type Server struct {
	caller Caller
	token  string
	files  fs.FS
	server *http.Server
}

type apiRequest struct {
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type apiResponse struct {
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

// New builds the UI server. token must be non-empty: every API call is
// authenticated with it (constant-time comparison).
func New(caller Caller, token string) (*Server, error) {
	if caller == nil {
		return nil, fmt.Errorf("ui: nil caller")
	}
	if token == "" {
		return nil, fmt.Errorf("ui: empty token")
	}
	files, err := fs.Sub(staticFS, "static")
	if err != nil {
		return nil, err
	}
	return &Server{caller: caller, token: token, files: files}, nil
}

// Handler returns the root http.Handler (SPA + /api bridge).
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api", s.handleAPI)
	mux.HandleFunc("/", s.handleStatic)
	return mux
}

func (s *Server) handleAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, apiResponse{Error: "method not allowed"})
		return
	}
	token := r.Header.Get("X-Lair-Token")
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if subtle.ConstantTimeCompare([]byte(token), []byte(s.token)) != 1 {
		writeJSON(w, http.StatusUnauthorized, apiResponse{Error: "invalid token"})
		return
	}

	var req apiRequest
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiResponse{Error: "invalid request: " + err.Error()})
		return
	}
	if req.Action == "" {
		writeJSON(w, http.StatusBadRequest, apiResponse{Error: "missing action"})
		return
	}

	var out any
	if err := s.caller.Call(r.Context(), req.Action, req.Payload, &out); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiResponse{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, apiResponse{OK: true, Data: out})
}

func (s *Server) handleStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" {
		path = "index.html"
	}
	// No directory listing: only known files are served.
	if strings.HasSuffix(path, "/") {
		path += "index.html"
	}
	data, err := fs.ReadFile(s.files, path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	switch {
	case strings.HasSuffix(path, ".html"):
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	case strings.HasSuffix(path, ".css"):
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case strings.HasSuffix(path, ".js"):
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	case strings.HasSuffix(path, ".svg"):
		w.Header().Set("Content-Type", "image/svg+xml")
	}
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(data)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// ListenAndServe serves on addr until ctx is cancelled, then shuts down
// gracefully. It never binds outside loopback (the caller supplies 127.0.0.1).
func (s *Server) ListenAndServe(ctx context.Context, addr string) error {
	s.server = &http.Server{
		Addr:              addr,
		Handler:           s.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		err := s.server.ListenAndServe()
		if err != nil && err != http.ErrServerClosed {
			errCh <- err
			return
		}
		errCh <- nil
	}()
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return s.server.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}
