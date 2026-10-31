package catalog

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

type productRequest struct {
	Name            string `json:"name"`
	Type            string `json:"type"`
	SalesPriceMinor int64  `json:"sales_price_minor"`
	CostPriceMinor  int64  `json:"cost_price_minor"`
	TaxID           *int64 `json:"tax_id"`
	Notes           string `json:"notes"`
	IsActive        *bool  `json:"is_active"`
}

type productPatchRequest struct {
	Name            string  `json:"name"`
	Type            string  `json:"type"`
	SalesPriceMinor *int64  `json:"sales_price_minor"`
	CostPriceMinor  *int64  `json:"cost_price_minor"`
	TaxID           *int64  `json:"tax_id"`
	Notes           *string `json:"notes"`
	IsActive        *bool   `json:"is_active"`
}

type taxRequest struct {
	Name     string `json:"name"`
	RateBP   int    `json:"rate_bp"`
	IsActive *bool  `json:"is_active"`
}

type paymentTermRequest struct {
	Name    string `json:"name"`
	DueDays int    `json:"due_days"`
}

type variantRequest struct {
	Attribute       string `json:"attribute"`
	Value           string `json:"value"`
	ExtraPriceMinor int64  `json:"extra_price_minor"`
}

type variantPatchRequest struct {
	Value           string `json:"value"`
	ExtraPriceMinor *int64 `json:"extra_price_minor"`
}

func (h *Handler) Products(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listProducts(w, r)
	case http.MethodPost:
		h.createProduct(w, r)
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

func (h *Handler) ProductByID(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/products/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		httpx.BadRequest(w, "Product ID is required")
		return
	}
	productID, err := parsePositiveID(parts[0])
	if err != nil {
		httpx.BadRequest(w, "Invalid product ID")
		return
	}

	if len(parts) == 2 && parts[1] == "variants" {
		h.variants(w, r, productID)
		return
	}
	if len(parts) == 3 && parts[1] == "variants" {
		variantID, parseErr := parsePositiveID(parts[2])
		if parseErr != nil {
			httpx.BadRequest(w, "Invalid variant ID")
			return
		}
		h.variantByID(w, r, productID, variantID)
		return
	}
	if len(parts) != 1 {
		httpx.NotFound(w, "Product not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		product, getErr := h.store.GetProduct(r.Context(), productID)
		if getErr == sql.ErrNoRows {
			httpx.NotFound(w, "Product not found")
			return
		}
		if getErr != nil {
			httpx.Internal(w, getErr)
			return
		}
		_ = httpx.JSON(w, http.StatusOK, product)
	case http.MethodPatch:
		h.updateProduct(w, r, productID)
	case http.MethodDelete:
		if deleteErr := h.store.DeleteProduct(r.Context(), productID); deleteErr != nil {
			httpx.Internal(w, deleteErr)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		httpx.MethodNotAllowed(w, "GET, PATCH, DELETE")
	}
}

func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
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
	items, err := h.store.ListProducts(r.Context(), r.URL.Query().Get("type"), isActive, cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(item Product) int64 { return item.ID }))
}

func (h *Handler) createProduct(w http.ResponseWriter, r *http.Request) {
	var req productRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}
	if fields := validateProduct(req.Name, req.Type, req.SalesPriceMinor, req.CostPriceMinor); len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}
	id, err := h.store.CreateProduct(r.Context(), strings.TrimSpace(req.Name), req.Type, req.SalesPriceMinor, req.CostPriceMinor, req.TaxID, strings.TrimSpace(req.Notes))
	if err != nil {
		httpx.FromPg(w, err, map[string]string{"products_name_key": "name"})
		return
	}
	product, err := h.store.GetProduct(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusCreated, product)
}

func (h *Handler) updateProduct(w http.ResponseWriter, r *http.Request, id int64) {
	var req productPatchRequest
	if !httpx.ParseJSON(w, r, &req) {
		return
	}
	fields := map[string]string{}
	if req.Name != "" && len([]rune(strings.TrimSpace(req.Name))) > 120 {
		fields["name"] = "Too long"
	}
	if req.Type != "" && !validProductType(req.Type) {
		fields["type"] = "Choose a valid product type"
	}
	if req.SalesPriceMinor != nil && *req.SalesPriceMinor < 0 {
		fields["sales_price_minor"] = "Enter a valid amount"
	}
	if req.CostPriceMinor != nil && *req.CostPriceMinor < 0 {
		fields["cost_price_minor"] = "Enter a valid amount"
	}
	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}
	if err := h.store.UpdateProduct(r.Context(), id, strings.TrimSpace(req.Name), req.Type, req.SalesPriceMinor, req.CostPriceMinor, req.TaxID, req.Notes, req.IsActive); err != nil {
		httpx.FromPg(w, err, nil)
		return
	}
	product, err := h.store.GetProduct(r.Context(), id)
	if err == sql.ErrNoRows {
		httpx.NotFound(w, "Product not found")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, product)
}

func (h *Handler) variants(w http.ResponseWriter, r *http.Request, productID int64) {
	switch r.Method {
	case http.MethodGet:
		items, err := h.store.ListVariants(r.Context(), productID)
		if err != nil {
			httpx.Internal(w, err)
			return
		}
		if items == nil {
			items = []Variant{}
		}
		_ = httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
	case http.MethodPost:
		var req variantRequest
		if !httpx.ParseJSON(w, r, &req) {
			return
		}
		if fields := validateVariant(req.Attribute, req.Value, req.ExtraPriceMinor); len(fields) > 0 {
			httpx.ValidationError(w, fields)
			return
		}
		id, err := h.store.CreateVariant(r.Context(), productID, strings.TrimSpace(req.Attribute), strings.TrimSpace(req.Value), req.ExtraPriceMinor)
		if err != nil {
			httpx.FromPg(w, err, nil)
			return
		}
		_ = httpx.JSON(w, http.StatusCreated, map[string]any{"id": id, "product_id": productID, "attribute": strings.TrimSpace(req.Attribute), "value": strings.TrimSpace(req.Value), "extra_price_minor": req.ExtraPriceMinor})
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

func (h *Handler) variantByID(w http.ResponseWriter, r *http.Request, productID, variantID int64) {
	switch r.Method {
	case http.MethodPatch:
		var req variantPatchRequest
		if !httpx.ParseJSON(w, r, &req) {
			return
		}
		if req.Value != "" && len([]rune(strings.TrimSpace(req.Value))) > 120 {
			httpx.ValidationError(w, map[string]string{"value": "Too long"})
			return
		}
		if req.ExtraPriceMinor != nil && *req.ExtraPriceMinor < 0 {
			httpx.ValidationError(w, map[string]string{"extra_price_minor": "Enter a valid amount"})
			return
		}
		if err := h.store.UpdateVariantForProduct(r.Context(), productID, variantID, strings.TrimSpace(req.Value), req.ExtraPriceMinor); err != nil {
			if err == sql.ErrNoRows {
				httpx.NotFound(w, "Variant not found")
				return
			}
			httpx.Internal(w, err)
			return
		}
		_ = httpx.JSON(w, http.StatusOK, map[string]any{"id": variantID, "product_id": productID})
	case http.MethodDelete:
		if err := h.store.DeleteVariantForProduct(r.Context(), productID, variantID); err != nil {
			if err == sql.ErrNoRows {
				httpx.NotFound(w, "Variant not found")
				return
			}
			httpx.Internal(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		httpx.MethodNotAllowed(w, "PATCH, DELETE")
	}
}

func (h *Handler) Taxes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := h.store.ListTaxes(r.Context())
		if err != nil {
			httpx.Internal(w, err)
			return
		}
		if items == nil {
			items = []Tax{}
		}
		_ = httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
	case http.MethodPost:
		var req taxRequest
		if !httpx.ParseJSON(w, r, &req) {
			return
		}
		if fields := validateTax(req.Name, req.RateBP); len(fields) > 0 {
			httpx.ValidationError(w, fields)
			return
		}
		id, err := h.store.CreateTax(r.Context(), strings.TrimSpace(req.Name), req.RateBP)
		if err != nil {
			httpx.FromPg(w, err, nil)
			return
		}
		_ = httpx.JSON(w, http.StatusCreated, map[string]any{"id": id, "name": strings.TrimSpace(req.Name), "rate_bp": req.RateBP, "is_active": true})
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

func (h *Handler) PaymentTerms(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := h.store.ListPaymentTerms(r.Context())
		if err != nil {
			httpx.Internal(w, err)
			return
		}
		if items == nil {
			items = []PaymentTerm{}
		}
		_ = httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
	case http.MethodPost:
		var req paymentTermRequest
		if !httpx.ParseJSON(w, r, &req) {
			return
		}
		fields := map[string]string{}
		if strings.TrimSpace(req.Name) == "" {
			fields["name"] = "Name is required"
		}
		if req.DueDays < 0 {
			fields["due_days"] = "Due days cannot be negative"
		}
		if len(fields) > 0 {
			httpx.ValidationError(w, fields)
			return
		}
		id, err := h.store.CreatePaymentTerm(r.Context(), strings.TrimSpace(req.Name), req.DueDays)
		if err != nil {
			httpx.FromPg(w, err, nil)
			return
		}
		_ = httpx.JSON(w, http.StatusCreated, map[string]any{"id": id, "name": strings.TrimSpace(req.Name), "due_days": req.DueDays})
	default:
		httpx.MethodNotAllowed(w, "GET, POST")
	}
}

func parsePositiveID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id < 1 {
		return 0, strconv.ErrSyntax
	}
	return id, nil
}

func validProductType(value string) bool {
	switch value {
	case "software", "service", "addon", "physical":
		return true
	default:
		return false
	}
}

func validateProduct(name, typ string, sales, cost int64) map[string]string {
	fields := map[string]string{}
	name = strings.TrimSpace(name)
	if name == "" {
		fields["name"] = "Name is required"
	} else if len([]rune(name)) > 120 {
		fields["name"] = "Too long"
	}
	if !validProductType(typ) {
		fields["type"] = "Choose a valid product type"
	}
	if sales < 0 {
		fields["sales_price_minor"] = "Enter a valid amount"
	}
	if cost < 0 {
		fields["cost_price_minor"] = "Enter a valid amount"
	}
	return fields
}

func validateVariant(attribute, value string, extra int64) map[string]string {
	fields := map[string]string{}
	if strings.TrimSpace(attribute) == "" {
		fields["attribute"] = "Attribute is required"
	}
	if strings.TrimSpace(value) == "" {
		fields["value"] = "Value is required"
	}
	if extra < 0 {
		fields["extra_price_minor"] = "Enter a valid amount"
	}
	return fields
}

func validateTax(name string, rate int) map[string]string {
	fields := map[string]string{}
	if strings.TrimSpace(name) == "" {
		fields["name"] = "Name is required"
	}
	if rate < 0 || rate > 10000 {
		fields["rate_bp"] = "Rate must be between 0 and 10000"
	}
	return fields
}
