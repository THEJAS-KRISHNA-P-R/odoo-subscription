'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useCan } from '@/lib/meta';
import { useList } from '@/lib/useList';
import { bpToPercentInput, formatBpToPercent, parsePercentToBp } from '@/lib/money';
import { PaymentTerm, Tax } from '@/lib/types';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { Drawer, DrawerSection } from '@/components/ui/Drawer';
import { Field } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { CatalogSubnav } from '@/components/domain/CatalogSubnav';

export default function CatalogTaxesPage() {
  const { showToast } = useToast();
  const canWrite = useCan('catalog.write');

  const taxes = useList<Tax>('/taxes');
  const paymentTerms = useList<PaymentTerm>('/payment-terms');

  // Tax drawer state
  const [taxDrawerOpen, setTaxDrawerOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [taxName, setTaxName] = useState('');
  const [ratePercent, setRatePercent] = useState('');
  const [taxActive, setTaxActive] = useState(true);
  const [taxFields, setTaxFields] = useState<Record<string, string>>({});
  const [savingTax, setSavingTax] = useState(false);

  // Payment term drawer state
  const [termDrawerOpen, setTermDrawerOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<PaymentTerm | null>(null);
  const [termName, setTermName] = useState('');
  const [dueDays, setDueDays] = useState('15');
  const [termFields, setTermFields] = useState<Record<string, string>>({});
  const [savingTerm, setSavingTerm] = useState(false);

  useEffect(() => {
    if (editingTax) {
      setTaxName(editingTax.name || '');
      setRatePercent(bpToPercentInput(editingTax.rate_bp));
      setTaxActive(Boolean(editingTax.is_active));
      setTaxFields({});
    } else {
      setTaxName('');
      setRatePercent('18');
      setTaxActive(true);
      setTaxFields({});
    }
  }, [editingTax]);

  useEffect(() => {
    if (editingTerm) {
      setTermName(editingTerm.name || '');
      setDueDays(String(editingTerm.due_days ?? 15));
      setTermFields({});
    } else {
      setTermName('');
      setDueDays('15');
      setTermFields({});
    }
  }, [editingTerm]);

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    const errs: Record<string, string> = {};
    if (!taxName.trim()) errs.name = 'Name is required';
    const rateBp = parsePercentToBp(ratePercent);
    if (rateBp === null || rateBp < 0 || rateBp > 10000) {
      errs.rate_bp = 'Percent must be between 0 and 100';
    }
    if (Object.keys(errs).length > 0) {
      setTaxFields(errs);
      return;
    }

    setTaxFields({});
    setSavingTax(true);
    try {
      const payload = {
        name: taxName.trim(),
        rate_bp: rateBp,
        is_active: taxActive,
      };
      if (editingTax) {
        await api.patch(`/taxes/${editingTax.id}`, payload);
        showToast('Tax updated', 'success');
      } else {
        await api.post('/taxes', payload);
        showToast('Tax created', 'success');
      }
      setTaxDrawerOpen(false);
      await taxes.reset();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setTaxFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Save failed', 'error');
      }
    } finally {
      setSavingTax(false);
    }
  };

  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    const errs: Record<string, string> = {};
    if (!termName.trim()) errs.name = 'Name is required';
    const days = parseInt(dueDays, 10);
    if (Number.isNaN(days) || days < 0) errs.due_days = 'Enter valid due days';
    if (Object.keys(errs).length > 0) {
      setTermFields(errs);
      return;
    }

    setTermFields({});
    setSavingTerm(true);
    try {
      const payload = { name: termName.trim(), due_days: days };
      if (editingTerm) {
        await api.patch(`/payment-terms/${editingTerm.id}`, payload);
        showToast('Payment term updated', 'success');
      } else {
        await api.post('/payment-terms', payload);
        showToast('Payment term created', 'success');
      }
      setTermDrawerOpen(false);
      await paymentTerms.reset();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setTermFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Save failed', 'error');
      }
    } finally {
      setSavingTerm(false);
    }
  };

  return (
    <div className="space-y-8">
      <CatalogSubnav />
      {/* Section 1: Taxes */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
              Taxes & Payment Terms
            </h1>
            <p className="text-[14px] text-[var(--text-secondary)] mt-1">
              Manage tax rates (stored in basis points: 1800 = 18%) and invoice payment terms
            </p>
          </div>
          {canWrite && (
            <Pill
              variant="primary"
              onClick={() => {
                setEditingTax(null);
                setTaxDrawerOpen(true);
              }}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New tax</span>
            </Pill>
          )}
        </div>

        <DataList<Tax>
          items={taxes.items}
          loading={taxes.loading}
          loadingMore={taxes.loadingMore}
          error={taxes.error}
          onRetry={taxes.reset}
          nextCursor={taxes.nextCursor}
          onLoadMore={taxes.loadMore}
          emptyTitle="No tax rates configured yet."
          emptyActionLabel={canWrite ? 'New tax' : undefined}
          onEmptyAction={
            canWrite
              ? () => {
                  setEditingTax(null);
                  setTaxDrawerOpen(true);
                }
              : undefined
          }
          renderItem={(tx) => (
            <GroupedRow
              key={tx.id}
              onClick={() => {
                setEditingTax(tx);
                setTaxDrawerOpen(true);
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {tx.name}
                  </span>
                  <StatusBadge
                    status={tx.is_active ? 'active' : 'inactive'}
                    label={tx.is_active ? 'Active' : 'Inactive'}
                  />
                </div>
                <span className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums">
                  {formatBpToPercent(tx.rate_bp)}
                </span>
              </div>
            </GroupedRow>
          )}
        />
      </section>

      {/* Section 2: Payment Terms */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Payment terms
          </h2>
          {canWrite && (
            <Pill
              variant="soft"
              size="sm"
              onClick={() => {
                setEditingTerm(null);
                setTermDrawerOpen(true);
              }}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New payment term</span>
            </Pill>
          )}
        </div>

        <DataList<PaymentTerm>
          items={paymentTerms.items}
          loading={paymentTerms.loading}
          error={paymentTerms.error}
          onRetry={paymentTerms.reset}
          emptyTitle="No payment terms configured yet."
          renderItem={(pt) => (
            <GroupedRow
              key={pt.id}
              onClick={() => {
                setEditingTerm(pt);
                setTermDrawerOpen(true);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {pt.name}
                </span>
                <span className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                  Due in {pt.due_days} days
                </span>
              </div>
            </GroupedRow>
          )}
        />
      </section>

      <Drawer
        open={taxDrawerOpen}
        onClose={() => setTaxDrawerOpen(false)}
        title={editingTax ? editingTax.name : 'New tax'}
        footer={
          canWrite ? (
            <>
              <Pill variant="ghost" onClick={() => setTaxDrawerOpen(false)} disabled={savingTax}>
                Cancel
              </Pill>
              <Pill type="submit" form="tax-form" variant="primary" loading={savingTax}>
                {editingTax ? 'Save tax' : 'Create tax'}
              </Pill>
            </>
          ) : (
            <Pill variant="ghost" onClick={() => setTaxDrawerOpen(false)}>
              Close
            </Pill>
          )
        }
      >
        <DrawerSection title="Tax rate">
          <form id="tax-form" onSubmit={handleSaveTax} className="space-y-4" noValidate>
            <Field
              label="Tax name"
              placeholder="e.g. GST 18%"
              value={taxName}
              onChange={(e) => setTaxName(e.target.value)}
              error={taxFields.name}
              disabled={!canWrite}
              required
            />
            <Field
              label="Rate (%)"
              type="text"
              inputMode="decimal"
              placeholder="18"
              value={ratePercent}
              onChange={(e) => setRatePercent(e.target.value)}
              error={taxFields.rate_bp}
              helpText="Converted to basis points (e.g. 18% = 1800 bp)"
              disabled={!canWrite}
              required
            />
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={taxActive}
                onChange={(e) => setTaxActive(e.target.checked)}
                disabled={!canWrite}
                className="w-4 h-4 accent-[var(--brand-dark)]"
              />
              <span className="text-[14px] font-medium text-[var(--text-primary)]">
                Active tax rate
              </span>
            </label>
          </form>
        </DrawerSection>
      </Drawer>

      <Drawer
        open={termDrawerOpen}
        onClose={() => setTermDrawerOpen(false)}
        title={editingTerm ? editingTerm.name : 'New payment term'}
        footer={
          canWrite ? (
            <>
              <Pill variant="ghost" onClick={() => setTermDrawerOpen(false)} disabled={savingTerm}>
                Cancel
              </Pill>
              <Pill type="submit" form="term-form" variant="primary" loading={savingTerm}>
                {editingTerm ? 'Save term' : 'Create term'}
              </Pill>
            </>
          ) : (
            <Pill variant="ghost" onClick={() => setTermDrawerOpen(false)}>
              Close
            </Pill>
          )
        }
      >
        <DrawerSection title="Payment term">
          <form id="term-form" onSubmit={handleSaveTerm} className="space-y-4" noValidate>
            <Field
              label="Term name"
              placeholder="e.g. Net 15"
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
              error={termFields.name}
              disabled={!canWrite}
              required
            />
            <Field
              label="Due days"
              type="number"
              min={0}
              value={dueDays}
              onChange={(e) => setDueDays(e.target.value)}
              error={termFields.due_days}
              disabled={!canWrite}
              required
            />
          </form>
        </DrawerSection>
      </Drawer>
    </div>
  );
}
