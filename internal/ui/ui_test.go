package ui

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeCaller struct{}

func (fakeCaller) Call(_ context.Context, action string, payload, out any) error {
	if action == "boom" {
		return context.DeadlineExceeded
	}
	b, _ := json.Marshal(map[string]any{"action": action, "ok": true})
	return json.Unmarshal(b, out)
}

func newTestServer(t *testing.T) *Server {
	t.Helper()
	s, err := New(fakeCaller{}, "secret-token")
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func apiPost(s *Server, token, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api", strings.NewReader(body))
	if token != "" {
		req.Header.Set("X-Lair-Token", token)
	}
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, req)
	return w
}

func TestStaticFiles(t *testing.T) {
	s := newTestServer(t)
	for _, path := range []string{"/", "/index.html", "/style.css", "/app.js", "/lair.svg"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("GET %s = %d, want 200", path, w.Code)
		}
		if w.Body.Len() == 0 {
			t.Errorf("GET %s returned empty body", path)
		}
	}
}

func TestStaticNotFound(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/does-not-exist.js", nil)
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("GET missing = %d, want 404", w.Code)
	}
}

func TestAPIAuth(t *testing.T) {
	s := newTestServer(t)
	body := `{"action":"status"}`
	if w := apiPost(s, "", body); w.Code != http.StatusUnauthorized {
		t.Errorf("no token = %d, want 401", w.Code)
	}
	if w := apiPost(s, "wrong", body); w.Code != http.StatusUnauthorized {
		t.Errorf("bad token = %d, want 401", w.Code)
	}
}

func TestAPICall(t *testing.T) {
	s := newTestServer(t)
	w := apiPost(s, "secret-token", `{"action":"status","payload":{}}`)
	if w.Code != http.StatusOK {
		t.Fatalf("valid call = %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		OK   bool `json:"ok"`
		Data struct {
			Action string `json:"action"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !resp.OK || resp.Data.Action != "status" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestAPIErrors(t *testing.T) {
	s := newTestServer(t)
	if w := apiPost(s, "secret-token", `not json`); w.Code != http.StatusBadRequest {
		t.Errorf("bad json = %d, want 400", w.Code)
	}
	if w := apiPost(s, "secret-token", `{}`); w.Code != http.StatusBadRequest {
		t.Errorf("missing action = %d, want 400", w.Code)
	}
	if w := apiPost(s, "secret-token", `{"action":"boom"}`); w.Code != http.StatusInternalServerError {
		t.Errorf("caller error = %d, want 500", w.Code)
	}
}

func TestAPIMethod(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api", nil)
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET /api = %d, want 405", w.Code)
	}
}

func TestQueryTokenFallback(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api?token=secret-token", strings.NewReader(`{"action":"status"}`))
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("query token = %d: %s", w.Code, w.Body.String())
	}
}
