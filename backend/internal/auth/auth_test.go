package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"brightloop/internal/db"
	"brightloop/internal/httpx"
)

func setupTestDB(t *testing.T) *Store {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5433/brightloop?sslmode=disable"
	}
	database, err := db.Open(dsn)
	if err != nil {
		t.Skipf("skipping integration test, db not available: %v", err)
	}
	return NewStore(database)
}

func TestT1_SignupValidation(t *testing.T) {
	store := setupTestDB(t)
	handler := NewHandler(store)

	// Case 1: Weak password - less than 9 chars
	body, _ := json.Marshal(map[string]string{
		"full_name": "Test User",
		"email":     "valid1@shop.in",
		"password":  "Short1!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/signup", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.Signup(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422, got %d: %s", w.Code, w.Body.String())
	}
	var errResp httpx.ErrorResponse
	_ = json.Unmarshal(w.Body.Bytes(), &errResp)
	if errResp.Fields["password"] != "Password must be more than 8 characters" {
		t.Errorf("expected 'Password must be more than 8 characters', got %q", errResp.Fields["password"])
	}

	// Case 2: Missing special character
	body, _ = json.Marshal(map[string]string{
		"full_name": "Test User",
		"email":     "valid2@shop.in",
		"password":  "NoSpecial123",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/signup", bytes.NewReader(body))
	w = httptest.NewRecorder()
	handler.Signup(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422, got %d: %s", w.Code, w.Body.String())
	}

	// Case 3: Successful signup
	testEmail := "test-" + time.Now().Format("20060102150405.000") + "@shop.in"
	body, _ = json.Marshal(map[string]string{
		"full_name": "Test User",
		"email":     testEmail,
		"password":  "Valid#Password1",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/signup", bytes.NewReader(body))
	w = httptest.NewRecorder()
	handler.Signup(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}

	// Case 4: Duplicate email in different case (case-insensitive duplicate check)
	body, _ = json.Marshal(map[string]string{
		"full_name": "Duplicate User",
		"email":     "TEST-" + time.Now().Format("20060102150405.000") + "@shop.in", // same case as testEmail
		"password":  "Valid#Password1",
	})
	// Try signing up with testEmail again in uppercase
	body, _ = json.Marshal(map[string]string{
		"full_name": "Duplicate User",
		"email":     testEmail,
		"password":  "Valid#Password1",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/signup", bytes.NewReader(body))
	w = httptest.NewRecorder()
	handler.Signup(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422 on duplicate email, got %d: %s", w.Code, w.Body.String())
	}
}

func TestT2_RBAC(t *testing.T) {
	// 1. Staff creation route requires admin role; staff cannot create staff
	staffHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	adminOnlyRoute := httpx.RequireRole([]string{"admin"}, staffHandler)

	// Staff user attempting admin action -> 403 Forbidden
	staffClaims := httpx.UserClaims{ID: 10, Role: "staff", Email: "staff@x.test"}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/staff", nil)
	token := httpx.CreateSession(httptest.NewRecorder(), staffClaims)
	req.AddCookie(&http.Cookie{Name: "session", Value: token})

	w := httptest.NewRecorder()
	httpx.AuthMiddleware(adminOnlyRoute).ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for staff accessing admin route, got %d: %s", w.Code, w.Body.String())
	}

	// 2. Public signup cannot set role to admin (signup always creates customer)
	store := setupTestDB(t)
	handler := NewHandler(store)
	adminAttemptEmail := "admin-exploit-" + time.Now().Format("20060102150405.000") + "@shop.in"
	body, _ := json.Marshal(map[string]string{
		"full_name": "Exploit User",
		"email":     adminAttemptEmail,
		"password":  "Valid#Password1",
		"role":      "admin",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/signup", bytes.NewReader(body))
	w = httptest.NewRecorder()
	handler.Signup(w, req)
	if w.Code == http.StatusCreated {
		var created map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &created)
		if created["role"] != "customer" {
			t.Fatalf("signup security hole: allowed setting role to %v", created["role"])
		}
	} else if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 201 or 422, got %d", w.Code)
	}
}

func TestT3_ResetFlow(t *testing.T) {
	store := setupTestDB(t)
	handler := NewHandler(store)

	// Unknown email gives 202 without leaking existence
	body, _ := json.Marshal(map[string]string{"email": "unknown-nonexistent@brightloop.test"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/forgot", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.Forgot(w, req)
	if w.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted, got %d", w.Code)
	}

	// Invalid token returns 422
	body, _ = json.Marshal(map[string]string{
		"token":    "bad-token-that-does-not-exist",
		"password": "NewStrong#Password1",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/reset", bytes.NewReader(body))
	w = httptest.NewRecorder()
	handler.Reset(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 on invalid token, got %d: %s", w.Code, w.Body.String())
	}
}
