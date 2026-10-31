'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useCan, useEnum } from '@/lib/meta';
import { useList } from '@/lib/useList';
import { formatMinor, minorToRupeeInput, parseRupeesToMinor } from '@/lib/money';
import { Plan } from '@/lib/types';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { Drawer, DrawerSection } from '@/components/ui/Drawer';
import { Field, SelectField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { CatalogSubnav } from '@/components/domain/CatalogSubnav';

export default function CatalogPlansPage() {
  const { showToast } = useToast();
  const canWrite = useCan('catalog.write');
  const billingPeriods = useEnum('billing_period');

  const list = useList<Plan>('/plans');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [name, setName] = useState('');
  const [priceRupees, setPriceRupees] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('');
  const [minQuantity, setMinQuantity] = useState('1');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [autoClose, setAutoClose] = useState(false);
  const [closable, setClosable] = useState(true);
  const [pausable, setPausable] = useState(true);
  const [renewable, setRenewable] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingPlan) {
      setName(editingPlan.name || '');
      setPriceRupees(minorToRupeeInput(editingPlan.price_minor));
      setBillingPeriod(editingPlan.billing_period || (billingPeriods[0]?.value ?? ''));
      setMinQuantity(String(editingPlan.min_quantity ?? 1));
      setAvailableFrom(editingPlan.available_from || '');
      setAvailableTo(editingPlan.available_to || '');
      setAutoClose(Boolean(editingPlan.auto_close));
      setClosable(Boolean(editingPlan.closable));
      setPausable(Boolean(editingPlan.pausable));
      setRenewable(Boolean(editingPlan.renewable));
      setIsActive(Boolean(editingPlan.is_active));
      setFields({});
    } else {
      setName('');
      setPriceRupees('0');
      setBillingPeriod(billingPeriods[0]?.value ?? '');
      setMinQuantity('1');
      setAvailableFrom('');
      setAvailableTo('');
      setAutoClose(false);
      setClosable(true);
      setPausable(true);
      setRenewable(true);
      setIsActive(true);
      setFields({});
    }
  }, [editingPlan, billingPeriods]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    const priceMinor = parseRupeesToMinor(priceRupees || '0');
    if (priceMinor === null) errs.price_minor = 'Enter a valid amount';
    if (!billingPeriod) errs.billing_period = 'Select a billing period';
    const minQtyInt = parseInt(minQuantity, 10);
    if (Number.isNaN(minQtyInt) || minQtyInt < 1) {
      errs.min_quantity = 'Minimum quantity must be at least 1';
    }
    if (availableFrom && availableTo && availableTo < availableFrom) {
      errs.available_to = 'End date must be after start date';
    }
    if (Object.keys(errs).length > 0) {
      setFields(errs);
      return;
    }

    setFields({});
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        price_minor: priceMinor,
        billing_period: billingPeriod,
        min_quantity: minQtyInt,
        available_from: availableFrom || null,
        available_to: availableTo || null,
        auto_close: autoClose,
        closable,
        pausable,
        renewable,
        is_active: isActive,
      };
      if (editingPlan) {
        await api.patch(`/plans/${editingPlan.id}`, payload);
        showToast('Plan updated', 'success');
      } else {
        await api.post('/plans', payload);
        showToast('Plan created', 'success');
      }
      setDrawerOpen(false);
      await list.reset();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Save failed', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <CatalogSubnav />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Plans
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Define recurring billing periods, minimum quantities, availability windows, and portal permissions
          </p>
        </div>
        {canWrite && (
          <Pill
            variant="primary"
            onClick={() => {
              setEditingPlan(null);
              setDrawerOpen(true);
            }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New plan</span>
          </Pill>
        )}
      </div>

      <DataList<Plan>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="No billing plans configured yet."
        emptyActionLabel={canWrite ? 'New plan' : undefined}
        onEmptyAction={
          canWrite
            ? () => {
                setEditingPlan(null);
                setDrawerOpen(true);
              }
            : undefined
        }
        renderItem={(plan) => (
          <GroupedRow
            key={plan.id}
            onClick={() => {
              setEditingPlan(plan);
              setDrawerOpen(true);
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {plan.name}
                </span>
                <span className="text-[12px] text-[var(--text-muted)] uppercase">
                  {plan.billing_period}
                </span>
                <span className="text-[12px] text-[var(--text-secondary)]">
                  · Min qty {plan.min_quantity}
                </span>
                <StatusBadge
                  status={plan.is_active ? 'active' : 'inactive'}
                  label={plan.is_active ? 'Active' : 'Inactive'}
                />
              </div>
              <div className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums">
                {formatMinor(plan.price_minor)}
              </div>
            </div>
          </GroupedRow>
        )}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingPlan ? editingPlan.name : 'New plan'}
        footer={
          canWrite ? (
            <>
              <Pill variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
                Cancel
              </Pill>
              <Pill type="submit" form="plan-form" variant="primary" loading={saving}>
                {editingPlan ? 'Save plan' : 'Create plan'}
              </Pill>
            </>
          ) : (
            <Pill variant="ghost" onClick={() => setDrawerOpen(false)}>
              Close
            </Pill>
          )
        }
      >
        <DrawerSection title="Plan configuration">
          <form id="plan-form" onSubmit={handleSave} className="space-y-4" noValidate>
            <Field
              label="Plan name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fields.name}
              disabled={!canWrite}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Billing period"
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value)}
                error={fields.billing_period}
                disabled={!canWrite}
                required
              >
                <option value="">Select period…</option>
                {billingPeriods.map((bp) => (
                  <option key={bp.value} value={bp.value}>
                    {bp.label}
                  </option>
                ))}
              </SelectField>

              <Field
                label="Plan base price (INR ₹)"
                type="text"
                inputMode="decimal"
                value={priceRupees}
                onChange={(e) => setPriceRupees(e.target.value)}
                error={fields.price_minor}
                disabled={!canWrite}
                required
              />
            </div>

            <Field
              label="Minimum quantity"
              type="number"
              min={1}
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              error={fields.min_quantity}
              disabled={!canWrite}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Available from"
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                error={fields.available_from}
                disabled={!canWrite}
              />
              <Field
                label="Available to"
                type="date"
                min={availableFrom || undefined}
                value={availableTo}
                onChange={(e) => setAvailableTo(e.target.value)}
                error={fields.available_to}
                disabled={!canWrite}
              />
            </div>

            <div className="pt-2 space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                Lifecycle & portal switches
              </div>
              {[
                {
                  key: 'auto_close',
                  checked: autoClose,
                  set: setAutoClose,
                  title: 'Auto-close on expiry',
                  desc: 'Automatically transition subscription to closed when expiry date passes',
                },
                {
                  key: 'closable',
                  checked: closable,
                  set: setClosable,
                  title: 'Closable by customer',
                  desc: 'Allow customers to close subscriptions on this plan',
                },
                {
                  key: 'pausable',
                  checked: pausable,
                  set: setPausable,
                  title: 'Pausable',
                  desc: 'Allow pausing and resuming subscriptions on this plan',
                },
                {
                  key: 'renewable',
                  checked: renewable,
                  set: setRenewable,
                  title: 'Renewable',
                  desc: 'Allow renewing subscriptions for another term',
                },
                {
                  key: 'is_active',
                  checked: isActive,
                  set: setIsActive,
                  title: 'Active plan',
                  desc: 'Available for new subscriptions',
                },
              ].map((sw) => (
                <label
                  key={sw.key}
                  className="flex items-start justify-between gap-4 p-3.5 rounded-[12px] bg-[var(--bg-surface)] cursor-pointer"
                >
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                      {sw.title}
                    </div>
                    <div className="text-[12px] text-[var(--text-secondary)]">{sw.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={sw.checked}
                    onChange={(e) => sw.set(e.target.checked)}
                    disabled={!canWrite}
                    className="mt-1 w-4 h-4 accent-[var(--brand-dark)] shrink-0"
                  />
                </label>
              ))}
            </div>
          </form>
        </DrawerSection>
      </Drawer>
    </div>
  );
}
