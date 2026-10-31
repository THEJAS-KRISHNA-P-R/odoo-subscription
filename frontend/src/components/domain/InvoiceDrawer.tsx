'use client';

import React, { useState } from 'react';
import { Printer, Send, CheckCircle, Ban, CreditCard, FileDown, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useCan } from '@/lib/meta';
import { useOrgSettings } from '@/lib/orgSettings';
import { formatMinor, formatBpToPercent } from '@/lib/money';
import { Invoice } from '@/lib/types';
import { Drawer, DrawerSection } from '@/components/ui/Drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pill } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { RecordPaymentModal } from './RecordPaymentModal';

export interface InvoiceDrawerProps {
  invoiceId: number | string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  mode?: 'staff' | 'portal';
}

const INVOICE_STEPS: Array<{ key: string; label: string }> = [
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'paid', label: 'Paid' },
];

export function InvoiceDrawer({
  invoiceId,
  open,
  onClose,
  onUpdated,
  mode = 'staff',
}: InvoiceDrawerProps) {
  const { showToast } = useToast();
  const canRecordPayment = useCan('payment.record');
  const { settings: org } = useOrgSettings();

  const endpoint =
    open && invoiceId !== null
      ? mode === 'portal'
        ? `/me/invoices/${invoiceId}`
        : `/invoices/${invoiceId}`
      : null;

  const { data: invoice, loading, error, reload } = useApi<Invoice>(endpoint);

  const [actionPending, setActionPending] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'details' | 'pdf'>('details');

  const runInvoiceAction = async (action: 'confirm' | 'cancel' | 'send') => {
    if (!invoice) return;
    setActionPending(action);
    try {
      await api.post(`/invoices/${invoice.id}/${action}`);
      showToast(
        action === 'confirm'
          ? 'Invoice confirmed'
          : action === 'cancel'
          ? 'Invoice cancelled'
          : 'Invoice sent to customer',
        'success'
      );
      setConfirmCancelOpen(false);
      await reload();
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to ${action} invoice`, 'error');
    } finally {
      setActionPending(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setActionPending('pdf');
    try {
      const pdfPath =
        mode === 'portal'
          ? `/me/invoices/${invoice.id}?format=pdf`
          : `/invoices/${invoice.id}?format=pdf`;
      await api.download(pdfPath, `invoice-${invoice.number}.pdf`);
      showToast(`Downloaded ${invoice.number}.pdf`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF download failed', 'error');
    } finally {
      setActionPending(null);
    }
  };

  const handlePrintPdf = () => {
    setViewMode('pdf');
    requestAnimationFrame(() => {
      window.print();
    });
  };

  const isDraft = invoice?.status === 'draft';
  const isConfirmed = invoice?.status === 'confirmed';
  const currentStepIdx = invoice
    ? INVOICE_STEPS.findIndex((s) => s.key === invoice.status)
    : -1;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={invoice ? `Invoice ${invoice.number}` : 'Invoice details'}
        badge={
          invoice ? (
            <div className="flex items-center gap-2">
              <StatusBadge status={invoice.status} />
              {invoice.is_overdue && <StatusBadge status="overdue" label="Overdue" />}
            </div>
          ) : undefined
        }
        footer={
          invoice ? (
            <>
              <Pill
                variant="outline"
                size="sm"
                loading={actionPending === 'pdf'}
                onClick={handleDownloadPdf}
              >
                <FileDown className="w-4 h-4" aria-hidden="true" />
                <span>Download PDF</span>
              </Pill>

              <Pill variant="outline" size="sm" onClick={handlePrintPdf}>
                <Printer className="w-4 h-4" aria-hidden="true" />
                <span>Print A4</span>
              </Pill>

              {mode === 'staff' && isDraft && (
                <Pill
                  variant="soft"
                  size="sm"
                  loading={actionPending === 'confirm'}
                  onClick={() => runInvoiceAction('confirm')}
                >
                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Confirm</span>
                </Pill>
              )}

              {mode === 'staff' && (isDraft || isConfirmed) && (
                <Pill
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmCancelOpen(true)}
                >
                  <Ban className="w-4 h-4" aria-hidden="true" />
                  <span>Cancel</span>
                </Pill>
              )}

              {mode === 'staff' && isConfirmed && (
                <Pill
                  variant="outline"
                  size="sm"
                  loading={actionPending === 'send'}
                  onClick={() => runInvoiceAction('send')}
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>Send</span>
                </Pill>
              )}

              {mode === 'staff' && isConfirmed && canRecordPayment && invoice.outstanding_minor > 0 && (
                <Pill
                  variant="primary"
                  size="sm"
                  onClick={() => setRecordPaymentOpen(true)}
                >
                  <CreditCard className="w-4 h-4" aria-hidden="true" />
                  <span>Record payment</span>
                </Pill>
              )}
            </>
          ) : undefined
        }
      >
        {loading ? (
          <div className="p-8">
            <Skeleton rows={5} />
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorState message={error.message} onRetry={reload} />
          </div>
        ) : invoice ? (
          <>
            {/* View Mode Toggle: Standard Details vs Branded A4 PDF Invoice Sheet */}
            <div className="px-[28px] pt-4 pb-2 flex items-center justify-between border-b border-[var(--border-faint)] no-print">
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--bg-surface)]">
                <button
                  type="button"
                  onClick={() => setViewMode('details')}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer ${
                    viewMode === 'details'
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Invoice details
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('pdf')}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === 'pdf'
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>PDF Tax Invoice</span>
                </button>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                Branded with Company Settings
              </span>
            </div>

            {viewMode === 'pdf' ? (
              <div className="p-6">
                <div className="bg-[var(--bg-card)] border border-[var(--border-hair)] rounded-[20px] p-7 space-y-6 shadow-[var(--shadow-diffuse)]">
                  {/* Branded PDF Invoice Header with Company Logo */}
                  <div className="flex items-start justify-between gap-4 pb-6 border-b border-[var(--border-faint)]">
                    <div className="flex items-start gap-3.5">
                      {org.logoDataUrl ? (
                        <img
                          src={org.logoDataUrl}
                          alt={`${org.companyName || 'Company'} logo`}
                          className="w-12 h-12 rounded-[12px] object-contain bg-[var(--bg-surface)] p-1.5 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] font-bold text-[20px] flex items-center justify-center shrink-0">
                          {(org.companyName || 'Brightloop').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <div className="text-[18px] font-bold text-[var(--text-primary)]">
                          {org.companyName || 'Brightloop'}
                        </div>
                        {org.gstin && (
                          <div className="text-[12px] text-[var(--text-secondary)] font-mono">
                            GSTIN: {org.gstin}
                          </div>
                        )}
                        {org.supportEmail && (
                          <div className="text-[12px] text-[var(--text-muted)]">
                            {org.supportEmail}
                          </div>
                        )}
                        {org.billingAddress && (
                          <div className="text-[12px] text-[var(--text-muted)] max-w-[240px] whitespace-pre-line">
                            {org.billingAddress}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Tax Invoice
                      </div>
                      <div className="text-[18px] font-bold text-[var(--text-primary)] tabular-nums">
                        {invoice.number}
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] tabular-nums">
                        Issued: {invoice.issue_date}
                      </div>
                      <div className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">
                        Due: {invoice.due_date}
                      </div>
                    </div>
                  </div>

                  {/* Bill To & Period */}
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                        Billed To
                      </div>
                      <div className="font-semibold text-[15px] text-[var(--text-primary)] mt-1">
                        {invoice.customer_name}
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                        Subscription: {invoice.subscription_number || `#${invoice.subscription_id}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                        Service Period
                      </div>
                      <div className="text-[13px] font-medium text-[var(--text-primary)] mt-1 tabular-nums">
                        {invoice.period_start} → {invoice.period_end}
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="border-t border-b border-[var(--border-faint)] py-4 space-y-3">
                    <div className="grid grid-cols-12 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)] pb-2 border-b border-[var(--border-faint)]">
                      <div className="col-span-6">Description</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Tax</div>
                      <div className="col-span-2 text-right">Amount</div>
                    </div>
                    {invoice.lines && invoice.lines.length > 0 ? (
                      invoice.lines.map((line, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-12 items-center text-[13px] py-1 print-row"
                        >
                          <div className="col-span-6 pr-2">
                            <div className="font-medium text-[var(--text-primary)]">
                              {line.description}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                              {formatMinor(line.unit_price_minor)} / unit
                            </div>
                          </div>
                          <div className="col-span-2 text-right tabular-nums text-[var(--text-secondary)]">
                            {line.quantity}
                          </div>
                          <div className="col-span-2 text-right tabular-nums text-[var(--text-secondary)]">
                            {line.tax_rate_bp > 0 ? formatBpToPercent(line.tax_rate_bp) : '0%'}
                          </div>
                          <div className="col-span-2 text-right font-semibold tabular-nums text-[var(--text-primary)]">
                            {formatMinor(line.amount_minor)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[12px] text-[var(--text-muted)] py-2">
                        No line items recorded.
                      </div>
                    )}
                  </div>

                  {/* Totals Summary */}
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatMinor(invoice.subtotal_minor)}</span>
                    </div>
                    {invoice.discount_minor > 0 && (
                      <div className="flex justify-between text-[var(--brand-dark)]">
                        <span>Discount</span>
                        <span className="tabular-nums">-{formatMinor(invoice.discount_minor)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Tax (GST)</span>
                      <span className="tabular-nums">{formatMinor(invoice.tax_minor)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[16px] text-[var(--text-primary)] pt-2 border-t border-[var(--border-faint)]">
                      <span>Total Due</span>
                      <span className="tabular-nums">{formatMinor(invoice.total_minor)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Paid to Date</span>
                      <span className="tabular-nums">{formatMinor(invoice.paid_minor)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-[var(--text-primary)]">
                      <span>Balance Outstanding</span>
                      <span className="tabular-nums">{formatMinor(invoice.outstanding_minor)}</span>
                    </div>
                  </div>

                  {org.invoiceFooterNote && (
                    <div className="pt-4 border-t border-[var(--border-faint)] text-[12px] text-[var(--text-muted)] whitespace-pre-line">
                      {org.invoiceFooterNote}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {invoice.status !== 'cancelled' && (
                  <DrawerSection title="Invoice stage">
                    <div className="flex items-center justify-between gap-2" role="list" aria-label="Invoice lifecycle">
                      {INVOICE_STEPS.map((step, idx) => {
                        const isCurrent = invoice.status === step.key;
                        const isCompleted = currentStepIdx > idx;
                        return (
                          <div
                            key={step.key}
                            role="listitem"
                            className="flex-1 flex flex-col items-center gap-1.5"
                          >
                            <div
                              className={`w-full h-1.5 rounded-full transition-colors ${
                                isCurrent
                                  ? 'bg-[var(--brand-primary)]'
                                  : isCompleted
                                  ? 'bg-[var(--brand-dark)]'
                                  : 'bg-[var(--bg-surface)]'
                              }`}
                            />
                            <span
                              className={`text-[11px] font-semibold tracking-[0.02em] ${
                                isCurrent
                                  ? 'text-[var(--text-primary)]'
                                  : isCompleted
                                  ? 'text-[var(--text-secondary)]'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </DrawerSection>
                )}

                <DrawerSection title="Summary">
                  <div className="grid grid-cols-2 gap-4 text-[14px]">
                    <div>
                      <div className="text-[12px] text-[var(--text-muted)]">Customer</div>
                      <div className="font-semibold text-[var(--text-primary)]">
                        {invoice.customer_name}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] text-[var(--text-muted)]">Subscription</div>
                      <div className="font-semibold text-[var(--text-primary)]">
                        {invoice.subscription_number || `#${invoice.subscription_id}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] text-[var(--text-muted)]">Billing period</div>
                      <div className="text-[var(--text-secondary)] tabular-nums">
                        {invoice.period_start} → {invoice.period_end}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] text-[var(--text-muted)]">Issue / Due date</div>
                      <div className="text-[var(--text-secondary)] tabular-nums">
                        {invoice.issue_date} · Due {invoice.due_date}
                      </div>
                    </div>
                  </div>
                </DrawerSection>

                <DrawerSection title="Line items">
                  {invoice.lines && invoice.lines.length > 0 ? (
                    <div className="space-y-3">
                      {invoice.lines.map((line, i) => (
                        <div
                          key={i}
                          className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border-faint)] last:border-b-0 print-row"
                        >
                          <div>
                            <div className="text-[14px] font-medium text-[var(--text-primary)]">
                              {line.description}
                            </div>
                            <div className="text-[12px] text-[var(--text-muted)] tabular-nums">
                              Qty {line.quantity} × {formatMinor(line.unit_price_minor)}
                              {line.tax_rate_bp > 0 && ` · Tax ${formatBpToPercent(line.tax_rate_bp)}`}
                            </div>
                          </div>
                          <div className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
                            {formatMinor(line.amount_minor)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[var(--text-muted)]">No line items recorded.</p>
                  )}
                </DrawerSection>

                {invoice.discounts && invoice.discounts.length > 0 && (
                  <DrawerSection title="Applied discounts">
                    <div className="space-y-2">
                      {invoice.discounts.map((d, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[13px]">
                          <span className="text-[var(--text-secondary)]">{d.name}</span>
                          <span className="font-semibold text-[var(--brand-dark)] tabular-nums">
                            -{formatMinor(d.amount_minor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </DrawerSection>
                )}

                <DrawerSection title="Totals">
                  <div className="space-y-2 text-[14px]">
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatMinor(invoice.subtotal_minor)}</span>
                    </div>
                    {invoice.discount_minor > 0 && (
                      <div className="flex justify-between text-[var(--brand-dark)]">
                        <span>Discount</span>
                        <span className="tabular-nums">-{formatMinor(invoice.discount_minor)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Tax</span>
                      <span className="tabular-nums">{formatMinor(invoice.tax_minor)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[16px] text-[var(--text-primary)] pt-2 border-t border-[var(--border-faint)]">
                      <span>Total</span>
                      <span className="tabular-nums">{formatMinor(invoice.total_minor)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Paid</span>
                      <span className="tabular-nums">{formatMinor(invoice.paid_minor)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-[var(--text-primary)]">
                      <span>Outstanding</span>
                      <span className="tabular-nums">{formatMinor(invoice.outstanding_minor)}</span>
                    </div>
                  </div>
                </DrawerSection>

                <DrawerSection title="Payments">
                  {invoice.payments && invoice.payments.length > 0 ? (
                    <div className="space-y-2.5">
                      {invoice.payments.map((pmt) => (
                        <div
                          key={pmt.id}
                          className="flex items-center justify-between text-[13px] py-1.5 border-b border-[var(--border-faint)] last:border-b-0"
                        >
                          <div>
                            <div className="font-semibold text-[var(--text-primary)] uppercase">
                              {pmt.method}
                            </div>
                            <div className="text-[12px] text-[var(--text-muted)]">
                              {pmt.paid_on} {pmt.note ? `· ${pmt.note}` : ''}
                            </div>
                          </div>
                          <div className="font-semibold text-[var(--text-primary)] tabular-nums">
                            {formatMinor(pmt.amount_minor)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[var(--text-muted)]">
                      No payments recorded against this invoice yet.
                    </p>
                  )}
                </DrawerSection>
              </>
            )}
          </>
        ) : null}
      </Drawer>

      <ConfirmModal
        open={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        title="Cancel invoice?"
        description={`Are you sure you want to cancel invoice ${invoice?.number || ''}? This action cannot be undone.`}
        confirmLabel="Cancel invoice"
        tone="danger"
        loading={actionPending === 'cancel'}
        onConfirm={() => runInvoiceAction('cancel')}
      />

      <RecordPaymentModal
        open={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        preselectedInvoice={invoice}
        onSuccess={async () => {
          await reload();
          if (onUpdated) onUpdated();
        }}
      />
    </>
  );
}
