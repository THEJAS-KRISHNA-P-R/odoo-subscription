'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useTransitions } from '@/lib/meta';
import { formatMinor, formatBpToPercent } from '@/lib/money';
import { Subscription, SubscriptionEvent } from '@/lib/types';
import { Drawer, DrawerSection } from '@/components/ui/Drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pill } from '@/components/ui/Pill';
import { Field } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

export interface SubscriptionDrawerProps {
  subscriptionId: number | string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  mode?: 'staff' | 'portal';
}

const TRANSITION_LABELS: Record<string, string> = {
  quotation: 'Send Quotation',
  confirmed: 'Confirm',
  active: 'Activate',
  paused: 'Pause',
  closed: 'Close',
};

const LIFECYCLE_STEPS: Array<{ key: string; label: string }> = [
  { key: 'draft', label: 'Draft' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Closed' },
];

export function SubscriptionDrawer({
  subscriptionId,
  open,
  onClose,
  onUpdated,
  mode = 'staff',
}: SubscriptionDrawerProps) {
  const { showToast } = useToast();
  const transitionsMap = useTransitions();

  const subPath =
    open && subscriptionId !== null
      ? mode === 'portal'
        ? null
        : `/subscriptions/${subscriptionId}`
      : null;

  const eventsPath =
    open && subscriptionId !== null && mode === 'staff'
      ? `/subscriptions/${subscriptionId}/events`
      : null;

  const { data: sub, loading, error, reload } = useApi<Subscription>(subPath);
  const { data: events, loading: eventsLoading } = useApi<SubscriptionEvent[]>(eventsPath);

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [transitionNote, setTransitionNote] = useState('');

  // Inline editing state for draft/quotation subscriptions
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editQuoteValidUntil, setEditQuoteValidUntil] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    if (sub) {
      setEditExpiryDate(sub.expiry_date || '');
      setEditQuoteValidUntil(sub.quote_valid_until || '');
      setIsEditingDraft(false);
    }
  }, [sub]);

  // Compute allowed transitions from GET /meta subscription_transitions and sub.allowed_actions
  const nextStatuses: string[] = React.useMemo(() => {
    if (!sub) return [];
    const fromMeta = transitionsMap[sub.status] || [];
    const allowedSet = Array.isArray(sub.allowed_actions) ? sub.allowed_actions : null;
    return fromMeta.filter((target) => {
      if (!allowedSet) return true;
      if (target === 'paused' && !allowedSet.includes('pause') && !allowedSet.includes('paused')) {
        return false;
      }
      if (target === 'closed' && !allowedSet.includes('close') && !allowedSet.includes('closed')) {
        return false;
      }
      return true;
    });
  }, [sub, transitionsMap]);

  const canRenew = Boolean(
    sub &&
      Array.isArray(sub.allowed_actions) &&
      sub.allowed_actions.includes('renew')
  );

  const canEditQuoteOrDraft =
    mode === 'staff' && Boolean(sub && (sub.status === 'draft' || sub.status === 'quotation'));

  const executeTransition = async (toStatus: string, noteText = '') => {
    if (!sub) return;
    setPendingAction(toStatus);
    try {
      const url =
        mode === 'portal'
          ? `/me/subscriptions/${sub.id}/transition`
          : `/subscriptions/${sub.id}/transition`;
      await api.post(url, { to: toStatus, note: noteText.trim() });
      showToast(`Subscription moved to ${toStatus}`, 'success');
      setConfirmTarget(null);
      setTransitionNote('');
      await reload();
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Transition failed', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const handleRenew = async () => {
    if (!sub) return;
    setPendingAction('renew');
    try {
      await api.post(`/subscriptions/${sub.id}/renew`);
      showToast('Subscription renewed', 'success');
      await reload();
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Renewal failed', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const handleSaveDraftChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sub) return;
    setSavingDraft(true);
    try {
      await api.patch(`/subscriptions/${sub.id}`, {
        expiry_date: editExpiryDate || null,
        quote_valid_until: editQuoteValidUntil || null,
      });
      showToast('Subscription details updated', 'success');
      setIsEditingDraft(false);
      await reload();
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const currentStepIndex = sub
    ? sub.status === 'paused'
      ? 3
      : LIFECYCLE_STEPS.findIndex((s) => s.key === sub.status)
    : -1;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={sub ? `Subscription ${sub.number}` : 'Subscription details'}
        badge={sub ? <StatusBadge status={sub.status} /> : undefined}
        footer={
          sub ? (
            <>
              {canEditQuoteOrDraft && (
                <Pill
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingDraft((v) => !v)}
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isEditingDraft ? 'Cancel edit' : 'Edit dates'}</span>
                </Pill>
              )}

              {nextStatuses.map((target) => {
                const isDestructive = target === 'closed';
                const label =
                  target === 'active' && sub.status === 'paused'
                    ? 'Resume'
                    : TRANSITION_LABELS[target] ||
                      target.charAt(0).toUpperCase() + target.slice(1);

                return (
                  <Pill
                    key={target}
                    variant={isDestructive ? 'danger' : target === 'active' ? 'primary' : 'soft'}
                    size="sm"
                    loading={pendingAction === target}
                    onClick={() => {
                      if (isDestructive) {
                        setConfirmTarget(target);
                      } else {
                        void executeTransition(target);
                      }
                    }}
                  >
                    {label}
                  </Pill>
                );
              })}

              {canRenew && mode === 'staff' && (
                <Pill
                  variant="outline"
                  size="sm"
                  loading={pendingAction === 'renew'}
                  onClick={handleRenew}
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Renew</span>
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
        ) : sub ? (
          <>
            {/* Lifecycle Progress Stepper */}
            <DrawerSection title="Lifecycle stage">
              <div className="flex items-center justify-between gap-1.5" role="list" aria-label="Subscription lifecycle">
                {LIFECYCLE_STEPS.map((step, idx) => {
                  const isCurrent =
                    sub.status === step.key || (sub.status === 'paused' && step.key === 'active');
                  const isCompleted = currentStepIndex > idx;
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
                        {sub.status === 'paused' && step.key === 'active' ? 'Paused' : step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </DrawerSection>

            {isEditingDraft && canEditQuoteOrDraft && (
              <DrawerSection title="Edit quotation / draft dates">
                <form onSubmit={handleSaveDraftChanges} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                      label="Expiry date"
                      type="date"
                      value={editExpiryDate}
                      onChange={(e) => setEditExpiryDate(e.target.value)}
                    />
                    <Field
                      label="Quote valid until"
                      type="date"
                      value={editQuoteValidUntil}
                      onChange={(e) => setEditQuoteValidUntil(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Pill
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingDraft(false)}
                    >
                      Cancel
                    </Pill>
                    <Pill type="submit" variant="primary" size="sm" loading={savingDraft}>
                      Save changes
                    </Pill>
                  </div>
                </form>
              </DrawerSection>
            )}

            <DrawerSection title="Overview">
              <div className="grid grid-cols-2 gap-4 text-[14px]">
                <div>
                  <div className="text-[12px] text-[var(--text-muted)]">Customer</div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {sub.customer_name}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--text-muted)]">Plan</div>
                  <div className="font-semibold text-[var(--text-primary)]">{sub.plan_name}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--text-muted)]">Payment term</div>
                  <div className="text-[var(--text-secondary)]">
                    {sub.payment_term_name || 'Standard'}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--text-muted)]">Next billing date</div>
                  <div className="text-[var(--text-secondary)] tabular-nums">
                    {sub.next_billing_date || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--text-muted)]">Start / Expiry date</div>
                  <div className="text-[var(--text-secondary)] tabular-nums">
                    {sub.start_date} → {sub.expiry_date || 'Ongoing'}
                  </div>
                </div>
                {sub.quote_valid_until && (
                  <div>
                    <div className="text-[12px] text-[var(--text-muted)]">Quote valid until</div>
                    <div className="text-[var(--text-secondary)] tabular-nums">
                      {sub.quote_valid_until}
                    </div>
                  </div>
                )}
              </div>
            </DrawerSection>

            <DrawerSection title="Subscription lines">
              {sub.lines && sub.lines.length > 0 ? (
                <div className="space-y-3">
                  {sub.lines.map((line, idx) => (
                    <div
                      key={line.id || idx}
                      className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border-faint)] last:border-b-0"
                    >
                      <div>
                        <div className="text-[14px] font-medium text-[var(--text-primary)]">
                          {line.product_name}
                          {line.variant_label ? ` (${line.variant_label})` : ''}
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
                <p className="text-[13px] text-[var(--text-muted)]">No subscription lines.</p>
              )}
            </DrawerSection>

            {sub.totals && (
              <DrawerSection title="Totals">
                <div className="space-y-2 text-[14px]">
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatMinor(sub.totals.subtotal_minor)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>Tax</span>
                    <span className="tabular-nums">{formatMinor(sub.totals.tax_minor)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[16px] text-[var(--text-primary)] pt-2 border-t border-[var(--border-faint)]">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMinor(sub.totals.total_minor)}</span>
                  </div>
                </div>
              </DrawerSection>
            )}

            <DrawerSection title="Activity timeline">
              {eventsLoading ? (
                <Skeleton rows={2} heightClass="h-[44px]" />
              ) : events && events.length > 0 ? (
                <ol className="space-y-3">
                  {events.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-start justify-between gap-4 text-[13px] py-1.5 border-b border-[var(--border-faint)] last:border-b-0"
                    >
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">
                          {ev.from_status ? `${ev.from_status} → ` : ''}
                          <span className="font-semibold">{ev.to_status}</span>
                        </div>
                        {ev.note && (
                          <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                            {ev.note}
                          </div>
                        )}
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          by {ev.actor_name}
                        </div>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                        {ev.created_at}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] text-[var(--text-muted)]">No status events recorded.</p>
              )}
            </DrawerSection>
          </>
        ) : null}
      </Drawer>

      <ConfirmModal
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        title="Close subscription?"
        description={`Are you sure you want to close subscription ${sub?.number || ''}?`}
        confirmLabel="Close subscription"
        tone="danger"
        loading={pendingAction === confirmTarget}
        onConfirm={() => {
          if (confirmTarget) {
            void executeTransition(confirmTarget, transitionNote);
          }
        }}
      >
        <Field
          label="Closure note (optional)"
          placeholder="Reason for closing this subscription…"
          value={transitionNote}
          onChange={(e) => setTransitionNote(e.target.value)}
        />
      </ConfirmModal>
    </>
  );
}
