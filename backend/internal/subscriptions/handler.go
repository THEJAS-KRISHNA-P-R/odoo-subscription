package subscriptions

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

func NewHandler(store *Store) *Handler { return &Handler{store: store} }

// --- collection ---

func (h *Handler) Subscriptions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.list(w, r)
	case http.MethodPost:
		h.create(w, r)
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	limit, cursor, err := httpx.ParseKeysetPaginationValues(r)
	if err != nil {
		httpx.ValidationError(w, map[string]string{"pagination": err.Error()})
		return
	}
	items, err := h.store.List(r.Context(),
		r.URL.Query().Get("status"),
		r.URL.Query().Get("customer_id"),
		cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(s Subscription) int64 { return s.ID }))
}

type createReq struct {
	CustomerID     int64       `json:"customer_id"`
	PlanID         int64       `json:"plan_id"`
	PaymentTermID  int64       `json:"payment_term_id"`
	TemplateID     *int64      `json:"template_id"`
	StartDate      string      `json:"start_date"`
	ExpiryDate     string      `json:"expiry_date"`
	QuoteValidUntil *string    `json:"quote_valid_until"`
	Lines          []lineReq   `json:"lines"`
}

type lineReq struct {
	ProductID      int64  `json:"product_id"`
	VariantID      *int64 `json:"variant_id"`
	Description    string `json:"description"`
	Quantity       int    `json:"quantity"`
	UnitPriceMinor int64  `json:"unit_price_minor"`
	TaxID          *int64 `json:"tax_id"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	claims, ok := httpx.GetUserFromContext(r.Context())
	if !ok {
		httpx.Unauthorized(w, "")
		return
	}
	var req createReq
	if !httpx.ParseJSON(w, r, &req) {
		return
	}
	fields := map[string]string{}
	if req.CustomerID < 1 {
		fields["customer_id"] = "Customer is required"
	}
	if req.PlanID < 1 {
		fields["plan_id"] = "Plan is required"
	}
	if req.PaymentTermID < 1 {
		fields["payment_term_id"] = "Payment term is required"
	}
	if strings.TrimSpace(req.StartDate) == "" {
		fields["start_date"] = "Start date is required"
	}
	if strings.TrimSpace(req.ExpiryDate) == "" {
		fields["expiry_date"] = "Expiry date is required"
	}
	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}

	lines := make([]LineInput, len(req.Lines))
	for i, l := range req.Lines {
		pid := l.ProductID
		lines[i] = LineInput{
			ProductID:      &pid,
			VariantID:      l.VariantID,
			Description:    strings.TrimSpace(l.Description),
			Quantity:       l.Quantity,
			UnitPriceMinor: l.UnitPriceMinor,
			TaxID:          l.TaxID,
		}
		if l.ProductID == 0 {
			lines[i].ProductID = nil
		}
	}

	id, err := h.store.Create(r.Context(),
		req.CustomerID, req.PlanID, req.PaymentTermID, claims.ID,
		req.TemplateID, req.StartDate, req.ExpiryDate, req.QuoteValidUntil, lines)
	if err != nil {
		httpx.FromPg(w, err, nil)
		return
	}
	sub, err := h.store.Get(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusCreated, sub)
}

// --- single resource ---

func (h *Handler) SubscriptionByID(w http.ResponseWriter, r *http.Request) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/subscriptions/"), "/")
	parts := strings.Split(rest, "/")
	if len(parts) == 0 || parts[0] == "" {
		httpx.BadRequest(w, "Invalid subscription ID")
		return
	}
	id, err := parseID(parts[0])
	if err != nil {
		httpx.BadRequest(w, "Invalid subscription ID")
		return
	}

	if len(parts) > 1 {
		switch parts[1] {
		case "transition":
			h.Transition(w, r)
			return
		case "renew":
			h.renew(w, r, id)
			return
		case "events":
			h.Events(w, r)
			return
		default:
			httpx.NotFound(w, "Endpoint not found")
			return
		}
	}

	switch r.Method {
	case http.MethodGet:
		sub, getErr := h.store.Get(r.Context(), id)
		if getErr == sql.ErrNoRows {
			httpx.NotFound(w, "Subscription not found")
			return
		}
		if getErr != nil {
			httpx.Internal(w, getErr)
			return
		}
		_ = httpx.JSON(w, http.StatusOK, sub)
	default:
		httpx.MethodNotAllowed(w, "GET")
	}
}

func (h *Handler) renew(w http.ResponseWriter, r *http.Request, id int64) {
	if r.Method != http.MethodPost {
		httpx.MethodNotAllowed(w, "POST")
		return
	}
	claims, ok := httpx.GetUserFromContext(r.Context())
	if !ok {
		httpx.Unauthorized(w, "")
		return
	}
	if err := h.store.Transition(r.Context(), id, "active", claims.ID, "Renewed"); err != nil {
		if err.Error() == "invalid_transition" {
			httpx.Conflict(w, "invalid_transition", "This subscription cannot be renewed")
			return
		}
		if err == sql.ErrNoRows {
			httpx.NotFound(w, "Subscription not found")
			return
		}
		httpx.Internal(w, err)
		return
	}
	sub, err := h.store.Get(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, sub)
}

// --- sub-resources: transition + events ---

func (h *Handler) Transition(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.MethodNotAllowed(w, "POST")
		return
	}
	// path: /api/v1/subscriptions/{id}/transition
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/subscriptions/"), "/"), "/")
	if len(parts) < 2 {
		httpx.BadRequest(w, "Invalid path")
		return
	}
	id, err := parseID(parts[0])
	if err != nil {
		httpx.BadRequest(w, "Invalid subscription ID")
		return
	}
	claims, ok := httpx.GetUserFromContext(r.Context())
	if !ok {
		httpx.Unauthorized(w, "")
		return
	}
	var req struct {
		To   string `json:"to"`
		Note string `json:"note"`
	}
	if !httpx.ParseJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.To) == "" {
		httpx.ValidationError(w, map[string]string{"to": "Target status is required"})
		return
	}
	if err := h.store.Transition(r.Context(), id, req.To, claims.ID, req.Note); err != nil {
		if err.Error() == "invalid_transition" {
			httpx.Conflict(w, "invalid_transition", "This transition is not allowed from the current status")
			return
		}
		if err == sql.ErrNoRows {
			httpx.NotFound(w, "Subscription not found")
			return
		}
		httpx.Internal(w, err)
		return
	}
	sub, err := h.store.Get(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, sub)
}

func (h *Handler) Events(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.MethodNotAllowed(w, "GET")
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/subscriptions/"), "/"), "/")
	if len(parts) < 2 {
		httpx.BadRequest(w, "Invalid path")
		return
	}
	id, err := parseID(parts[0])
	if err != nil {
		httpx.BadRequest(w, "Invalid subscription ID")
		return
	}
	events, err := h.store.ListEvents(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, map[string]any{"items": events})
}

// --- billing run ---

func (h *Handler) BillingRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.MethodNotAllowed(w, "POST")
		return
	}
	var req struct {
		AsOf   string `json:"as_of"`
		DryRun bool   `json:"dry_run"`
	}
	if r.Body != nil {
		_ = httpx.ParseJSON(w, r, &req) // optional body — ignore parse failure
	}
	asOf := time.Now().UTC()
	if req.AsOf != "" {
		if t, err := time.Parse("2006-01-02", req.AsOf); err == nil {
			asOf = t
		}
	}
	if req.DryRun {
		// shortcut: dry_run not yet implemented — return zeros; upgrade when needed
		_ = httpx.JSON(w, http.StatusOK, &BillingRunResult{Errors: []string{}})
		return
	}
	claims, ok := httpx.GetUserFromContext(r.Context())
	if !ok {
		httpx.Unauthorized(w, "")
		return
	}
	result, err := h.store.RunBilling(r.Context(), claims.ID, asOf)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, result)
}

// --- customer portal ---

// PortalSubscriptions serves GET /me/subscriptions for authenticated customers.
func (h *Handler) PortalSubscriptions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.MethodNotAllowed(w, "GET")
		return
	}
	custID, ok := h.customerIDFromContext(r)
	if !ok {
		httpx.Forbidden(w, "Customer account required")
		return
	}
	limit, cursor, _ := httpx.ParseKeysetPaginationValues(r)
	items, err := h.store.List(r.Context(), "", strconv.FormatInt(custID, 10), cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(s Subscription) int64 { return s.ID }))
}

// PortalTransition serves POST /me/subscriptions/{id}/transition for customers.
func (h *Handler) PortalTransition(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.MethodNotAllowed(w, "POST")
		return
	}
	custID, ok := h.customerIDFromContext(r)
	if !ok {
		httpx.Forbidden(w, "Customer account required")
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/me/subscriptions/"), "/"), "/")
	if len(parts) < 2 {
		httpx.BadRequest(w, "Invalid path")
		return
	}
	id, err := parseID(parts[0])
	if err != nil {
		httpx.BadRequest(w, "Invalid subscription ID")
		return
	}
	// verify ownership
	sub, err := h.store.Get(r.Context(), id)
	if err != nil || sub.CustomerID != custID {
		httpx.NotFound(w, "Subscription not found")
		return
	}
	claims, _ := httpx.GetUserFromContext(r.Context())
	var req struct {
		To   string `json:"to"`
		Note string `json:"note"`
	}
	if !httpx.ParseJSON(w, r, &req) {
		return
	}
	if err := h.store.Transition(r.Context(), id, req.To, claims.ID, req.Note); err != nil {
		if err.Error() == "invalid_transition" {
			httpx.Conflict(w, "invalid_transition", "This transition is not allowed")
			return
		}
		httpx.Internal(w, err)
		return
	}
	updated, _ := h.store.Get(r.Context(), id)
	_ = httpx.JSON(w, http.StatusOK, updated)
}

// customerIDFromContext looks up the customer_id for the authenticated user.
// Returns false if the user is not a customer.
func (h *Handler) customerIDFromContext(r *http.Request) (int64, bool) {
	claims, ok := httpx.GetUserFromContext(r.Context())
	if !ok || claims.Role != "customer" {
		return 0, false
	}
	id, err := h.store.CustomerIDByUserID(r.Context(), claims.ID)
	if err != nil {
		return 0, false
	}
	return id, true
}

func parseID(s string) (int64, error) {
	s = strings.Trim(s, "/")
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id < 1 {
		return 0, strconv.ErrSyntax
	}
	return id, nil
}
