package discounts

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

type discountRequest struct {
	Name             string `json:"name"`
	Kind             string `json:"kind"`
	Value            int64  `json:"value"`
	MinPurchaseMinor int64  `json:"min_purchase_minor"`
	MinQuantity      int    `json:"min_quantity"`
	StartDate        string `json:"start_date"`
	EndDate          string `json:"end_date"`
	UsageLimit       *int   `json:"usage_limit"`
	Scope            string `json:"scope"`
	IsActive         bool   `json:"is_active"`
	ProductIDs       []any  `json:"product_ids"`
	SubscriptionIDs  []any  `json:"subscription_ids"`
}

func (h *Handler) Discounts(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.list(w, r)
	case http.MethodPost:
		h.create(w, r)
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

func (h *Handler) DiscountByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/discounts/"), "/")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id < 1 {
		httpx.BadRequest(w, "Invalid discount ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.get(w, r, id)
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

	items, err := h.store.List(r.Context(), cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(d Discount) int64 { return d.ID }))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request, id int64) {
	d, err := h.store.Get(r.Context(), id)
	if err == sql.ErrNoRows {
		httpx.NotFound(w, "Discount not found")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, d)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req discountRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	fields := validate(req)
	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}

	pids := parseIDs(req.ProductIDs)
	sids := parseIDs(req.SubscriptionIDs)

	id, err := h.store.Create(
		r.Context(),
		strings.TrimSpace(req.Name),
		req.Kind,
		req.Value,
		req.MinPurchaseMinor,
		req.MinQuantity,
		strings.TrimSpace(req.StartDate),
		strings.TrimSpace(req.EndDate),
		req.UsageLimit,
		req.Scope,
		req.IsActive,
		pids,
		sids,
	)
	if err != nil {
		httpx.FromPg(w, err, nil)
		return
	}

	d, err := h.store.Get(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusCreated, d)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request, id int64) {
	var req discountRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	fields := validate(req)
	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}

	pids := parseIDs(req.ProductIDs)
	sids := parseIDs(req.SubscriptionIDs)

	err := h.store.Update(
		r.Context(),
		id,
		strings.TrimSpace(req.Name),
		req.Kind,
		req.Value,
		req.MinPurchaseMinor,
		req.MinQuantity,
		strings.TrimSpace(req.StartDate),
		strings.TrimSpace(req.EndDate),
		req.UsageLimit,
		req.Scope,
		req.IsActive,
		pids,
		sids,
	)
	if err == sql.ErrNoRows {
		httpx.NotFound(w, "Discount not found")
		return
	}
	if err != nil {
		httpx.FromPg(w, err, nil)
		return
	}

	d, err := h.store.Get(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, d)
}

func validate(req discountRequest) map[string]string {
	fields := map[string]string{}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		fields["name"] = "Name is required"
	}
	if req.Kind != "fixed" && req.Kind != "percent" {
		fields["kind"] = "Choose a valid discount kind"
	}
	if req.Kind == "percent" && (req.Value < 1 || req.Value > 10000) {
		fields["value"] = "Percent must be between 1 and 100"
	}
	if req.Kind == "fixed" && req.Value <= 0 {
		fields["value"] = "Enter a valid amount"
	}
	if req.MinPurchaseMinor < 0 {
		fields["min_purchase_minor"] = "Enter a valid amount"
	}
	if req.UsageLimit != nil && *req.UsageLimit < 1 {
		fields["usage_limit"] = "Limit must be at least 1"
	}
	if req.StartDate == "" {
		fields["start_date"] = "Start date is required"
	}
	if req.EndDate == "" {
		fields["end_date"] = "End date is required"
	}
	if req.StartDate != "" && req.EndDate != "" && req.EndDate < req.StartDate {
		fields["end_date"] = "End date must be after start date"
	}
	if req.Scope != "product" && req.Scope != "subscription" {
		fields["scope"] = "Choose a valid discount scope"
	}
	return fields
}

func parseIDs(raw []any) []int64 {
	var res []int64
	for _, v := range raw {
		switch val := v.(type) {
		case float64:
			res = append(res, int64(val))
		case string:
			if id, err := strconv.ParseInt(val, 10, 64); err == nil {
				res = append(res, id)
			}
		}
	}
	return res
}
