package httpx

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/mail"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// ErrorResponse matches the exact specification in docs/04-api-spec.md.
type ErrorResponse struct {
	Error   string            `json:"error"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

// UserClaims holds authenticated user information stored in request context.
type UserClaims struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

type contextKey string

const userContextKey = contextKey("user_claims")

// JSON writes a JSON response with status code and Content-Type header.
func JSON(w http.ResponseWriter, status int, v any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(v)
}

// JSONError writes a standard ErrorResponse with the specified HTTP status code.
func JSONError(w http.ResponseWriter, status int, errCode, message string, fields map[string]string) {
	resp := ErrorResponse{
		Error:   errCode,
		Message: message,
		Fields:  fields,
	}
	_ = JSON(w, status, resp)
}

// ValidationError writes a 422 validation_failed response with field-level errors.
func ValidationError(w http.ResponseWriter, fields map[string]string) {
	JSONError(w, http.StatusUnprocessableEntity, "validation_failed", "Fix the highlighted fields", fields)
}

// BadRequest writes a 400 bad_request response.
func BadRequest(w http.ResponseWriter, message string) {
	JSONError(w, http.StatusBadRequest, "bad_request", message, nil)
}

// MethodNotAllowed reports an unsupported method and tells clients what is accepted.
func MethodNotAllowed(w http.ResponseWriter, allowed string) {
	w.Header().Set("Allow", allowed)
	JSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed", nil)
}

// Unauthorized writes a 401 unauthenticated response.
func Unauthorized(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Authentication required"
	}
	JSONError(w, http.StatusUnauthorized, "unauthenticated", message, nil)
}

// Forbidden writes a 403 forbidden response.
func Forbidden(w http.ResponseWriter, message string) {
	if message == "" {
		message = "You do not have permission to perform this action"
	}
	JSONError(w, http.StatusForbidden, "forbidden", message, nil)
}

// NotFound writes a 404 not_found response.
func NotFound(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Resource not found"
	}
	JSONError(w, http.StatusNotFound, "not_found", message, nil)
}

// Conflict writes a 409 conflict or invalid_transition response.
func Conflict(w http.ResponseWriter, errCode, message string) {
	if errCode == "" {
		errCode = "conflict"
	}
	JSONError(w, http.StatusConflict, errCode, message, nil)
}

// Internal writes a 500 internal server error without leaking details.
func Internal(w http.ResponseWriter, err error) {
	log.Printf("[ERROR] internal: %v", err)
	JSONError(w, http.StatusInternalServerError, "internal", "An unexpected error occurred", nil)
}

// ParseJSON decodes request JSON into dst, enforcing a 1MB limit and rejecting unknown fields.
func ParseJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if r.Body == nil {
		BadRequest(w, "Request body is required")
		return false
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB limit
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var syntaxErr *json.SyntaxError
		var unmarshalTypeErr *json.UnmarshalTypeError
		switch {
		case errors.As(err, &syntaxErr):
			BadRequest(w, fmt.Sprintf("Malformed JSON at position %d", syntaxErr.Offset))
		case errors.As(err, &unmarshalTypeErr):
			ValidationError(w, map[string]string{
				unmarshalTypeErr.Field: fmt.Sprintf("Invalid type: expected %v", unmarshalTypeErr.Type),
			})
		case strings.HasPrefix(err.Error(), "json: unknown field "):
			fieldName := strings.TrimPrefix(err.Error(), "json: unknown field ")
			ValidationError(w, map[string]string{
				strings.Trim(fieldName, `"`): "Unknown field",
			})
		default:
			BadRequest(w, "Invalid JSON payload")
		}
		return false
	}

	if err := dec.Decode(&struct{}{}); err != io.EOF {
		BadRequest(w, "Request body must only contain a single JSON object")
		return false
	}

	return true
}

// FromPg maps Postgres errors to appropriate HTTP responses based on constraint maps.
func FromPg(w http.ResponseWriter, err error, constraintMap map[string]string) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			field, ok := constraintMap[pgErr.ConstraintName]
			if ok {
				ValidationError(w, map[string]string{
					field: fmt.Sprintf("%s is already registered", strings.Title(field)),
				})
				return true
			}
			Conflict(w, "conflict", "A record with this information already exists")
			return true
		case "23514": // check_violation
			ValidationError(w, map[string]string{
				"general": "Data violates validation rules",
			})
			return true
		case "23503": // foreign_key_violation
			Conflict(w, "conflict", "Referenced entity does not exist or cannot be modified")
			return true
		}
	}

	// Also check raw string matching if error was wrapped
	errStr := err.Error()
	if strings.Contains(errStr, "23505") || strings.Contains(errStr, "unique constraint") {
		for cName, field := range constraintMap {
			if strings.Contains(errStr, cName) {
				ValidationError(w, map[string]string{
					field: fmt.Sprintf("%s is already registered", strings.Title(field)),
				})
				return true
			}
		}
		Conflict(w, "conflict", "A record with this information already exists")
		return true
	}
	if strings.Contains(errStr, "23514") || strings.Contains(errStr, "check constraint") {
		ValidationError(w, map[string]string{"general": "Data violates validation constraint"})
		return true
	}

	Internal(w, err)
	return true
}

// Session store for cookie-based authentication
var (
	sessionsMu sync.RWMutex
	sessions   = make(map[string]session)
)

type session struct {
	claims    UserClaims
	expiresAt time.Time
}

// CreateSession generates a secure token, maps it to claims, and sets an httpOnly cookie.
func CreateSession(w http.ResponseWriter, claims UserClaims) string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)

	sessionsMu.Lock()
	sessions[token] = session{claims: claims, expiresAt: time.Now().Add(8 * time.Hour)}
	sessionsMu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   true,
		Expires:  time.Now().Add(8 * time.Hour),
	})

	return token
}

// ClearSession clears the session cookie and removes from memory.
func ClearSession(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session")
	if err == nil {
		sessionsMu.Lock()
		delete(sessions, cookie.Value)
		sessionsMu.Unlock()
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

// GetUserFromContext returns the UserClaims from the request context, if any.
func GetUserFromContext(ctx context.Context) (UserClaims, bool) {
	claims, ok := ctx.Value(userContextKey).(UserClaims)
	return claims, ok
}

// AuthMiddleware loads the session cookie or Authorization Bearer header into the request context.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var token string
		if cookie, err := r.Cookie("session"); err == nil {
			token = cookie.Value
		} else if authHdr := r.Header.Get("Authorization"); strings.HasPrefix(authHdr, "Bearer ") {
			token = strings.TrimPrefix(authHdr, "Bearer ")
		}

		if token != "" {
			sessionsMu.RLock()
			stored, found := sessions[token]
			sessionsMu.RUnlock()

			if found && time.Now().Before(stored.expiresAt) {
				ctx := context.WithValue(r.Context(), userContextKey, stored.claims)
				r = r.WithContext(ctx)
			} else if found {
				sessionsMu.Lock()
				delete(sessions, token)
				sessionsMu.Unlock()
			}
		}

		next.ServeHTTP(w, r)
	})
}

// RequireAuth middleware ensures the request has an authenticated session.
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := GetUserFromContext(r.Context()); !ok {
			Unauthorized(w, "Authentication required")
			return
		}
		next(w, r)
	}
}

// RequireRole ensures the authenticated user has one of the allowed roles.
func RequireRole(roles []string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := GetUserFromContext(r.Context())
		if !ok {
			Unauthorized(w, "Authentication required")
			return
		}
		allowed := false
		for _, role := range roles {
			if claims.Role == role {
				allowed = true
				break
			}
		}
		if !allowed {
			Forbidden(w, "Forbidden: insufficient permissions")
			return
		}
		next(w, r)
	}
}

// ParseKeysetPagination extracts limit and cursor from URL query params.
func ParseKeysetPagination(r *http.Request) (limit int, cursor int64) {
	q := r.URL.Query()
	limit = 25
	if l := q.Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			if parsed > 100 {
				limit = 100
			} else {
				limit = parsed
			}
		}
	}
	if c := q.Get("cursor"); c != "" {
		if parsed, err := strconv.ParseInt(c, 10, 64); err == nil {
			cursor = parsed
		}
	}
	return limit, cursor
}

// ParseKeysetPaginationValues validates pagination query parameters instead of silently
// treating malformed cursors as the first page.
func ParseKeysetPaginationValues(r *http.Request) (limit int, cursor int64, err error) {
	limit, cursor = 25, 0
	q := r.URL.Query()
	if value := q.Get("limit"); value != "" {
		parsed, parseErr := strconv.Atoi(value)
		if parseErr != nil || parsed < 1 || parsed > 100 {
			return 0, 0, fmt.Errorf("limit must be between 1 and 100")
		}
		limit = parsed
	}
	if value := q.Get("cursor"); value != "" {
		parsed, parseErr := strconv.ParseInt(value, 10, 64)
		if parseErr != nil || parsed < 1 {
			return 0, 0, fmt.Errorf("cursor must be a positive integer")
		}
		cursor = parsed
	}
	return limit, cursor, nil
}

// KeysetListResponse formats a standard keyset-paginated list output.
type KeysetListResponse[T any] struct {
	Items      []T     `json:"items"`
	NextCursor *string `json:"next_cursor"`
}

// NewKeysetList builds a KeysetListResponse with next_cursor detection.
func NewKeysetList[T any](items []T, limit int, getID func(item T) int64) KeysetListResponse[T] {
	if len(items) == 0 {
		return KeysetListResponse[T]{
			Items:      []T{},
			NextCursor: nil,
		}
	}

	if len(items) > limit {
		// We requested limit + 1
		resultItems := items[:limit]
		lastID := getID(resultItems[limit-1])
		cursorStr := strconv.FormatInt(lastID, 10)
		return KeysetListResponse[T]{
			Items:      resultItems,
			NextCursor: &cursorStr,
		}
	}

	return KeysetListResponse[T]{
		Items:      items,
		NextCursor: nil,
	}
}

// ValidEmail reports whether value is a single plain email address.
func ValidEmail(value string) bool {
	if value == "" || len(value) > 254 || strings.ContainsAny(value, "\r\n") {
		return false
	}
	parsed, err := mail.ParseAddress(value)
	return err == nil && parsed.Address == value
}

// CORS wraps an http.Handler with standard CORS headers.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowedOrigin := os.Getenv("APP_URL")
		if allowedOrigin == "" {
			allowedOrigin = "http://localhost:3000"
		}
		if origin != "" && origin == allowedOrigin {
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// RequestTimeout bounds handler work so a client cannot hold a request forever.
func RequestTimeout(next http.Handler) http.Handler {
	return http.TimeoutHandler(next, 10*time.Second, `{"error":"timeout","message":"Request timed out"}`)
}

// IdempotencyMiddleware prevents duplicate execution of state-changing operations.
func IdempotencyMiddleware(db *sql.DB, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("Idempotency-Key")
		if key == "" || r.Method == http.MethodGet {
			next(w, r)
			return
		}

		claims, ok := GetUserFromContext(r.Context())
		if !ok {
			next(w, r)
			return
		}

		var statusCode int
		var responseJSON []byte
		err := db.QueryRowContext(r.Context(),
			`SELECT status_code, response FROM idempotency_keys WHERE user_id = $1 AND key = $2`,
			claims.ID, key,
		).Scan(&statusCode, &responseJSON)

		if err == nil {
			// Found cached response!
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache-Lookup", "HIT")
			w.WriteHeader(statusCode)
			_, _ = w.Write(responseJSON)
			return
		}

		// Wrap response writer to capture output
		recorder := &responseRecorder{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}
		next(recorder, r)

		if recorder.statusCode < 500 {
			_, _ = db.ExecContext(r.Context(),
				`INSERT INTO idempotency_keys (key, user_id, endpoint, status_code, response)
				 VALUES ($1, $2, $3, $4, $5)
				 ON CONFLICT (user_id, key) DO NOTHING`,
				key, claims.ID, r.URL.Path, recorder.statusCode, []byte(recorder.body.String()),
			)
		}
	}
}

type responseRecorder struct {
	http.ResponseWriter
	statusCode int
	body       strings.Builder
}

func (r *responseRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}
