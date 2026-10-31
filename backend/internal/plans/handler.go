package plans

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"brightloop/internal/httpx"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

type planRequest struct {
	Name          string  `json:"name"`
	PriceMinor    int64   `json:"price_minor"`
	BillingPeriod string  `json:"billing_period"`
	MinQuantity   int     `json:"min_quantity"`
	AvailableFrom string  `json:"available_from"`
	AvailableTo   *string `json:"available_to"`
	AutoClose     bool    `json:"auto_close"`
	Closable      bool    `json:"closable"`
	Pausable      bool    `json:"pausable"`
	Renewable     bool    `json:"renewable"`
	IsActive      *bool   `json:"is_active"`
}

type planPatchRequest struct {
	Name          string  `json:"name"`
	PriceMinor    *int64  `json:"price_minor"`
	BillingPeriod string  `json:"billing_period"`
	MinQuantity   *int    `json:"min_quantity"`
	AvailableFrom string  `json:"available_from"`
	AvailableTo   *string `json:"available_to"`
	AutoClose     *bool   `json:"auto_close"`
	Closable      *bool   `json:"closable"`
	Pausable      *bool   `json:"pausable"`
	Renewable     *bool   `json:"renewable"`
	IsActive      *bool   `json:"is_active"`
}

func (h *Handler) Plans(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.list(w, r)
	case http.MethodPost:
		h.create(w, r)
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

func (h *Handler) PlanByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/plans/"), "/"), 10, 64)
	if err != nil || id < 1 {
		httpx.BadRequest(w, "Invalid plan ID")
		return
	}
	switch r.Method {
	case http.MethodGet:
		plan, getErr := h.store.GetPlan(r.Context(), id)
		if getErr == sql.ErrNoRows {
			httpx.NotFound(w, "Plan not found")
			return
		}
		if getErr != nil {
			httpx.Internal(w, getErr)
			return
		}
		_ = httpx.JSON(w, http.StatusOK, plan)
	case http.MethodPatch:
		h.update(w, r, id)
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
	var isActive *bool
	if value := r.URL.Query().Get("is_active"); value != "" {
		parsed, parseErr := strconv.ParseBool(value)
		if parseErr != nil {
			httpx.ValidationError(w, map[string]string{"is_active": "Use true or false"})
			return
		}
		isActive = &parsed
	}
	items, err := h.store.ListPlans(r.Context(), isActive, cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(item Plan) int64 { return item.ID }))
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req planRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}
	if fields := validatePlan(req.Name, req.PriceMinor, req.BillingPeriod, req.MinQuantity, req.AvailableFrom, req.AvailableTo); len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}
	plan := Plan{
		Name: strings.TrimSpace(req.Name), PriceMinor: req.PriceMinor, BillingPeriod: req.BillingPeriod,
		MinQuantity: req.MinQuantity, AvailableFrom: req.AvailableFrom, AvailableTo: req.AvailableTo,
		AutoClose: req.AutoClose, Closable: req.Closable, Pausable: req.Pausable, Renewable: req.Renewable,
		IsActive: true,
	}
	id, err := h.store.CreatePlan(r.Context(), plan)
	if err != nil {
		httpx.FromPg(w, err, map[string]string{"plans_name_key": "name"})
		return
	}
	created, err := h.store.GetPlan(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusCreated, created)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request, id int64) {
	var req planPatchRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}
	fields := map[string]string{}
	if req.Name != "" && len([]rune(strings.TrimSpace(req.Name))) > 120 {
		fields["name"] = "Too long"
	}
	if req.PriceMinor != nil && *req.PriceMinor < 0 {
		fields["price_minor"] = "Enter a valid amount"
	}
	if req.BillingPeriod != "" && !validPeriod(req.BillingPeriod) {
		fields["billing_period"] = "Choose a valid billing period"
	}
	if req.MinQuantity != nil && *req.MinQuantity < 1 {
		fields["min_quantity"] = "Minimum quantity must be at least 1"
	}
	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}
	if err := h.store.UpdatePlan(r.Context(), id, strings.TrimSpace(req.Name), req.BillingPeriod, req.AvailableFrom, req.PriceMinor, req.MinQuantity, req.AvailableTo, req.AutoClose, req.Closable, req.Pausable, req.Renewable, req.IsActive); err != nil {
		if err == sql.ErrNoRows {
			httpx.NotFound(w, "Plan not found")
			return
		}
		httpx.FromPg(w, err, map[string]string{"plans_name_key": "name"})
		return
	}
	updated, err := h.store.GetPlan(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, updated)
}

func validatePlan(name string, price int64, period string, minQuantity int, availableFrom string, availableTo *string) map[string]string {
	fields := map[string]string{}
	if strings.TrimSpace(name) == "" {
		fields["name"] = "Name is required"
	} else if len([]rune(strings.TrimSpace(name))) > 120 {
		fields["name"] = "Too long"
	}
	if price < 0 {
		fields["price_minor"] = "Enter a valid amount"
	}
	if !validPeriod(period) {
		fields["billing_period"] = "Choose a valid billing period"
	}
	if minQuantity < 1 {
		fields["min_quantity"] = "Minimum quantity must be at least 1"
	}
	start, err := time.Parse("2006-01-02", strings.TrimSpace(availableFrom))
	if err != nil {
		fields["available_from"] = "Start date is required"
	}
	if availableTo != nil && strings.TrimSpace(*availableTo) != "" {
		end, endErr := time.Parse("2006-01-02", strings.TrimSpace(*availableTo))
		if endErr != nil || (err == nil && end.Before(start)) {
			fields["available_to"] = "End date must be after start date"
		}
	}
	return fields
}

func validPeriod(value string) bool {
	switch value {
	case "daily", "weekly", "monthly", "yearly":
		return true
	default:
		return false
	}
}
