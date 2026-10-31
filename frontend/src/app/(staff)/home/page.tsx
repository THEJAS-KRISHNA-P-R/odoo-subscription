'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CalendarCheck2, PlusCircle, CreditCard, AlertTriangle } from 'lucide-react';
import { api, createIdempotencyKey } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useList } from '@/lib/useList';
import { useCan } from '@/lib/meta';
import { useRouter } from '@/lib/router';
import { currentMonthRange, formatMinor, todayIsoDate } from '@/lib/money';
import { BillingRunResult, Invoice, ReportSummary, Subscription } from '@/lib/types';
import { BentoHero } from '@/components/ui/BentoHero';
import { BentoMetric } from '@/components/ui/BentoMetric';
import { CircleAction } from '@/components/ui/CircleAction';
import { DashedActionCard } from '@/components/ui/DashedActionCard';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { DataList } from '@/components/ui/DataList';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pill } from '@/components/ui/Pill';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { NewSubscriptionModal } from '@/components/domain/NewSubscriptionModal';
import { RecordPaymentModal } from '@/components/domain/RecordPaymentModal';
import { InvoiceDrawer } from '@/components/domain/InvoiceDrawer';
import { SubscriptionDrawer } from '@/components/domain/SubscriptionDrawer';

export default function StaffHomePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const canRunBilling = useCan('billing.run');

  const monthBounds = useMemo(() => currentMonthRange(), []);

  // Parallel requests for Home screen:
  // 1. /reports/summary for current month
  // 2. /invoices?limit=5 for recent invoices
  const summaryReq = useApi<ReportSummary>(
    `/reports/summary?from=${monthBounds.from}&to=${monthBounds.to}`
  );
  const recentInvoices = useList<Invoice>('/invoices', undefined, 5);

  // Billing Run modal state
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [asOfDate, setAsOfDate] = useState(todayIsoDate());
  const [billingRunning, setBillingRunning] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Quick action modals & drawers
  const [newSubOpen, setNewSubOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | string | null>(null);
  const [createdSubId, setCreatedSubId] = useState<number | string | null>(null);

  useEffect(() => {
    if (billingModalOpen) {
      setIdempotencyKey(createIdempotencyKey());
      setDryRun(false);
      setAsOfDate(todayIsoDate());
    }
  }, [billingModalOpen]);

  const handleRunBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingRunning(true);
    try {
      const res = await api.post<BillingRunResult>(
        '/billing/run',
        {
          as_of: asOfDate || undefined,
          dry_run: dryRun,
        },
        { idempotencyKey }
      );
      showToast(
        `${dryRun ? 'Dry run' : 'Billing'} complete: ${res.created} created · ${res.skipped} skipped · ${res.closed} closed`,
        'success'
      );
      setBillingModalOpen(false);
      await Promise.all([summaryReq.reload(), recentInvoices.reset()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Billing run failed', 'error');
    } finally {
      setBillingRunning(false);
    }
  };

  return (
    <div className="space-y-[40px]">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
          Overview
        </h1>
        <CircleAction
          label="Quick create subscription"
          onClick={() => setNewSubOpen(true)}
        />
      </div>

      {/* 1. Yellow BentoHero: Run today's billing */}
      <BentoHero
        tone="yellow"
        title="Run today's billing"
        subtitle="Generate invoices for all active subscriptions due up to today and auto-close expired plans."
        icon={<CalendarCheck2 className="w-8 h-8 text-[var(--hero-yellow-fg)]" />}
        action={
          canRunBilling ? (
            <Pill variant="primary" onClick={() => setBillingModalOpen(true)}>
              Run today&apos;s billing
            </Pill>
          ) : undefined
        }
      />

      {/* 2. Four BentoMetric cards from /reports/summary */}
      <section aria-label="Monthly summary metrics" className="space-y-4">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          This month&apos;s performance
        </h2>
        {summaryReq.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} rows={1} heightClass="h-[132px]" />
            ))}
          </div>
        ) : summaryReq.error ? (
          <ErrorState message={summaryReq.error.message} onRetry={summaryReq.reload} />
        ) : summaryReq.data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <BentoMetric
              label="Active subscriptions"
              value={summaryReq.data.active_subscriptions}
              hint="Currently billing"
            />
            <BentoMetric
              label="Revenue this month"
              value={formatMinor(summaryReq.data.revenue_minor)}
              hint={`${monthBounds.from} to ${monthBounds.to}`}
            />
            <BentoMetric
              label="Outstanding"
              value={formatMinor(summaryReq.data.outstanding_minor)}
              hint="Awaiting collection"
            />
            <BentoMetric
              label="Overdue"
              value={formatMinor(summaryReq.data.overdue_minor)}
              hint={`${summaryReq.data.overdue_count} overdue invoices`}
            />
          </div>
        ) : null}
      </section>

      {/* 3. Three DashedActionCards */}
      <section aria-label="Quick workflows" className="space-y-4">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashedActionCard
            icon={<PlusCircle className="w-5 h-5" />}
            title="New subscription"
            description="Create a subscription from a plan or template"
            onClick={() => setNewSubOpen(true)}
          />
          <DashedActionCard
            icon={<CreditCard className="w-5 h-5" />}
            title="Record payment"
            description="Apply a payment against an unpaid invoice"
            onClick={() => setRecordPaymentOpen(true)}
          />
          <DashedActionCard
            icon={<AlertTriangle className="w-5 h-5" />}
            title="View overdue"
            description="Review and follow up on past-due invoices"
            onClick={() => router.push('/invoices?overdue=true')}
          />
        </div>
      </section>

      {/* 4. Recent invoices (5 GroupedRows from /invoices?limit=5) */}
      <section aria-label="Recent invoices" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Recent invoices
          </h2>
          <Pill variant="outline" size="sm" onClick={() => router.push('/invoices')}>
            View all
          </Pill>
        </div>

        <DataList<Invoice>
          items={recentInvoices.items}
          loading={recentInvoices.loading}
          error={recentInvoices.error}
          onRetry={recentInvoices.reset}
          emptyTitle="No invoices yet. Run today's billing to generate due invoices."
          emptyActionLabel={canRunBilling ? "Run today's billing" : undefined}
          onEmptyAction={canRunBilling ? () => setBillingModalOpen(true) : undefined}
          renderItem={(inv) => (
            <GroupedRow
              key={inv.id}
              onClick={() => setSelectedInvoiceId(inv.id)}
              ariaLabel={`Open invoice ${inv.number}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
                    {inv.number}
                  </span>
                  <span className="text-[14px] text-[var(--text-secondary)] truncate">
                    {inv.customer_name}
                  </span>
                  <StatusBadge status={inv.status} />
                  {inv.is_overdue && <StatusBadge status="overdue" label="Overdue" />}
                </div>
                <div className="flex items-center gap-6 text-[14px] sm:justify-end">
                  <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
                    Due {inv.due_date}
                  </span>
                  <span className="font-bold text-[var(--text-primary)] tabular-nums">
                    {formatMinor(inv.total_minor)}
                  </span>
                </div>
              </div>
            </GroupedRow>
          )}
        />
      </section>

      {/* Run Billing Modal */}
      <Modal
        open={billingModalOpen}
        onClose={() => setBillingModalOpen(false)}
        title="Run today's billing"
        subtitle="Execute the billing engine for due subscription periods."
        footer={
          <>
            <Pill variant="ghost" onClick={() => setBillingModalOpen(false)} disabled={billingRunning}>
              Cancel
            </Pill>
            <Pill
              type="submit"
              form="billing-run-form"
              variant="primary"
              loading={billingRunning}
            >
              {dryRun ? 'Run preview (dry run)' : 'Execute billing run'}
            </Pill>
          </>
        }
      >
        <form id="billing-run-form" onSubmit={handleRunBilling} className="space-y-4">
          <Field
            label="Billing as-of date"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            required
          />
          <label className="flex items-start gap-3 p-4 rounded-[16px] bg-[var(--bg-surface)] cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[var(--brand-dark)]"
            />
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                Preview (dry run)
              </div>
              <div className="text-[13px] text-[var(--text-secondary)]">
                Calculate how many invoices would be created, skipped, or closed without committing changes.
              </div>
            </div>
          </label>
        </form>
      </Modal>

      <NewSubscriptionModal
        open={newSubOpen}
        onClose={() => setNewSubOpen(false)}
        onCreated={(sub: Subscription) => {
          void summaryReq.reload();
          setCreatedSubId(sub.id);
        }}
      />

      <RecordPaymentModal
        open={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        onSuccess={() => {
          void summaryReq.reload();
          void recentInvoices.reset();
        }}
      />

      <InvoiceDrawer
        invoiceId={selectedInvoiceId}
        open={selectedInvoiceId !== null}
        onClose={() => setSelectedInvoiceId(null)}
        onUpdated={() => {
          void summaryReq.reload();
          void recentInvoices.reset();
        }}
      />

      <SubscriptionDrawer
        subscriptionId={createdSubId}
        open={createdSubId !== null}
        onClose={() => setCreatedSubId(null)}
        onUpdated={() => {
          void summaryReq.reload();
        }}
      />
    </div>
  );
}
