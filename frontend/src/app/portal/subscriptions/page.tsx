'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { formatMinor } from '@/lib/money';
import { Subscription } from '@/lib/types';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pill } from '@/components/ui/Pill';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

export default function PortalSubscriptionsPage() {
  const { showToast } = useToast();
  const list = useList<Subscription>('/me/subscriptions');

  const [confirmCloseSub, setConfirmCloseSub] = useState<Subscription | null>(null);
  const [pendingId, setPendingId] = useState<number | string | null>(null);

  const handleTransition = async (sub: Subscription, toStatus: string) => {
    setPendingId(sub.id);
    try {
      await api.post(`/me/subscriptions/${sub.id}/transition`, { to: toStatus });
      showToast(`Subscription updated to ${toStatus}`, 'success');
      setConfirmCloseSub(null);
      await list.reset();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
          My subscriptions
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">
          View your active plans, upcoming billing dates, and manage subscription status
        </p>
      </div>

      <DataList<Subscription>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="You have no subscriptions on record."
        renderItem={(sub) => {
          const allowed = sub.allowed_actions || [];
          const canPause = allowed.includes('pause') || allowed.includes('paused');
          const canResume =
            sub.status === 'paused' && (allowed.includes('resume') || allowed.includes('active'));
          const canClose = allowed.includes('close') || allowed.includes('closed');
          const canRenew = allowed.includes('renew');
          const isBusy = pendingId === sub.id;

          return (
            <GroupedRow key={sub.id}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[15px] font-semibold text-[var(--text-primary)]">
                      {sub.plan_name}
                    </span>
                    <span className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                      · {sub.number}
                    </span>
                    <StatusBadge status={sub.status} />
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] tabular-nums">
                    Started {sub.start_date} · Next bill {sub.next_billing_date || '—'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[15px] font-bold text-[var(--text-primary)] tabular-nums mr-2">
                    {formatMinor(sub.totals?.total_minor ?? 0)}
                  </span>

                  {canPause && sub.status === 'active' && (
                    <Pill
                      variant="soft"
                      size="sm"
                      loading={isBusy}
                      onClick={() => handleTransition(sub, 'paused')}
                    >
                      Pause
                    </Pill>
                  )}
                  {canResume && (
                    <Pill
                      variant="primary"
                      size="sm"
                      loading={isBusy}
                      onClick={() => handleTransition(sub, 'active')}
                    >
                      Resume
                    </Pill>
                  )}
                  {canRenew && (
                    <Pill
                      variant="outline"
                      size="sm"
                      loading={isBusy}
                      onClick={() => handleTransition(sub, 'renew')}
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
                </div>
              </div>
            </GroupedRow>
          );
        }}
      />

      <ConfirmModal
        open={Boolean(confirmCloseSub)}
        onClose={() => setConfirmCloseSub(null)}
        title="Close subscription?"
        description={`Are you sure you want to close subscription ${confirmCloseSub?.number || ''}?`}
        confirmLabel="Close subscription"
        tone="danger"
        loading={pendingId !== null}
        onConfirm={() => {
          if (confirmCloseSub) {
            void handleTransition(confirmCloseSub, 'closed');
          }
        }}
      />
    </div>
  );
}
