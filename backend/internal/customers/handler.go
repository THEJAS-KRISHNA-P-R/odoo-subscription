package customers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"brightloop/internal/httpx"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

type customerRequest struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Company        string `json:"company"`
	Phone          string `json:"phone"`
	BillingAddress string `json:"billing_address"`
}

const createRoute = "/api/v1/customers"

func (h *Handler) Customers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.list(w, r)
	case http.MethodPost:
		h.create(w, r)
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

func (h *Handler) CustomerByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.Trim(strings.TrimPrefix(r.URL.Path, createRoute+"/"), "/"), 10, 64)
	if err != nil || id < 1 {
		httpx.BadRequest(w, "Invalid customer ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		customer, getErr := h.store.Get(r.Context(), id)
		if getErr == sql.ErrNoRows {
			httpx.NotFound(w, "Customer not found")
			return
		}
		if getErr != nil {
			httpx.Internal(w, getErr)
			return
		}
		_ = httpx.JSON(w, http.StatusOK, customer)
	case http.MethodPatch:
		var req customerRequest
		if !httpx.ParseJSON(w, r, &req) {
			return
		}
		name := strings.TrimSpace(req.Name)
		email := strings.TrimSpace(req.Email)
		if fields := validate(name, email, false); len(fields) > 0 {
			httpx.ValidationError(w, fields)
			return
		}
		if err := h.store.Update(r.Context(), id, name, email, strings.TrimSpace(req.Company), strings.TrimSpace(req.Phone), strings.TrimSpace(req.BillingAddress)); err != nil {
			if err == sql.ErrNoRows {
				httpx.NotFound(w, "Customer not found")
				return
			}
			httpx.FromPg(w, err, map[string]string{"users_email_key": "email"})
			return
		}
		customer, err := h.store.Get(r.Context(), id)
		if err != nil {
			httpx.Internal(w, err)
			return
		}
		_ = httpx.JSON(w, http.StatusOK, customer)
	default:
		httpx.MethodNotAllowed(w, "GET, PATCH")
	}
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	limit, cursor, err := httpx.ParseKeysetPaginationValues(r)
	if err != nil {
		httpx.ValidationError(w, map[string]string{"pagination": err.Error()})
		return
	}
	items, err := h.store.List(r.Context(), strings.TrimSpace(r.URL.Query().Get("q")), cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(item Customer) int64 { return item.ID }))
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req customerRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}
	name := strings.TrimSpace(req.Name)
	email := strings.TrimSpace(req.Email)
	if fields := validate(name, email, true); len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}
	id, err := h.store.Create(r.Context(), name, email, strings.TrimSpace(req.Company), strings.TrimSpace(req.Phone), strings.TrimSpace(req.BillingAddress))
	if err != nil {
		httpx.FromPg(w, err, map[string]string{"users_email_key": "email"})
		return
	}
	customer, err := h.store.Get(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusCreated, customer)
}

func validate(name, email string, requireEmail bool) map[string]string {
	fields := map[string]string{}
	if name == "" {
		fields["name"] = "Name is required"
	} else if len([]rune(name)) > 120 {
		fields["name"] = "Too long"
	}
	if (requireEmail || email != "") && !httpx.ValidEmail(email) {
		fields["email"] = "Enter a valid email"
	}
	return fields
}
