'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useCan, useEnum } from '@/lib/meta';
import { useList } from '@/lib/useList';
import { formatMinor, minorToRupeeInput, parseRupeesToMinor, formatBpToPercent } from '@/lib/money';
import { Product, Tax } from '@/lib/types';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { Drawer, DrawerSection } from '@/components/ui/Drawer';
import { Field, SelectField, TextareaField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { CatalogSubnav } from '@/components/domain/CatalogSubnav';

export default function CatalogProductsPage() {
  const { showToast } = useToast();
  const canWrite = useCan('catalog.write');
  const productTypes = useEnum('product_type');

  const list = useList<Product>('/products');
  const taxes = useList<Tax>('/taxes', undefined, 50);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [salesRupees, setSalesRupees] = useState('');
  const [costRupees, setCostRupees] = useState('0');
  const [taxId, setTaxId] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Variant creation/editing state
  const [varAttribute, setVarAttribute] = useState('');
  const [varValue, setVarValue] = useState('');
  const [varExtraRupees, setVarExtraRupees] = useState('0');
  const [varSaving, setVarSaving] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || '');
      setType(editingProduct.type || (productTypes[0]?.value ?? ''));
      setSalesRupees(minorToRupeeInput(editingProduct.sales_price_minor));
      setCostRupees(minorToRupeeInput(editingProduct.cost_price_minor));
      setTaxId(editingProduct.tax_id ? String(editingProduct.tax_id) : '');
      setNotes(editingProduct.notes || '');
      setIsActive(Boolean(editingProduct.is_active));
      setFields({});
    } else {
      setName('');
      setType(productTypes[0]?.value ?? '');
      setSalesRupees('');
      setCostRupees('0');
      setTaxId('');
      setNotes('');
      setIsActive(true);
      setFields({});
    }
  }, [editingProduct, productTypes]);

  const openCreate = () => {
    setEditingProduct(null);
    setDrawerOpen(true);
  };

  const openEdit = (prod: Product) => {
    setEditingProduct(prod);
    setDrawerOpen(true);
  };

  const refreshEditingProduct = async (id: number | string) => {
    try {
      const updated = await api.get<Product>(`/products/${id}`);
      setEditingProduct(updated);
      await list.reset();
    } catch {
      await list.reset();
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    const salesMinor = parseRupeesToMinor(salesRupees);
    if (salesMinor === null) errs.sales_price_minor = 'Enter a valid amount';
    const costMinor = parseRupeesToMinor(costRupees || '0');
    if (costMinor === null) errs.cost_price_minor = 'Enter a valid amount';

    if (Object.keys(errs).length > 0) {
      setFields(errs);
      return;
    }

    setFields({});
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        sales_price_minor: salesMinor,
        cost_price_minor: costMinor,
        tax_id: taxId || null,
        notes: notes.trim(),
        is_active: isActive,
      };
      if (editingProduct) {
        const updated = await api.patch<Product>(`/products/${editingProduct.id}`, payload);
        setEditingProduct(updated);
        showToast('Product updated', 'success');
      } else {
        const created = await api.post<Product>('/products', payload);
        setEditingProduct(created);
        showToast('Product created', 'success');
      }
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

  const handleDeleteProduct = async () => {
    if (!editingProduct) return;
    setSaving(true);
    try {
      await api.delete(`/products/${editingProduct.id}`);
      showToast('Product deleted', 'success');
      setConfirmDeleteOpen(false);
      setDrawerOpen(false);
      await list.reset();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !canWrite) return;
    const extraMinor = parseRupeesToMinor(varExtraRupees || '0');
    if (!varAttribute.trim() || !varValue.trim() || extraMinor === null) {
      showToast('Enter variant attribute, value, and valid extra price', 'error');
      return;
    }
    setVarSaving(true);
    try {
      await api.post(`/products/${editingProduct.id}/variants`, {
        attribute: varAttribute.trim(),
        value: varValue.trim(),
        extra_price_minor: extraMinor,
      });
      setVarAttribute('');
      setVarValue('');
      setVarExtraRupees('0');
      showToast('Variant added', 'success');
      await refreshEditingProduct(editingProduct.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add variant', 'error');
    } finally {
      setVarSaving(false);
    }
  };

  const handleRemoveVariant = async (vid: number | string) => {
    if (!editingProduct || !canWrite) return;
    try {
      await api.delete(`/products/${editingProduct.id}/variants/${vid}`);
      showToast('Variant removed', 'success');
      await refreshEditingProduct(editingProduct.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove variant', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <CatalogSubnav />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Products
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Configure billable products, base pricing, tax assignment, and attribute variants
          </p>
        </div>
        {canWrite && (
          <Pill variant="primary" onClick={openCreate}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New product</span>
          </Pill>
        )}
      </div>

      <DataList<Product>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="No products in catalog yet."
        emptyActionLabel={canWrite ? 'New product' : undefined}
        onEmptyAction={canWrite ? openCreate : undefined}
        renderItem={(prod) => (
          <GroupedRow key={prod.id} onClick={() => openEdit(prod)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                  {prod.name}
                </span>
                <span className="text-[12px] text-[var(--text-muted)] uppercase">
                  {prod.type}
                </span>
                <StatusBadge
                  status={prod.is_active ? 'active' : 'inactive'}
                  label={prod.is_active ? 'Active' : 'Inactive'}
                />
                {prod.variants && prod.variants.length > 0 && (
                  <span className="text-[12px] text-[var(--text-secondary)]">
                    · {prod.variants.length} variants
                  </span>
                )}
              </div>
              <div className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums">
                {formatMinor(prod.sales_price_minor)}
              </div>
            </div>
          </GroupedRow>
        )}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingProduct ? editingProduct.name : 'New product'}
        footer={
          canWrite ? (
            <>
              {editingProduct && (
                <Pill
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="mr-auto"
                >
                  Delete
                </Pill>
              )}
              <Pill variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
                Cancel
              </Pill>
              <Pill
                type="submit"
                form="product-form"
                variant="primary"
                loading={saving}
              >
                {editingProduct ? 'Save product' : 'Create product'}
              </Pill>
            </>
          ) : (
            <Pill variant="ghost" onClick={() => setDrawerOpen(false)}>
              Close
            </Pill>
          )
        }
      >
        <DrawerSection title="Product details">
          <form id="product-form" onSubmit={handleSaveProduct} className="space-y-4" noValidate>
            <Field
              label="Product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fields.name}
              disabled={!canWrite}
              required
            />

            <SelectField
              label="Product type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              error={fields.type}
              disabled={!canWrite}
              required
            >
              <option value="">Select type…</option>
              {productTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Sales price (INR ₹)"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={salesRupees}
                onChange={(e) => setSalesRupees(e.target.value)}
                error={fields.sales_price_minor}
                disabled={!canWrite}
                required
              />
              <Field
                label="Cost price (INR ₹)"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={costRupees}
                onChange={(e) => setCostRupees(e.target.value)}
                error={fields.cost_price_minor}
                disabled={!canWrite}
              />
            </div>

            <SelectField
              label="Default tax"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              error={fields.tax_id}
              disabled={!canWrite}
            >
              <option value="">No tax</option>
              {taxes.items.map((tx) => (
                <option key={tx.id} value={tx.id}>
                  {tx.name} ({formatBpToPercent(tx.rate_bp)})
                </option>
              ))}
            </SelectField>

            <TextareaField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              error={fields.notes}
              disabled={!canWrite}
            />

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={!canWrite}
                className="w-4 h-4 accent-[var(--brand-dark)]"
              />
              <span className="text-[14px] font-medium text-[var(--text-primary)]">
                Active in catalog
              </span>
            </label>
          </form>
        </DrawerSection>

        {editingProduct && (
          <DrawerSection title="Product variants">
            <div className="space-y-4">
              {editingProduct.variants && editingProduct.variants.length > 0 ? (
                <div className="space-y-2">
                  {editingProduct.variants.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-[12px] bg-[var(--bg-surface)] text-[13px]"
                    >
                      <div>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {v.attribute}: {v.value}
                        </span>
                        <span className="ml-2 text-[var(--brand-dark)] font-semibold tabular-nums">
                          +{formatMinor(v.extra_price_minor)}
                        </span>
                      </div>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(v.id)}
                          aria-label={`Delete variant ${v.value}`}
                          className="text-[var(--danger-fg)] hover:underline inline-flex items-center gap-1 text-[12px] font-semibold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--text-muted)]">No variants configured.</p>
              )}

              {canWrite && (
                <form
                  onSubmit={handleAddVariant}
                  className="bg-[var(--bg-muted)] rounded-[16px] p-4 space-y-3"
                >
                  <div className="text-[12px] font-semibold text-[var(--text-secondary)]">
                    Add variant
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field
                      label="Attribute"
                      placeholder="e.g. Seat tier"
                      value={varAttribute}
                      onChange={(e) => setVarAttribute(e.target.value)}
                      required
                    />
                    <Field
                      label="Value"
                      placeholder="e.g. Enterprise"
                      value={varValue}
                      onChange={(e) => setVarValue(e.target.value)}
                      required
                    />
                    <Field
                      label="Extra price (₹)"
                      type="text"
                      inputMode="decimal"
                      value={varExtraRupees}
                      onChange={(e) => setVarExtraRupees(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <Pill type="submit" variant="soft" size="sm" loading={varSaving}>
                      Add variant
                    </Pill>
                  </div>
                </form>
              )}
            </div>
          </DrawerSection>
        )}
      </Drawer>

      <ConfirmModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete product?"
        description={`Are you sure you want to delete "${editingProduct?.name || ''}"?`}
        confirmLabel="Delete product"
        tone="danger"
        loading={saving}
        onConfirm={handleDeleteProduct}
      />
    </div>
  );
}
