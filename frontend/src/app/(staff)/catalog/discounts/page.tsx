'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useCan, useEnum } from '@/lib/meta';
import { useList } from '@/lib/useList';
import {
  bpToPercentInput,
  formatBpToPercent,
  formatMinor,
  minorToRupeeInput,
  parsePercentToBp,
  parseRupeesToMinor,
} from '@/lib/money';
import { Discount, Product, Subscription } from '@/lib/types';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { Drawer, DrawerSection } from '@/components/ui/Drawer';
import { Field, SelectField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { CatalogSubnav } from '@/components/domain/CatalogSubnav';

export default function CatalogDiscountsPage() {
  const { showToast } = useToast();
  const canWrite = useCan('discount.write');
  const discountKinds = useEnum('discount_kind');
  const discountScopes = useEnum('discount_scope');

  const list = useList<Discount>('/discounts');
  const products = useList<Product>('/products', undefined, 50);
  const subscriptions = useList<Subscription>('/subscriptions', undefined, 50);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [minPurchaseRupees, setMinPurchaseRupees] = useState('0');
  const [minQuantity, setMinQuantity] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [scope, setScope] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isPercentKind = kind.toLowerCase().includes('percent') || kind === 'percentage';

  useEffect(() => {
    if (editingDiscount) {
      setName(editingDiscount.name || '');
      setKind(editingDiscount.kind || (discountKinds[0]?.value ?? ''));
      const isPct =
        (editingDiscount.kind || '').toLowerCase().includes('percent') ||
        editingDiscount.kind === 'percentage';
      setValueInput(
        isPct
          ? bpToPercentInput(editingDiscount.value)
          : minorToRupeeInput(editingDiscount.value)
      );
      setMinPurchaseRupees(minorToRupeeInput(editingDiscount.min_purchase_minor));
      setMinQuantity(String(editingDiscount.min_quantity ?? 1));
      setStartDate(editingDiscount.start_date || '');
      setEndDate(editingDiscount.end_date || '');
      setUsageLimit(
        editingDiscount.usage_limit !== null && editingDiscount.usage_limit !== undefined
          ? String(editingDiscount.usage_limit)
          : ''
      );
      setScope(editingDiscount.scope || (discountScopes[0]?.value ?? ''));
      setIsActive(Boolean(editingDiscount.is_active));
      setSelectedProductIds((editingDiscount.product_ids || []).map(String));
      setSelectedSubIds((editingDiscount.subscription_ids || []).map(String));
      setFields({});
    } else {
      setName('');
      setKind(discountKinds[0]?.value ?? '');
      setValueInput('');
      setMinPurchaseRupees('0');
      setMinQuantity('1');
      setStartDate('');
      setEndDate('');
      setUsageLimit('');
      setScope(discountScopes[0]?.value ?? '');
      setIsActive(true);
      setSelectedProductIds([]);
      setSelectedSubIds([]);
      setFields({});
    }
  }, [editingDiscount, discountKinds, discountScopes]);

  const toggleId = (arr: string[], id: string, setter: (next: string[]) => void) => {
    if (arr.includes(id)) {
      setter(arr.filter((x) => x !== id));
    } else {
      setter([...arr, id]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!kind) errs.kind = 'Select discount kind';

    let numericValue: number | null = null;
    if (isPercentKind) {
      numericValue = parsePercentToBp(valueInput);
      if (numericValue === null || numericValue < 100 || numericValue > 10000) {
        errs.value = 'Percent must be between 1 and 100';
      }
    } else {
      numericValue = parseRupeesToMinor(valueInput);
      if (numericValue === null || numericValue <= 0) {
        errs.value = 'Enter a valid amount';
      }
    }

    const minPurchaseMinor = parseRupeesToMinor(minPurchaseRupees || '0');
    if (minPurchaseMinor === null) errs.min_purchase_minor = 'Enter a valid amount';

    const minQtyInt = parseInt(minQuantity || '1', 10);
    const limitInt = usageLimit.trim() ? parseInt(usageLimit, 10) : null;
    if (limitInt !== null && (Number.isNaN(limitInt) || limitInt < 1)) {
      errs.usage_limit = 'Limit must be at least 1';
    }
    if (startDate && endDate && endDate < startDate) {
      errs.end_date = 'End date must be after start date';
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
        kind,
        value: numericValue,
        min_purchase_minor: minPurchaseMinor,
        min_quantity: minQtyInt,
        start_date: startDate || null,
        end_date: endDate || null,
        usage_limit: limitInt,
        scope,
        is_active: isActive,
        product_ids: selectedProductIds,
        subscription_ids: selectedSubIds,
      };
      if (editingDiscount) {
        await api.patch(`/discounts/${editingDiscount.id}`, payload);
        showToast('Discount updated', 'success');
      } else {
        await api.post('/discounts', payload);
        showToast('Discount created', 'success');
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
            Discounts
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Configure percentage or fixed discounts, usage limits, and product/subscription scoping
          </p>
        </div>
        {canWrite && (
          <Pill
            variant="primary"
            onClick={() => {
              setEditingDiscount(null);
              setDrawerOpen(true);
            }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New discount</span>
          </Pill>
        )}
      </div>

      <DataList<Discount>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="No discounts configured yet."
        emptyActionLabel={canWrite ? 'New discount' : undefined}
        onEmptyAction={
          canWrite
            ? () => {
                setEditingDiscount(null);
                setDrawerOpen(true);
              }
            : undefined
        }
        renderItem={(disc) => {
          const isPct =
            (disc.kind || '').toLowerCase().includes('percent') || disc.kind === 'percentage';
          return (
            <GroupedRow
              key={disc.id}
              onClick={() => {
                setEditingDiscount(disc);
                setDrawerOpen(true);
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {disc.name}
                  </span>
                  <span className="text-[12px] text-[var(--text-muted)] uppercase">
                    {disc.scope}
                  </span>
                  <StatusBadge
                    status={disc.is_active ? 'active' : 'inactive'}
                    label={disc.is_active ? 'Active' : 'Inactive'}
                  />
                </div>
                <div className="flex items-center gap-6 text-[14px]">
                  <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
                    Used {disc.used_count}
                    {disc.usage_limit ? ` / ${disc.usage_limit}` : ''}
                  </span>
                  <span className="font-bold text-[var(--brand-dark)] tabular-nums">
                    {isPct ? formatBpToPercent(disc.value) : formatMinor(disc.value)}
                  </span>
                </div>
              </div>
            </GroupedRow>
          );
        }}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingDiscount ? editingDiscount.name : 'New discount'}
        footer={
          canWrite ? (
            <>
              <Pill variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
                Cancel
              </Pill>
              <Pill type="submit" form="discount-form" variant="primary" loading={saving}>
                {editingDiscount ? 'Save discount' : 'Create discount'}
              </Pill>
            </>
          ) : (
            <Pill variant="ghost" onClick={() => setDrawerOpen(false)}>
              Close
            </Pill>
          )
        }
      >
        {editingDiscount && (
          <DrawerSection title="Usage meter">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px] font-semibold">
                <span className="text-[var(--text-secondary)]">Redemptions used</span>
                <span className="text-[var(--text-primary)] tabular-nums">
                  {editingDiscount.used_count} / {editingDiscount.usage_limit ?? 'Unlimited'}
                </span>
              </div>
              {editingDiscount.usage_limit && editingDiscount.usage_limit > 0 && (
                <div className="w-full h-2.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--brand-primary)] transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (editingDiscount.used_count / editingDiscount.usage_limit) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </DrawerSection>
        )}

        <DrawerSection title="Discount configuration">
          <form id="discount-form" onSubmit={handleSave} className="space-y-4" noValidate>
            <Field
              label="Discount name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fields.name}
              disabled={!canWrite}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Discount kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                error={fields.kind}
                disabled={!canWrite}
                required
              >
                <option value="">Select kind…</option>
                {discountKinds.map((dk) => (
                  <option key={dk.value} value={dk.value}>
                    {dk.label}
                  </option>
                ))}
              </SelectField>

              <Field
                label={isPercentKind ? 'Value (%)' : 'Value (INR ₹)'}
                type="text"
                inputMode="decimal"
                placeholder={isPercentKind ? '10' : '500.00'}
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                error={fields.value}
                disabled={!canWrite}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Minimum purchase (INR ₹)"
                type="text"
                inputMode="decimal"
                value={minPurchaseRupees}
                onChange={(e) => setMinPurchaseRupees(e.target.value)}
                error={fields.min_purchase_minor}
                disabled={!canWrite}
              />
              <Field
                label="Minimum quantity"
                type="number"
                min={1}
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                error={fields.min_quantity}
                disabled={!canWrite}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Start date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                error={fields.start_date}
                disabled={!canWrite}
              />
              <Field
                label="End date"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                error={fields.end_date}
                disabled={!canWrite}
              />
            </div>

            <Field
              label="Usage limit"
              type="number"
              min={1}
              placeholder="Leave blank for unlimited"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              error={fields.usage_limit}
              disabled={!canWrite}
            />

            <SelectField
              label="Scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              error={fields.scope}
              disabled={!canWrite}
              required
            >
              <option value="">Select scope…</option>
              {discountScopes.map((ds) => (
                <option key={ds.value} value={ds.value}>
                  {ds.label}
                </option>
              ))}
            </SelectField>

            {scope.toLowerCase().includes('product') && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]">
                  Applicable products ({selectedProductIds.length} selected)
                </div>
                <div className="max-h-40 overflow-y-auto rounded-[12px] bg-[var(--bg-surface)] p-3 space-y-1.5">
                  {products.items.map((p) => (
                    <label key={p.id} className="flex items-center gap-2.5 text-[13px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(String(p.id))}
                        onChange={() =>
                          toggleId(selectedProductIds, String(p.id), setSelectedProductIds)
                        }
                        disabled={!canWrite}
                        className="w-4 h-4 accent-[var(--brand-dark)]"
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {scope.toLowerCase().includes('subscription') && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]">
                  Applicable subscriptions ({selectedSubIds.length} selected)
                </div>
                <div className="max-h-40 overflow-y-auto rounded-[12px] bg-[var(--bg-surface)] p-3 space-y-1.5">
                  {subscriptions.items.map((s) => (
                    <label key={s.id} className="flex items-center gap-2.5 text-[13px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSubIds.includes(String(s.id))}
                        onChange={() => toggleId(selectedSubIds, String(s.id), setSelectedSubIds)}
                        disabled={!canWrite}
                        className="w-4 h-4 accent-[var(--brand-dark)]"
                      />
                      <span>
                        {s.number} · {s.customer_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={!canWrite}
                className="w-4 h-4 accent-[var(--brand-dark)]"
              />
              <span className="text-[14px] font-medium text-[var(--text-primary)]">
                Active discount
              </span>
            </label>
          </form>
        </DrawerSection>
      </Drawer>
    </div>
  );
}
