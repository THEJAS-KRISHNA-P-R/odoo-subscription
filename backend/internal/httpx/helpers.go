package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

// ErrorResponse is the consistent error shape the API returns
type ErrorResponse struct {
	Error   string            `json:"error"`
	Fields  map[string]string `json:"fields,omitempty"`
}

// Error400 returns a 400 Bad Request response
func Error400(field, message string) *http.Response {
	return Response(http.StatusBadRequest, "validation_failed", map[string]string{field: message})
}

// Error404 returns a 404 Not Found response
func Error404(msg string) *http.Response {
	return Response(http.StatusNotFound, "not_found", map[string]string{"general": msg})
}

// Error409 returns a 409 Conflict response
func Error409(msg string) *http.Response {
	return Response(http.StatusConflict, "conflict", map[string]string{"general": msg})
}

// Error500 returns a 500 Internal Server Error response
func Error500(msg string) *http.Response {
	return Response(http.StatusInternalServerError, "server_error", map[string]string{"general": msg})
}

// JSON writes a JSON response with the given status code
func JSON(w http.ResponseWriter, status int, v any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(v)
}

// JSONError writes an error JSON response
func JSONError(w http.ResponseWriter, status int, err *ErrorResponse) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(err)
}

// Response creates a standard HTTP response
func Response(status int, errorType string, fields map[string]string) *http.Response {
	resp := &ErrorResponse{
		Error:   errorType,
		Fields:  fields,
	}
	var buf []byte
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.Encode(resp)
	return &http.Response{
		Status:     http.StatusText(status),
		StatusCode: status,
		Body:       buf,
	}
}

// SuccessResponse creates a success JSON response
func SuccessResponse(w http.ResponseWriter, status int, v any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    v,
	})
}

// ParseJSONBody reads and parses the JSON body of an HTTP request
func ParseJSONBody(w http.ResponseWriter, r *http.Request, v any) error {
	if r.Body == nil {
		return errors.New("nil body")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// Write400 writes a 400 error and returns it
func Write400(w http.ResponseWriter, field, message string) error {
	return JSONError(w, http.StatusBadRequest, &ErrorResponse{
		Error:   "validation_failed",
		Fields:  map[string]string{field: message},
	})
}

// Write404 writes a 404 error and returns it
func Write404(w http.ResponseWriter, message string) error {
	return JSONError(w, http.StatusNotFound, &ErrorResponse{
		Error:   "not_found",
		Fields:  map[string]string{"general": message},
	})
}