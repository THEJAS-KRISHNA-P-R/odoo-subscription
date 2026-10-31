package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"brightloop/internal/httpx"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

// SignupRequest payload
type SignupRequest struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Signup handles POST /api/v1/auth/signup
func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	var req SignupRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	fields := make(map[string]string)
	name := strings.TrimSpace(req.FullName)
	if name == "" {
		fields["full_name"] = "Name is required"
	} else if len([]rune(name)) > 120 {
		fields["full_name"] = "Too long"
	}

	email := strings.TrimSpace(req.Email)
	if email == "" {
		fields["email"] = "Enter a valid email"
	} else if !validEmail(email) {
		fields["email"] = "Enter a valid email"
	}

	if msg := ValidatePassword(req.Password); msg != "" {
		fields["password"] = msg
	}

	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}

	// Hash password with bcrypt cost 12
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	userID, customerID, err := h.store.CreateUserWithCustomer(r.Context(), email, string(hashed), name, "customer")
	if err != nil {
		httpx.FromPg(w, err, map[string]string{"users_email_key": "email"})
		return
	}

	claims := httpx.UserClaims{
		ID:       userID,
		Email:    email,
		FullName: name,
		Role:     "customer",
	}
	token := httpx.CreateSession(w, claims)

	_ = httpx.JSON(w, http.StatusCreated, map[string]any{
		"id":          userID,
		"email":       email,
		"full_name":   name,
		"role":        "customer",
		"customer_id": customerID,
		"token":       token,
	})
}

// LoginRequest payload
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login handles POST /api/v1/auth/login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	email := strings.TrimSpace(req.Email)
	if email == "" || req.Password == "" {
		httpx.ValidationError(w, map[string]string{
			"email": "Invalid email or password",
		})
		return
	}

	user, err := h.store.GetUserByEmail(r.Context(), email)
	if err != nil {
		httpx.ValidationError(w, map[string]string{
			"email": "Invalid email or password",
		})
		return
	}

	if !user.IsActive {
		httpx.Forbidden(w, "Account is deactivated")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		httpx.ValidationError(w, map[string]string{
			"email": "Invalid email or password",
		})
		return
	}

	claims := httpx.UserClaims{
		ID:       user.ID,
		Email:    user.Email,
		FullName: user.FullName,
		Role:     user.Role,
	}
	token := httpx.CreateSession(w, claims)

	custID, _ := h.store.GetCustomerIDForUser(r.Context(), user.ID)

	_ = httpx.JSON(w, http.StatusOK, map[string]any{
		"token": token,
		"role":  user.Role,
		"user": map[string]any{
			"id":          user.ID,
			"email":       user.Email,
			"full_name":   user.FullName,
			"role":        user.Role,
			"customer_id": custID,
		},
	})
}

// Logout handles POST /api/v1/auth/logout
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	httpx.ClearSession(w, r)
	_ = httpx.JSON(w, http.StatusOK, map[string]string{"message": "Logged out"})
}

// Me handles GET /api/v1/auth/me
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := httpx.GetUserFromContext(r.Context())
	if !ok {
		httpx.Unauthorized(w, "Not logged in")
		return
	}

	user, err := h.store.GetUserByID(r.Context(), claims.ID)
	if err != nil {
		httpx.NotFound(w, "User not found")
		return
	}

	custID, _ := h.store.GetCustomerIDForUser(r.Context(), user.ID)

	_ = httpx.JSON(w, http.StatusOK, map[string]any{
		"id":          user.ID,
		"email":       user.Email,
		"full_name":   user.FullName,
		"role":        user.Role,
		"customer_id": custID,
	})
}

// ForgotRequest payload
type ForgotRequest struct {
	Email string `json:"email"`
}

// Forgot handles POST /api/v1/auth/forgot
func (h *Handler) Forgot(w http.ResponseWriter, r *http.Request) {
	var req ForgotRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	email := strings.TrimSpace(req.Email)
	user, err := h.store.GetUserByEmail(r.Context(), email)
	if err == nil && user.IsActive {
		// Generate random 32-byte token
		rawBytes := make([]byte, 32)
		_, _ = rand.Read(rawBytes)
		rawToken := hex.EncodeToString(rawBytes)

		// Compute sha256 hash
		hash := sha256.Sum256([]byte(rawToken))
		tokenHash := hex.EncodeToString(hash[:])
		expiresAt := time.Now().Add(30 * time.Minute)

		subject := "Reset your Brightloop password"
		body := fmt.Sprintf("Use this token to reset your password within 30 minutes: %s", rawToken)

		_ = h.store.CreatePasswordReset(r.Context(), user.ID, tokenHash, expiresAt, user.Email, subject, body)
	}

	// Always return 202 to avoid leaking user existence
	_ = httpx.JSON(w, http.StatusAccepted, map[string]string{
		"message": "If the email is registered, a password reset link has been queued.",
	})
}

// ResetRequest payload
type ResetRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// Reset handles POST /api/v1/auth/reset
func (h *Handler) Reset(w http.ResponseWriter, r *http.Request) {
	var req ResetRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	fields := make(map[string]string)
	if strings.TrimSpace(req.Token) == "" {
		fields["token"] = "Reset token is required"
	}
	if msg := ValidatePassword(req.Password); msg != "" {
		fields["password"] = msg
	}
	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}

	// Hash the raw token with sha256 to lookup in db
	tokenHashBytes := sha256.Sum256([]byte(strings.TrimSpace(req.Token)))
	tokenHash := hex.EncodeToString(tokenHashBytes[:])

	// Hash the new password with bcrypt
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	err = h.store.ResetPassword(r.Context(), tokenHash, string(hashed))
	if err != nil {
		httpx.ValidationError(w, map[string]string{
			"token": "Invalid or expired reset token",
		})
		return
	}

	_ = httpx.JSON(w, http.StatusOK, map[string]string{
		"message": "Password updated successfully",
	})
}

// Meta handles GET /api/v1/meta
func (h *Handler) Meta(w http.ResponseWriter, r *http.Request) {
	var meData any = nil
	if claims, ok := httpx.GetUserFromContext(r.Context()); ok {
		var caps []string
		switch claims.Role {
		case "admin":
			caps = []string{"billing.run", "payment.record", "catalog.write", "discounts.write", "discount.write", "staff.write", "subscriptions.write", "invoices.write"}
		case "staff":
			caps = []string{"billing.run", "payment.record", "subscriptions.write", "invoices.write"}
		case "customer":
			caps = []string{"subscriptions.manage"}
		}
		meData = map[string]any{
			"id":           claims.ID,
			"email":        claims.Email,
			"full_name":    claims.FullName,
			"role":         claims.Role,
			"capabilities": caps,
		}
	}

	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
	_ = httpx.JSON(w, http.StatusOK, map[string]any{
		"enums": map[string]any{
			"billing_period": []map[string]string{
				{"value": "daily", "label": "Daily"},
				{"value": "weekly", "label": "Weekly"},
				{"value": "monthly", "label": "Monthly"},
				{"value": "yearly", "label": "Yearly"},
			},
			"subscription_status": []map[string]string{
				{"value": "draft", "label": "Draft"},
				{"value": "quotation", "label": "Quotation"},
				{"value": "confirmed", "label": "Confirmed"},
				{"value": "active", "label": "Active"},
				{"value": "paused", "label": "Paused"},
				{"value": "closed", "label": "Closed"},
			},
			"invoice_status": []map[string]string{
				{"value": "draft", "label": "Draft"},
				{"value": "confirmed", "label": "Confirmed"},
				{"value": "paid", "label": "Paid"},
				{"value": "cancelled", "label": "Cancelled"},
			},
			"payment_method": []map[string]string{
				{"value": "cash", "label": "Cash"},
				{"value": "bank_transfer", "label": "Bank Transfer"},
				{"value": "card", "label": "Card"},
				{"value": "upi", "label": "UPI"},
				{"value": "cheque", "label": "Cheque"},
			},
			"discount_kind": []map[string]string{
				{"value": "fixed", "label": "Fixed Amount"},
				{"value": "percent", "label": "Percentage"},
			},
			"discount_scope": []map[string]string{
				{"value": "product", "label": "Product"},
				{"value": "subscription", "label": "Subscription"},
			},
			"product_type": []map[string]string{
				{"value": "software", "label": "Software"},
				{"value": "service", "label": "Service"},
				{"value": "addon", "label": "Addon"},
				{"value": "physical", "label": "Physical"},
			},
		},
		"subscription_transitions": map[string][]string{
			"draft":     {"quotation"},
			"quotation": {"confirmed"},
			"confirmed": {"active"},
			"active":    {"paused", "closed"},
			"paused":    {"active"},
			"closed":    {"active"},
		},
		"me": meData,
	})
}

// Staff handlers (Admin only)

func (h *Handler) ListStaff(w http.ResponseWriter, r *http.Request) {
	staff, err := h.store.ListStaff(r.Context())
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	if staff == nil {
		staff = []User{}
	}
	_ = httpx.JSON(w, http.StatusOK, map[string]any{"items": staff})
}

// Staff dispatches the collection endpoints for the admin-only team resource.
func (h *Handler) Staff(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.ListStaff(w, r)
	case http.MethodPost:
		h.CreateStaff(w, r)
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

// StaffByID dispatches updates for one staff account.
func (h *Handler) StaffByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		httpx.MethodNotAllowed(w, http.MethodPatch)
		return
	}
	h.UpdateStaff(w, r)
}

type CreateStaffRequest struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func (h *Handler) CreateStaff(w http.ResponseWriter, r *http.Request) {
	var req CreateStaffRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	fields := make(map[string]string)
	name := strings.TrimSpace(req.FullName)
	if name == "" {
		fields["full_name"] = "Name is required"
	} else if len([]rune(name)) > 120 {
		fields["full_name"] = "Too long"
	}
	email := strings.TrimSpace(req.Email)
	if !validEmail(email) {
		fields["email"] = "Enter a valid email"
	}
	if msg := ValidatePassword(req.Password); msg != "" {
		fields["password"] = msg
	}
	if req.Role != "admin" && req.Role != "staff" {
		fields["role"] = "Role must be admin or staff"
	}

	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	id, err := h.store.CreateStaff(r.Context(), email, string(hashed), name, req.Role)
	if err != nil {
		httpx.FromPg(w, err, map[string]string{"users_email_key": "email"})
		return
	}

	_ = httpx.JSON(w, http.StatusCreated, map[string]any{
		"id":        id,
		"email":     email,
		"full_name": name,
		"role":      req.Role,
	})
}

func validEmail(value string) bool {
	if value == "" || len(value) > 254 || strings.ContainsAny(value, "\r\n") {
		return false
	}
	parsed, err := mail.ParseAddress(value)
	return err == nil && parsed.Address == value
}

type UpdateStaffRequest struct {
	FullName string `json:"full_name"`
	Role     string `json:"role"`
	IsActive *bool  `json:"is_active"`
}

func (h *Handler) UpdateStaff(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/staff/")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		httpx.BadRequest(w, "Invalid staff ID")
		return
	}

	var req UpdateStaffRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	if req.Role != "" && req.Role != "admin" && req.Role != "staff" {
		httpx.ValidationError(w, map[string]string{"role": "Role must be admin or staff"})
		return
	}
	if strings.TrimSpace(req.FullName) != "" && len([]rune(strings.TrimSpace(req.FullName))) > 120 {
		httpx.ValidationError(w, map[string]string{"full_name": "Too long"})
		return
	}

	err = h.store.UpdateStaff(r.Context(), id, req.FullName, req.Role, req.IsActive)
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	user, err := h.store.GetUserByID(r.Context(), id)
	if err != nil {
		httpx.NotFound(w, "Staff not found")
		return
	}

	_ = httpx.JSON(w, http.StatusOK, user)
}
