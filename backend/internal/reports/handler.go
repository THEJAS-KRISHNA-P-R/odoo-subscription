package reports

import (
	"net/http"
	"strings"

	"brightloop/internal/httpx"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.MethodNotAllowed(w, "GET")
		return
	}
	from := strings.TrimSpace(r.URL.Query().Get("from"))
	to := strings.TrimSpace(r.URL.Query().Get("to"))

	rep, err := h.store.Summary(r.Context(), from, to)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, rep)
}

func (h *Handler) RevenueByMonth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.MethodNotAllowed(w, "GET")
		return
	}
	from := strings.TrimSpace(r.URL.Query().Get("from"))
	to := strings.TrimSpace(r.URL.Query().Get("to"))

	items, err := h.store.RevenueByMonth(r.Context(), from, to)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) Overdue(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.MethodNotAllowed(w, "GET")
		return
	}
	limit, cursor, err := httpx.ParseKeysetPaginationValues(r)
	if err != nil {
		httpx.ValidationError(w, map[string]string{"pagination": err.Error()})
		return
	}

	items, err := h.store.Overdue(r.Context(), cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(oi OverdueInvoice) int64 { return oi.InvoiceID }))
}
