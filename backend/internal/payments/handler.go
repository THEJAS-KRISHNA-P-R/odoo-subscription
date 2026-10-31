package payments

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

func (h *Handler) Payments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.MethodNotAllowed(w, "GET")
		return
	}

	limit, cursor, err := httpx.ParseKeysetPaginationValues(r)
	if err != nil {
		httpx.ValidationError(w, map[string]string{"pagination": err.Error()})
		return
	}

	method := strings.TrimSpace(r.URL.Query().Get("method"))
	from := strings.TrimSpace(r.URL.Query().Get("from"))
	to := strings.TrimSpace(r.URL.Query().Get("to"))

	items, err := h.store.List(r.Context(), method, from, to, cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(p Payment) int64 { return p.ID }))
}
