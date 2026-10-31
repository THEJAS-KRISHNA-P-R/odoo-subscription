package invoices

import (
	"database/sql"
	"encoding/csv"
	"fmt"
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

func (h *Handler) Invoices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.MethodNotAllowed(w, "GET")
		return
	}
	// CSV export
	if r.URL.Query().Get("format") == "csv" {
		h.exportCSV(w, r)
		return
	}
	limit, cursor, err := httpx.ParseKeysetPaginationValues(r)
	if err != nil {
		httpx.ValidationError(w, map[string]string{"pagination": err.Error()})
		return
	}
	overdueOnly := r.URL.Query().Get("overdue") == "true"
	items, err := h.store.List(r.Context(),
		r.URL.Query().Get("status"), overdueOnly,
		r.URL.Query().Get("customer_id"), cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(i Invoice) int64 { return i.ID }))
}

func (h *Handler) InvoiceByID(w http.ResponseWriter, r *http.Request) {
	// path: /api/v1/invoices/{id}[/action]
	rest := strings.TrimPrefix(r.URL.Path, "/api/v1/invoices/")
	parts := strings.SplitN(strings.Trim(rest, "/"), "/", 2)
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || id < 1 {
		httpx.BadRequest(w, "Invalid invoice ID")
		return
	}

	// sub-resources
	if len(parts) == 2 {
		switch parts[1] {
		case "confirm":
			h.confirm(w, r, id)
		case "cancel":
			h.cancel(w, r, id)
		case "send":
			h.send(w, r, id)
		case "payments":
			h.recordPayment(w, r, id)
		default:
			httpx.NotFound(w, "Unknown invoice action")
		}
		return
	}

	if r.Method != http.MethodGet {
		httpx.MethodNotAllowed(w, "GET")
		return
	}
	inv, getErr := h.store.Get(r.Context(), id)
	if getErr == sql.ErrNoRows {
		httpx.NotFound(w, "Invoice not found")
		return
	}
	if getErr != nil {
		httpx.Internal(w, getErr)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, inv)
}

func (h *Handler) confirm(w http.ResponseWriter, r *http.Request, id int64) {
	if r.Method != http.MethodPost {
		httpx.MethodNotAllowed(w, "POST")
		return
	}
	if err := h.store.Confirm(r.Context(), id); err != nil {
		handleInvErr(w, err, id)
		return
	}
	inv, _ := h.store.Get(r.Context(), id)
	_ = httpx.JSON(w, http.StatusOK, inv)
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request, id int64) {
	if r.Method != http.MethodPost {
		httpx.MethodNotAllowed(w, "POST")
		return
	}
	if err := h.store.Cancel(r.Context(), id); err != nil {
		handleInvErr(w, err, id)
		return
	}
	inv, _ := h.store.Get(r.Context(), id)
	_ = httpx.JSON(w, http.StatusOK, inv)
}

func (h *Handler) send(w http.ResponseWriter, r *http.Request, id int64) {
	if r.Method != http.MethodPost {
		httpx.MethodNotAllowed(w, "POST")
		return
	}
	if err := h.store.Send(r.Context(), id); err != nil {
		handleInvErr(w, err, id)
		return
	}
	inv, _ := h.store.Get(r.Context(), id)
	_ = httpx.JSON(w, http.StatusOK, inv)
}

type paymentReq struct {
	Method      string `json:"method"`
	AmountMinor int64  `json:"amount_minor"`
	PaidOn      string `json:"paid_on"`
	Note        string `json:"note"`
}

func (h *Handler) recordPayment(w http.ResponseWriter, r *http.Request, invID int64) {
	if r.Method != http.MethodPost {
		httpx.MethodNotAllowed(w, "POST")
		return
	}
	claims, ok := httpx.GetUserFromContext(r.Context())
	if !ok {
		httpx.Unauthorized(w, "")
		return
	}
	var req paymentReq
	if !httpx.ParseJSON(w, r, &req) {
		return
	}
	fields := map[string]string{}
	validMethod := map[string]bool{"cash": true, "bank_transfer": true, "card": true, "upi": true, "cheque": true}
	if !validMethod[req.Method] {
		fields["method"] = "Choose a valid payment method"
	}
	if req.AmountMinor < 1 {
		fields["amount_minor"] = "Amount must be at least 1"
	}
	if strings.TrimSpace(req.PaidOn) == "" {
		fields["paid_on"] = "Payment date is required"
	} else {
		if t, err := time.Parse("2006-01-02", req.PaidOn); err != nil {
			fields["paid_on"] = "Enter a valid date (YYYY-MM-DD)"
		} else if t.After(time.Now().UTC()) {
			fields["paid_on"] = "Payment date cannot be in the future"
		}
	}
	if len(fields) > 0 {
		httpx.ValidationError(w, fields)
		return
	}

	pid, err := h.store.RecordPayment(r.Context(), invID, claims.ID, req.Method, req.AmountMinor, req.PaidOn, req.Note)
	if err != nil {
		if err.Error() == "not_confirmed" {
			httpx.Conflict(w, "invalid_transition", "Only confirmed invoices can receive payments")
			return
		}
		if strings.HasPrefix(err.Error(), "overpay:") {
			outstanding, _ := strconv.ParseInt(strings.TrimPrefix(err.Error(), "overpay:"), 10, 64)
			httpx.ValidationError(w, map[string]string{
				"amount_minor": fmt.Sprintf("Amount exceeds the outstanding balance of %d minor units", outstanding),
			})
			return
		}
		if err == sql.ErrNoRows {
			httpx.NotFound(w, "Invoice not found")
			return
		}
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusCreated, map[string]any{"id": pid})
}

func (h *Handler) exportCSV(w http.ResponseWriter, r *http.Request) {
	invoices, err := h.store.ListCSV(r.Context())
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=invoices.csv")
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"ID", "Number", "Customer", "Status", "Period Start", "Period End",
		"Issue Date", "Due Date", "Subtotal", "Discount", "Tax", "Total", "Paid", "Outstanding"})
	for _, inv := range invoices {
		_ = cw.Write([]string{
			strconv.FormatInt(inv.ID, 10), inv.Number, inv.CustomerName, inv.Status,
			inv.PeriodStart, inv.PeriodEnd, inv.IssueDate, inv.DueDate,
			strconv.FormatInt(inv.SubtotalMinor, 10), strconv.FormatInt(inv.DiscountMinor, 10),
			strconv.FormatInt(inv.TaxMinor, 10), strconv.FormatInt(inv.TotalMinor, 10),
			strconv.FormatInt(inv.PaidMinor, 10), strconv.FormatInt(inv.OutstandingMinor, 10),
		})
	}
	cw.Flush()
}

// PortalInvoices serves GET /me/invoices and GET /me/invoices/{id} for customers.
func (h *Handler) PortalInvoices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.MethodNotAllowed(w, "GET")
		return
	}
	claims, ok := httpx.GetUserFromContext(r.Context())
	if !ok || claims.Role != "customer" {
		httpx.Forbidden(w, "Customer account required")
		return
	}
	// look up customer_id from users.id
	rest := strings.TrimPrefix(r.URL.Path, "/api/v1/me/invoices")
	rest = strings.Trim(rest, "/")

	custID, err := h.store.CustomerIDByUserID(r.Context(), claims.ID)
	if err != nil {
		httpx.Forbidden(w, "Customer account not found")
		return
	}

	if rest != "" {
		// single invoice
		id, err := strconv.ParseInt(rest, 10, 64)
		if err != nil || id < 1 {
			httpx.BadRequest(w, "Invalid invoice ID")
			return
		}
		inv, err := h.store.Get(r.Context(), id)
		if err == sql.ErrNoRows || (inv != nil && inv.CustomerID != custID) {
			httpx.NotFound(w, "Invoice not found")
			return
		}
		if err != nil {
			httpx.Internal(w, err)
			return
		}
		_ = httpx.JSON(w, http.StatusOK, inv)
		return
	}

	limit, cursor, _ := httpx.ParseKeysetPaginationValues(r)
	items, err := h.store.List(r.Context(), "", false, strconv.FormatInt(custID, 10), cursor, limit)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_ = httpx.JSON(w, http.StatusOK, httpx.NewKeysetList(items, limit, func(i Invoice) int64 { return i.ID }))
}

func handleInvErr(w http.ResponseWriter, err error, id int64) {
	switch err.Error() {
	case "invalid_transition":
		httpx.Conflict(w, "invalid_transition", "This action is not allowed from the current invoice status")
	case "has_payments":
		httpx.Conflict(w, "conflict", "Cannot cancel an invoice that has payments")
	default:
		if err == sql.ErrNoRows {
			httpx.NotFound(w, "Invoice not found")
			return
		}
		httpx.Internal(w, err)
	}
}
