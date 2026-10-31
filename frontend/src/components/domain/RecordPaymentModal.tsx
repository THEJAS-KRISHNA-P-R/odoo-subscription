'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api, ApiError, createIdempotencyKey } from '@/lib/api';
import { useEnum } from '@/lib/meta';
import { useList } from '@/lib/useList';
import {
  formatMinor,
  minorToRupeeInput,
  parseRupeesToMinor,
  todayIsoDate,
} from '@/lib/money';
import { Invoice } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Field, SelectField, TextareaField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { GroupedRow, GroupedRowContainer } from '@/components/ui/GroupedRow';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

export interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  preselectedInvoice?: Invoice | null;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  open,
  onClose,
  preselectedInvoice = null,
  onSuccess,
}: RecordPaymentModalProps) {
  const { showToast } = useToast();
  const paymentMethods = useEnum('payment_method');

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(preselectedInvoice);
  const [searchQuery, setSearchQuery] = useState('');
  const [method, setMethod] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [paidOn, setPaidOn] = useState(todayIsoDate());
  const [note, setNote] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Generate Idempotency-Key once when the modal opens
  useEffect(() => {
    if (open) {
      setIdempotencyKey(createIdempotencyKey());
      setSelectedInvoice(preselectedInvoice);
      setFields({});
      setPaidOn(todayIsoDate());
      setNote('');
      if (preselectedInvoice) {
        setAmountRupees(minorToRupeeInput(preselectedInvoice.outstanding_minor));
      } else {
        setAmountRupees('');
      }
      if (paymentMethods.length > 0 && !method) {
        setMethod(paymentMethods[0].value);
      }
    }
  }, [open, preselectedInvoice, paymentMethods]);

  const confirmedStatusValue = useMemo(() => 'confirmed', []);
  const invoiceList = useList<Invoice>(
    open && !selectedInvoice ? '/invoices' : null,
    { status: confirmedStatusValue, q: searchQuery || undefined },
    10
  );

  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setAmountRupees(minorToRupeeInput(inv.outstanding_minor));
    setFields({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const clientErrors: Record<string, string> = {};
    if (!method) {
      clientErrors.method = 'Select a payment method';
    }
    const amountMinor = parseRupeesToMinor(amountRupees);
    if (amountMinor === null || amountMinor <= 0) {
      clientErrors.amount_minor = 'Enter a valid amount';
    } else if (
      selectedInvoice.outstanding_minor > 0 &&
      amountMinor > selectedInvoice.outstanding_minor
    ) {
      clientErrors.amount_minor = `Amount exceeds the outstanding balance of ${formatMinor(
        selectedInvoice.outstanding_minor
      )}`;
    }
    const maxDate = todayIsoDate();
    if (!paidOn) {
      clientErrors.paid_on = 'Payment date is required';
    } else if (paidOn > maxDate) {
      clientErrors.paid_on = 'Payment date cannot be in the future';
    }

    if (Object.keys(clientErrors).length > 0) {
      setFields(clientErrors);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      await api.post(
        `/invoices/${selectedInvoice.id}/payments`,
        {
          method,
          amount_minor: amountMinor,
          paid_on: paidOn,
          note: note.trim(),
        },
        { idempotencyKey }
      );
      showToast('Payment recorded', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Could not record payment', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      subtitle={
        selectedInvoice
          ? `Recording payment against invoice ${selectedInvoice.number} (${selectedInvoice.customer_name})`
          : 'Choose an unpaid confirmed invoice to record a payment against'
      }
      footer={
        selectedInvoice ? (
          <>
            {!preselectedInvoice && (
              <Pill
                variant="outline"
                onClick={() => setSelectedInvoice(null)}
                disabled={submitting}
                className="mr-auto"
              >
                Change invoice
              </Pill>
            )}
            <Pill variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Pill>
            <Pill
              type="submit"
              form="record-payment-form"
              variant="primary"
              loading={submitting}
            >
              Record payment
            </Pill>
          </>
        ) : (
          <Pill variant="ghost" onClick={onClose}>
            Cancel
          </Pill>
        )
      }
    >
      {!selectedInvoice ? (
        <div className="space-y-4">
          <Field
            label="Search unpaid invoices"
            type="search"
            placeholder="Search by invoice number or customer…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {invoiceList.loading ? (
            <Skeleton rows={3} />
          ) : invoiceList.error ? (
            <ErrorState message={invoiceList.error.message} onRetry={invoiceList.reset} />
          ) : invoiceList.items.length === 0 ? (
            <EmptyState message="No confirmed unpaid invoices found." />
          ) : (
            <GroupedRowContainer>
              {invoiceList.items.map((inv) => (
                <GroupedRow
                  key={inv.id}
                  onClick={() => handleSelectInvoice(inv)}
                  ariaLabel={`Select invoice ${inv.number}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                        {inv.number} · {inv.customer_name}
                      </div>
                      <div className="text-[12px] text-[var(--text-muted)]">
                        Due {inv.due_date}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums">
                        {formatMinor(inv.outstanding_minor)}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">Outstanding</div>
                    </div>
                  </div>
                </GroupedRow>
              ))}
            </GroupedRowContainer>
          )}
        </div>
      ) : (
        <form id="record-payment-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="bg-[var(--bg-surface)] rounded-[16px] p-4 flex items-center justify-between">
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">Outstanding balance</div>
              <div className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums">
                {formatMinor(selectedInvoice.outstanding_minor)}
              </div>
            </div>
            <div className="text-right text-[12px] text-[var(--text-secondary)]">
              <div>Invoice {selectedInvoice.number}</div>
              <div>Due {selectedInvoice.due_date}</div>
            </div>
          </div>

          <SelectField
            label="Payment method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            error={fields.method}
            required
          >
            <option value="">Select payment method…</option>
            {paymentMethods.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </SelectField>

          <Field
            label="Amount (INR ₹)"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
            error={fields.amount_minor}
            helpText="Entered in rupees; converted to integer paise on submit."
            required
          />

          <Field
            label="Payment date"
            type="date"
            max={todayIsoDate()}
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            error={fields.paid_on}
            required
          />

          <TextareaField
            label="Note / Reference"
            placeholder="UTR or reference note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={fields.note}
          />
        </form>
      )}
    </Modal>
  );
}
