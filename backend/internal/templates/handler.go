package templates

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

type templateRequest struct {
	Name         string            `json:"name"`
	PlanID       any               `json:"plan_id"`
	ValidityDays int               `json:"validity_days"`
	Lines        []templateLineReq `json:"lines"`
}

type templateLineReq struct {
	ProductID any `json:"product_id"`
	VariantID any `json:"variant_id"`
	Quantity  int `json:"quantity"`
}

type instantiateReq struct {
	CustomerID any `json:"customer_id"`
}

func (h *Handler) Templates(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.list(w, r)
	case http.MethodPost:
		h.create(w, r)
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

func (h *Handler) TemplateByID(w http.ResponseWriter, r *http.Request) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/templates/"), "/")
	parts := strings.SplitN(rest, "/", 2)

	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || id < 1 {
		httpx.BadRequest(w, "Invalid template ID")
		return
	}

	if len(parts) == 2 {
		if parts[1] == "instantiate" && r.Method == http.MethodPost {
			h.instantiate(w, r, id)
			return
		}
		httpx.NotFound(w, "Endpoint not found")
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
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(t Template) int64 { return t.ID }))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request, id int64) {
	t, err := h.store.Get(r.Context(), id)
	if err == sql.ErrNoRows {
		httpx.NotFound(w, "Template not found")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, t)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req templateRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	fields := validate(req)
	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}

	planID := parseID(req.PlanID)
	lines := parseLines(req.Lines)

	id, err := h.store.Create(r.Context(), strings.TrimSpace(req.Name), planID, req.ValidityDays, lines)
	if err != nil {
		httpx.FromPg(w, err, map[string]string{"quotation_templates_name_key": "name"})
		return
	}

	t, err := h.store.Get(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusCreated, t)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request, id int64) {
	var req templateRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	fields := validate(req)
	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}

	planID := parseID(req.PlanID)
	lines := parseLines(req.Lines)

	err := h.store.Update(r.Context(), id, strings.TrimSpace(req.Name), planID, req.ValidityDays, lines)
	if err == sql.ErrNoRows {
		httpx.NotFound(w, "Template not found")
		return
	}
	if err != nil {
		httpx.FromPg(w, err, map[string]string{"quotation_templates_name_key": "name"})
		return
	}

	t, err := h.store.Get(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, t)
}

func (h *Handler) instantiate(w http.ResponseWriter, r *http.Request, templateID int64) {
	claims, ok := httpx.GetUserFromContext(r.Context())
	if !ok {
		httpx.Unauthorized(w, "")
		return
	}

	var req instantiateReq
	if !httpx.ParseJSON(w, r, &req) {
		return
	}

	custID := parseID(req.CustomerID)
	if custID < 1 {
		httpx.ValidationError(w, map[string]string{"customer_id": "Customer is required"})
		return
	}

	sub, err := h.store.Instantiate(r.Context(), templateID, custID, claims.ID)
	if err == sql.ErrNoRows {
		httpx.NotFound(w, "Template or Customer not found")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	_ = httpx.JSON(w, http.StatusCreated, sub)
}

func validate(req templateRequest) map[string]string {
	fields := map[string]string{}
	if strings.TrimSpace(req.Name) == "" {
		fields["name"] = "Name is required"
	}
	if parseID(req.PlanID) < 1 {
		fields["plan_id"] = "Select a plan"
	}
	if req.ValidityDays < 1 {
		fields["validity_days"] = "Enter valid validity days"
	}
	return fields
}

func parseID(val any) int64 {
	switch v := val.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	case string:
		id, _ := strconv.ParseInt(v, 10, 64)
		return id
	default:
		return 0
	}
}

func parseLines(reqLines []templateLineReq) []TemplateLine {
	lines := make([]TemplateLine, 0, len(reqLines))
	for _, l := range reqLines {
		pid := parseID(l.ProductID)
		if pid < 1 {
			continue
		}
		var vid *int64
		if l.VariantID != nil {
			id := parseID(l.VariantID)
			if id > 0 {
				vid = &id
			}
		}
		qty := l.Quantity
		if qty < 1 {
			qty = 1
		}
		lines = append(lines, TemplateLine{
			ProductID: pid,
			VariantID: vid,
			Quantity:  qty,
		})
	}
	return lines
}
