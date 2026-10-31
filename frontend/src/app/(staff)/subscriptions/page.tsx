'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useEnum } from '@/lib/meta';
import { useList } from '@/lib/useList';
import { formatMinor } from '@/lib/money';
import { Subscription } from '@/lib/types';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pill } from '@/components/ui/Pill';
import { SubscriptionDrawer } from '@/components/domain/SubscriptionDrawer';
import { NewSubscriptionModal } from '@/components/domain/NewSubscriptionModal';

export default function SubscriptionsPage() {
  const statusOptions = useEnum('subscription_status');

  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubId, setSelectedSubId] = useState<number | string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const list = useList<Subscription>('/subscriptions', {
    status: statusFilter || undefined,
    q: searchQuery || undefined,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Subscriptions
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Manage recurring customer plans, quotations, and lifecycle transitions
          </p>
        </div>
        <Pill variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>New subscription</span>
        </Pill>
      </div>

      <FilterToolbar
        statusOptions={statusOptions}
        activeStatus={statusFilter}
        onStatusChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search subscriptions…"
      />

      <DataList<Subscription>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="No subscriptions match the current filters."
        emptyActionLabel="New subscription"
        onEmptyAction={() => setCreateOpen(true)}
        renderItem={(sub) => (
          <GroupedRow
            key={sub.id}
            onClick={() => setSelectedSubId(sub.id)}
            ariaLabel={`Open subscription ${sub.number}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
                  {sub.number}
                </span>
                <span className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                  {sub.customer_name}
                </span>
                <span className="text-[13px] text-[var(--text-secondary)]">
                  · {sub.plan_name}
                </span>
                <StatusBadge status={sub.status} />
              </div>

              <div className="flex items-center gap-6 text-[14px] sm:justify-end">
                <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
                  {sub.next_billing_date ? `Next bill ${sub.next_billing_date}` : 'No upcoming bill'}
                </span>
                <span className="font-bold text-[var(--text-primary)] tabular-nums">
                  {formatMinor(sub.totals?.total_minor ?? 0)}
                </span>
              </div>
            </div>
          </GroupedRow>
        )}
      />

      <SubscriptionDrawer
        subscriptionId={selectedSubId}
        open={selectedSubId !== null}
        onClose={() => setSelectedSubId(null)}
        onUpdated={() => {
          void list.reset();
        }}
      />

      <NewSubscriptionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          void list.reset();
          setSelectedSubId(created.id);
        }}
      />
    </div>
  );
}
