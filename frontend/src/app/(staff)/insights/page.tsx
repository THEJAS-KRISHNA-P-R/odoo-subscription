'use client';

import React, { useState, useMemo } from 'react';
import { Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useList } from '@/lib/useList';
import { currentMonthRange, formatMinor, todayIsoDate } from '@/lib/money';
import { MonthlyRevenue, OverdueInvoice, ReportSummary } from '@/lib/types';
import { BentoMetric } from '@/components/ui/BentoMetric';
import { BarSeries } from '@/components/ui/BarSeries';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pill } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { InvoiceDrawer } from '@/components/domain/InvoiceDrawer';

type RangePreset = 'this_month' | 'last_month' | 'last_3_months' | 'custom';

function computeRangeDates(preset: RangePreset): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === 'this_month') {
    return currentMonthRange();
  }
  if (preset === 'last_month') {
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const fy = first.getFullYear();
    const fm = String(first.getMonth() + 1).padStart(2, '0');
    const ld = String(last.getDate()).padStart(2, '0');
    return { from: `${fy}-${fm}-01`, to: `${fy}-${fm}-${ld}` };
  }
  const first3 = new Date(year, month - 2, 1);
  const lastNow = new Date(year, month + 1, 0);
  const fy = first3.getFullYear();
  const fm = String(first3.getMonth() + 1).padStart(2, '0');
  const ty = lastNow.getFullYear();
  const tm = String(lastNow.getMonth() + 1).padStart(2, '0');
  const td = String(lastNow.getDate()).padStart(2, '0');
  return { from: `${fy}-${fm}-01`, to: `${ty}-${tm}-${td}` };
}

export default function InsightsPage() {
  const { showToast } = useToast();
  const initialRange = useMemo(() => currentMonthRange(), []);
  const [preset, setPreset] = useState<RangePreset>('this_month');
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<number | string | null>(null);

  const handleSelectPreset = (next: RangePreset) => {
    setPreset(next);
    if (next !== 'custom') {
      const range = computeRangeDates(next);
      setFromDate(range.from);
      setToDate(range.to);
    }
  };

  const summaryReq = useApi<ReportSummary>(
    `/reports/summary?from=${fromDate}&to=${toDate}`
  );
  const monthlyReq = useApi<{ items: MonthlyRevenue[] }>(
    `/reports/revenue-by-month?from=${fromDate}&to=${toDate}`
  );
  const overdueList = useList<OverdueInvoice>('/reports/overdue');

  const chartData = useMemo(() => {
    const items = monthlyReq.data?.items || [];
    return items.map((m) => ({
      label: m.month,
      valueMinor: m.revenue_minor,
    }));
  }, [monthlyReq.data]);

  const handleSendOverdueReminder = async (
    e: React.MouseEvent,
    invoiceId: number | string,
    invoiceNumber: string
  ) => {
    e.stopPropagation();
    setSendingReminderId(invoiceId);
    try {
      await api.post(`/invoices/${invoiceId}/send`);
      showToast(`Reminder sent for ${invoiceNumber}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send reminder', 'error');
    } finally {
      setSendingReminderId(null);
    }
  };

  const rangePills: Array<{ key: RangePreset; label: string }> = [
    { key: 'this_month', label: 'This month' },
    { key: 'last_month', label: 'Last month' },
    { key: 'last_3_months', label: 'Last 3 months' },
    { key: 'custom', label: 'Custom dates' },
  ];

  return (
    <div className="space-y-[40px]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Insights
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Financial performance, monthly revenue series, invoice breakdown, and overdue aging
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {rangePills.map((rp) => (
            <button
              key={rp.key}
              type="button"
              onClick={() => handleSelectPreset(rp.key)}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold cursor-pointer transition-colors ${
                preset === rp.key
                  ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {rp.label}
            </button>
          ))}
        </div>
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-surface)] p-4 rounded-[16px]">
          <label className="text-[12px] font-semibold text-[var(--text-secondary)]">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="ml-2 h-[38px] px-3 rounded-[10px] bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-hair)] text-[13px]"
            />
          </label>
          <label className="text-[12px] font-semibold text-[var(--text-secondary)]">
            To
            <input
              type="date"
              max={todayIsoDate()}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="ml-2 h-[38px] px-3 rounded-[10px] bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-hair)] text-[13px]"
            />
          </label>
        </div>
      )}

      {/* Summary Bento */}
      <section aria-label="Summary metrics" className="space-y-4">
        {summaryReq.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} rows={1} heightClass="h-[132px]" />
            ))}
          </div>
        ) : summaryReq.error ? (
          <ErrorState message={summaryReq.error.message} onRetry={summaryReq.reload} />
        ) : summaryReq.data ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <BentoMetric
                label="Active subscriptions"
                value={summaryReq.data.active_subscriptions}
              />
              <BentoMetric
                label="Recognized revenue"
                value={formatMinor(summaryReq.data.revenue_minor)}
              />
              <BentoMetric
                label="Outstanding balance"
                value={formatMinor(summaryReq.data.outstanding_minor)}
              />
              <BentoMetric
                label="Overdue total"
                value={formatMinor(summaryReq.data.overdue_minor)}
                hint={`${summaryReq.data.overdue_count} overdue invoices`}
              />
            </div>

            {/* Invoice status breakdown */}
            {summaryReq.data.invoices && (
              <div className="bg-[var(--bg-surface)] rounded-[24px] p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <StatusBadge status="draft" label="Draft" />
                  <div className="text-[24px] font-bold mt-2 tabular-nums">
                    {summaryReq.data.invoices.draft}
                  </div>
                </div>
                <div>
                  <StatusBadge status="confirmed" label="Confirmed" />
                  <div className="text-[24px] font-bold mt-2 tabular-nums">
                    {summaryReq.data.invoices.confirmed}
                  </div>
                </div>
                <div>
                  <StatusBadge status="paid" label="Paid" />
                  <div className="text-[24px] font-bold mt-2 tabular-nums">
                    {summaryReq.data.invoices.paid}
                  </div>
                </div>
                <div>
                  <StatusBadge status="cancelled" label="Cancelled" />
                  <div className="text-[24px] font-bold mt-2 tabular-nums">
                    {summaryReq.data.invoices.cancelled}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* Revenue by month SVG BarSeries */}
      <section aria-label="Monthly revenue" className="space-y-4">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Revenue by month
        </h2>
        {monthlyReq.loading ? (
          <Skeleton rows={1} heightClass="h-[260px]" />
        ) : monthlyReq.error ? (
          <ErrorState message={monthlyReq.error.message} onRetry={monthlyReq.reload} />
        ) : (
          <BarSeries data={chartData} />
        )}
      </section>

      {/* Overdue aging list */}
      <section aria-label="Overdue invoices" className="space-y-4">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Overdue invoices
        </h2>
        <DataList<OverdueInvoice>
          items={overdueList.items}
          loading={overdueList.loading}
          loadingMore={overdueList.loadingMore}
          error={overdueList.error}
          onRetry={overdueList.reset}
          nextCursor={overdueList.nextCursor}
          onLoadMore={overdueList.loadMore}
          emptyTitle="No overdue invoices. All confirmed invoices are within payment terms."
          renderItem={(item) => (
            <GroupedRow
              key={item.invoice_id}
              onClick={() => setSelectedInvoiceId(item.invoice_id)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
                    {item.number}
                  </span>
                  <span className="text-[14px] text-[var(--text-secondary)]">
                    {item.customer_name}
                  </span>
                  <StatusBadge status="overdue" label={`${item.days_late} days late`} />
                </div>
                <div className="flex items-center gap-4 text-[14px]">
                  <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
                    Due {item.due_date}
                  </span>
                  <span className="font-bold text-[var(--danger-fg)] tabular-nums">
                    {formatMinor(item.outstanding_minor)}
                  </span>
                  <Pill
                    variant="outline"
                    size="sm"
                    loading={sendingReminderId === item.invoice_id}
                    onClick={(e) =>
                      handleSendOverdueReminder(e, item.invoice_id, item.number)
                    }
                  >
                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Send reminder</span>
                  </Pill>
                </div>
              </div>
            </GroupedRow>
          )}
        />
      </section>

      <InvoiceDrawer
        invoiceId={selectedInvoiceId}
        open={selectedInvoiceId !== null}
        onClose={() => setSelectedInvoiceId(null)}
        onUpdated={() => {
          void summaryReq.reload();
          void overdueList.reset();
        }}
      />
    </div>
  );
}
