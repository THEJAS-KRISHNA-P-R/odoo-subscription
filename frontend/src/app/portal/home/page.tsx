'use client';

import React, { useState, useMemo } from 'react';
import { ReceiptText } from 'lucide-react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { formatMinor } from '@/lib/money';
import { Invoice, Subscription } from '@/lib/types';
import { BentoHero } from '@/components/ui/BentoHero';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pill } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { InvoiceDrawer } from '@/components/domain/InvoiceDrawer';

export default function PortalHomePage() {
  const { showToast } = useToast();

  const invoices = useList<Invoice>('/me/invoices', undefined, 25);
  const subscriptions = useList<Subscription>('/me/subscriptions', undefined, 25);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | string | null>(null);
  const [confirmCloseSub, setConfirmCloseSub] = useState<Subscription | null>(null);
  const [pendingSubId, setPendingSubId] = useState<number | string | null>(null);

  // Derive "Next invoice due" from /me/invoices (first confirmed unpaid sorted by due_date)
  const nextDueInvoice = useMemo(() => {
    const unpaidConfirmed = invoices.items.filter(
      (inv) => inv.status === 'confirmed' && inv.outstanding_minor > 0
    );
    if (unpaidConfirmed.length === 0) return null;
    return [...unpaidConfirmed].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  }, [invoices.items]);

  const handlePortalTransition = async (sub: Subscription, toStatus: string) => {
    setPendingSubId(sub.id);
    try {
      await api.post(`/me/subscriptions/${sub.id}/transition`, { to: toStatus });
      showToast(`Subscription updated to ${toStatus}`, 'success');
      setConfirmCloseSub(null);
      await subscriptions.reset();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update subscription', 'error');
    } finally {
      setPendingSubId(null);
    }
  };

  return (
    <div className="space-y-[40px]">
      <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
        Welcome to your billing portal
      </h1>

      {/* Blue BentoHero: Next invoice due */}
      {invoices.loading ? (
        <Skeleton rows={1} heightClass="h-[140px]" />
      ) : invoices.error ? (
        <ErrorState message={invoices.error.message} onRetry={invoices.reset} />
      ) : nextDueInvoice ? (
        <BentoHero
          tone="blue"
          title={`Next invoice due: ${formatMinor(nextDueInvoice.outstanding_minor)}`}
          subtitle={`Invoice ${nextDueInvoice.number} is due on ${nextDueInvoice.due_date}.`}
          icon={<ReceiptText className="w-8 h-8 text-[var(--hero-blue-fg)]" />}
          action={
            <Pill variant="primary" onClick={() => setSelectedInvoiceId(nextDueInvoice.id)}>
              View invoice
            </Pill>
          }
        />
      ) : (
        <BentoHero
          tone="blue"
          title="You're all caught up"
          subtitle="You have no unpaid confirmed invoices due right now."
          icon={<ReceiptText className="w-8 h-8 text-[var(--hero-blue-fg)]" />}
        />
      )}

      {/* Active Subscription Cards */}
      <section aria-label="My subscriptions" className="space-y-4">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          My subscriptions
        </h2>

        {subscriptions.loading ? (
          <Skeleton rows={3} heightClass="h-[120px]" />
        ) : subscriptions.error ? (
          <ErrorState message={subscriptions.error.message} onRetry={subscriptions.reset} />
        ) : subscriptions.items.length === 0 ? (
          <EmptyState message="You do not have any subscriptions yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {subscriptions.items.map((sub) => {
              const allowed = sub.allowed_actions || [];
              const canPause = allowed.includes('pause') || allowed.includes('paused');
              const canResume =
                sub.status === 'paused' &&
                (allowed.includes('resume') || allowed.includes('active'));
              const canClose = allowed.includes('close') || allowed.includes('closed');
              const canRenew = allowed.includes('renew');
              const isBusy = pendingSubId === sub.id;

              return (
                <div
                  key={sub.id}
                  className="bg-[var(--bg-surface)] rounded-[24px] p-7 flex flex-col justify-between gap-5"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[16px] font-semibold text-[var(--text-primary)]">
                        {sub.plan_name}
                      </span>
                      <StatusBadge status={sub.status} />
                    </div>
                    <div className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                      Subscription {sub.number} · Next bill {sub.next_billing_date || '—'}
                    </div>
                    <div className="text-[24px] font-bold text-[var(--text-primary)] pt-1 tabular-nums">
                      {formatMinor(sub.totals?.total_minor ?? 0)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-hair)]">
                    {canPause && sub.status === 'active' && (
                      <Pill
                        variant="soft"
                        size="sm"
                        loading={isBusy}
                        onClick={() => handlePortalTransition(sub, 'paused')}
                      >
                        Pause
                      </Pill>
                    )}
                    {canResume && (
                      <Pill
                        variant="primary"
                        size="sm"
                        loading={isBusy}
                        onClick={() => handlePortalTransition(sub, 'active')}
                      >
                        Resume
                      </Pill>
                    )}
                    {canRenew && (
                      <Pill
                        variant="outline"
                        size="sm"
                        loading={isBusy}
                        onClick={() => handlePortalTransition(sub, 'renew')}
                      >
                        Renew
                      </Pill>
                    )}
                    {canClose && sub.status !== 'closed' && (
                      <Pill
                        variant="danger"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setConfirmCloseSub(sub)}
                      >
                        Close
                      </Pill>
                    )}
                    {!canPause && !canResume && !canRenew && !canClose && (
                      <span className="text-[12px] text-[var(--text-muted)]">
                        Managed by support team
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <InvoiceDrawer
        invoiceId={selectedInvoiceId}
        open={selectedInvoiceId !== null}
        onClose={() => setSelectedInvoiceId(null)}
        mode="portal"
      />

      <ConfirmModal
        open={Boolean(confirmCloseSub)}
        onClose={() => setConfirmCloseSub(null)}
        title="Close subscription?"
        description={`Are you sure you want to close subscription ${confirmCloseSub?.number || ''}?`}
        confirmLabel="Close subscription"
        tone="danger"
        loading={pendingSubId !== null}
        onConfirm={() => {
          if (confirmCloseSub) {
            void handlePortalTransition(confirmCloseSub, 'closed');
          }
        }}
      />
    </div>
  );
}
