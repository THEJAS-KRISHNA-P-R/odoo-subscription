'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CopyPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useCan } from '@/lib/meta';
import { useList } from '@/lib/useList';
import { Customer, Plan, Product, Subscription, Template } from '@/lib/types';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { Drawer, DrawerSection } from '@/components/ui/Drawer';
import { Modal } from '@/components/ui/Modal';
import { Field, SelectField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/Toast';
import { SubscriptionDrawer } from '@/components/domain/SubscriptionDrawer';
import { CatalogSubnav } from '@/components/domain/CatalogSubnav';

interface TemplateDraftLine {
  product_id: string;
  variant_id: string;
  quantity: number;
}

export default function CatalogTemplatesPage() {
  const { showToast } = useToast();
  const canWrite = useCan('catalog.write');

  const list = useList<Template>('/templates');
  const plans = useList<Plan>('/plans', undefined, 50);
  const products = useList<Product>('/products', undefined, 50);
  const customers = useList<Customer>('/customers', undefined, 50);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const [name, setName] = useState('');
  const [planId, setPlanId] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [lines, setLines] = useState<TemplateDraftLine[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Instantiate modal
  const [instantiateTpl, setInstantiateTpl] = useState<Template | null>(null);
  const [instantiateCustomerId, setInstantiateCustomerId] = useState('');
  const [instantiating, setInstantiating] = useState(false);
  const [createdSubId, setCreatedSubId] = useState<number | string | null>(null);

  useEffect(() => {
    if (editingTemplate) {
      setName(editingTemplate.name || '');
      setPlanId(String(editingTemplate.plan_id || ''));
      setValidityDays(String(editingTemplate.validity_days ?? 30));
      setLines(
        (editingTemplate.lines || []).map((l) => ({
          product_id: String(l.product_id),
          variant_id: l.variant_id ? String(l.variant_id) : '',
          quantity: l.quantity || 1,
        }))
      );
      setFields({});
    } else {
      setName('');
      setPlanId(plans.items[0] ? String(plans.items[0].id) : '');
      setValidityDays('30');
      setLines([]);
      setFields({});
    }
  }, [editingTemplate, plans.items]);

  const addLine = () => {
    const firstProd = products.items[0];
    setLines((prev) => [
      ...prev,
      {
        product_id: firstProd ? String(firstProd.id) : '',
        variant_id: '',
        quantity: 1,
      },
    ]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!planId) errs.plan_id = 'Select a plan';
    const vDays = parseInt(validityDays, 10);
    if (Number.isNaN(vDays) || vDays < 1) errs.validity_days = 'Enter valid validity days';
    if (Object.keys(errs).length > 0) {
      setFields(errs);
      return;
    }

    setFields({});
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        plan_id: planId,
        validity_days: vDays,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id || null,
          quantity: Number(l.quantity),
        })),
      };
      if (editingTemplate) {
        await api.patch(`/templates/${editingTemplate.id}`, payload);
        showToast('Template updated', 'success');
      } else {
        await api.post('/templates', payload);
        showToast('Template created', 'success');
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

  const handleInstantiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instantiateTpl || !instantiateCustomerId) return;
    setInstantiating(true);
    try {
      const sub = await api.post<Subscription>(
        `/templates/${instantiateTpl.id}/instantiate`,
        { customer_id: instantiateCustomerId }
      );
      showToast(`Draft subscription ${sub.number} created`, 'success');
      setInstantiateTpl(null);
      setCreatedSubId(sub.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not instantiate template', 'error');
    } finally {
      setInstantiating(false);
    }
  };

  return (
    <div className="space-y-8">
      <CatalogSubnav />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Templates
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Pre-configured subscription bundles with validity days and ready-to-instantiate product lines
          </p>
        </div>
        {canWrite && (
          <Pill
            variant="primary"
            onClick={() => {
              setEditingTemplate(null);
              setDrawerOpen(true);
            }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New template</span>
          </Pill>
        )}
      </div>

      <DataList<Template>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="No subscription templates created yet."
        emptyActionLabel={canWrite ? 'New template' : undefined}
        onEmptyAction={
          canWrite
            ? () => {
                setEditingTemplate(null);
                setDrawerOpen(true);
              }
            : undefined
        }
        renderItem={(tpl) => (
          <GroupedRow
            key={tpl.id}
            onClick={() => {
              setEditingTemplate(tpl);
              setDrawerOpen(true);
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {tpl.name}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)]">
                  Plan: {tpl.plan_name} · Validity: {tpl.validity_days} days ·{' '}
                  {(tpl.lines || []).length} lines
                </div>
              </div>
              <div>
                <Pill
                  variant="soft"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInstantiateTpl(tpl);
                  }}
                >
                  <CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Instantiate</span>
                </Pill>
              </div>
            </div>
          </GroupedRow>
        )}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingTemplate ? editingTemplate.name : 'New template'}
        footer={
          canWrite ? (
            <>
              <Pill variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
                Cancel
              </Pill>
              <Pill type="submit" form="template-form" variant="primary" loading={saving}>
                {editingTemplate ? 'Save template' : 'Create template'}
              </Pill>
            </>
          ) : (
            <Pill variant="ghost" onClick={() => setDrawerOpen(false)}>
              Close
            </Pill>
          )
        }
      >
        <DrawerSection title="Template setup">
          <form id="template-form" onSubmit={handleSave} className="space-y-4" noValidate>
            <Field
              label="Template name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fields.name}
              disabled={!canWrite}
              required
            />

            <SelectField
              label="Plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              error={fields.plan_id}
              disabled={!canWrite}
              required
            >
              <option value="">Select plan…</option>
              {plans.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>

            <Field
              label="Quote validity (days)"
              type="number"
              min={1}
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              error={fields.validity_days}
              disabled={!canWrite}
              required
            />

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                  Template lines
                </span>
                {canWrite && (
                  <Pill variant="soft" size="sm" onClick={addLine}>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add line</span>
                  </Pill>
                )}
              </div>

              {lines.map((line, idx) => {
                const prod = products.items.find(
                  (p) => String(p.id) === String(line.product_id)
                );
                const variants = prod?.variants || [];
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-[12px] bg-[var(--bg-surface)] space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <SelectField
                        label="Product"
                        value={line.product_id}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, product_id: e.target.value, variant_id: '' } : l
                            )
                          )
                        }
                        disabled={!canWrite}
                      >
                        <option value="">Select…</option>
                        {products.items.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </SelectField>

                      <SelectField
                        label="Variant"
                        value={line.variant_id}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, variant_id: e.target.value } : l
                            )
                          )
                        }
                        disabled={!canWrite || variants.length === 0}
                      >
                        <option value="">Standard</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.attribute}: {v.value}
                          </option>
                        ))}
                      </SelectField>

                      <Field
                        label="Quantity"
                        type="number"
                        min={1}
                        value={String(line.quantity)}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? { ...l, quantity: Math.max(1, parseInt(e.target.value || '1', 10)) }
                                : l
                            )
                          )
                        }
                        disabled={!canWrite}
                      />
                    </div>
                    {canWrite && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-[12px] font-semibold text-[var(--danger-fg)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </form>
        </DrawerSection>
      </Drawer>

      <Modal
        open={Boolean(instantiateTpl)}
        onClose={() => setInstantiateTpl(null)}
        title={`Instantiate "${instantiateTpl?.name || ''}"`}
        subtitle="Create a draft subscription from this template for a customer"
        footer={
          <>
            <Pill variant="ghost" onClick={() => setInstantiateTpl(null)} disabled={instantiating}>
              Cancel
            </Pill>
            <Pill
              type="submit"
              form="instantiate-form"
              variant="primary"
              loading={instantiating}
            >
              Create draft subscription
            </Pill>
          </>
        }
      >
        <form id="instantiate-form" onSubmit={handleInstantiate} className="space-y-4">
          <SelectField
            label="Customer"
            value={instantiateCustomerId}
            onChange={(e) => setInstantiateCustomerId(e.target.value)}
            required
          >
            <option value="">Select customer…</option>
            {customers.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </SelectField>
        </form>
      </Modal>

      <SubscriptionDrawer
        subscriptionId={createdSubId}
        open={createdSubId !== null}
        onClose={() => setCreatedSubId(null)}
      />
    </div>
  );
}
