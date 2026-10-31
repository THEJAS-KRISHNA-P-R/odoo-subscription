'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useCan, useEnum } from '@/lib/meta';
import { useList } from '@/lib/useList';
import { formatMinor } from '@/lib/money';
import { Payment } from '@/lib/types';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { Pill } from '@/components/ui/Pill';
import { RecordPaymentModal } from '@/components/domain/RecordPaymentModal';

export default function PaymentsPage() {
  const paymentMethods = useEnum('payment_method');
  const canRecordPayment = useCan('payment.record');

  const [methodFilter, setMethodFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);

  const list = useList<Payment>('/payments', {
    method: methodFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Payments
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            View recorded customer receipts and settle confirmed invoices
          </p>
        </div>
        {canRecordPayment && (
          <Pill variant="primary" onClick={() => setRecordOpen(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Record payment</span>
          </Pill>
        )}
      </div>

      <FilterToolbar
        statusOptions={paymentMethods}
        activeStatus={methodFilter}
        onStatusChange={setMethodFilter}
        rightSlot={
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="From date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-[42px] px-3 rounded-full bg-[var(--bg-surface)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
            <span className="text-[12px] text-[var(--text-muted)]">to</span>
            <input
              type="date"
              aria-label="To date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-[42px] px-3 rounded-full bg-[var(--bg-surface)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>
        }
      />

      <DataList<Payment>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="No payments recorded for the selected filters."
        emptyActionLabel={canRecordPayment ? 'Record payment' : undefined}
        onEmptyAction={canRecordPayment ? () => setRecordOpen(true) : undefined}
        renderItem={(pmt) => (
          <GroupedRow key={pmt.id}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {pmt.customer_name}
                  </span>
                  <span className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                    · Invoice {pmt.invoice_number}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]">
                    {pmt.method}
                  </span>
                </div>
                {pmt.note && (
                  <div className="text-[12px] text-[var(--text-muted)]">{pmt.note}</div>
                )}
              </div>

              <div className="flex items-center gap-6 text-[14px] sm:justify-end">
                <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
                  Paid {pmt.paid_on}
                </span>
                <span className="font-bold text-[var(--text-primary)] tabular-nums">
                  {formatMinor(pmt.amount_minor)}
                </span>
              </div>
            </div>
          </GroupedRow>
        )}
      />

      <RecordPaymentModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onSuccess={() => {
          void list.reset();
        }}
      />
    </div>
  );
}
