'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useList } from '@/lib/useList';
import { formatMinor, todayIsoDate } from '@/lib/money';
import {
  Customer,
  Plan,
  Template,
  Product,
  PaymentTerm,
  Subscription,
} from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Field, SelectField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { GroupedRow, GroupedRowContainer } from '@/components/ui/GroupedRow';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

export interface NewSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (createdSub: Subscription) => void;
}

interface DraftLine {
  product_id: string;
  variant_id: string;
  quantity: number;
}

export function NewSubscriptionModal({
  open,
  onClose,
  onCreated,
}: NewSubscriptionModalProps) {
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Inline create customer state
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerCompany, setNewCustomerCompany] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [customerFields, setCustomerFields] = useState<Record<string, string>>({});
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Step 2: Plan or Template
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Step 3: Lines
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Step 4: Payment term & dates
  const [paymentTermId, setPaymentTermId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(todayIsoDate());
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const customersList = useList<Customer>(
    open && step === 1 ? '/customers' : null,
    { q: customerSearch || undefined },
    10
  );
  const plansList = useList<Plan>(open && step >= 2 ? '/plans' : null, undefined, 50);
  const templatesList = useList<Template>(open && step === 2 ? '/templates' : null, undefined, 50);
  const productsList = useList<Product>(open && step === 3 ? '/products' : null, undefined, 50);
  const termsList = useList<PaymentTerm>(open && step === 4 ? '/payment-terms' : null, undefined, 50);

  const selectedPlan = useMemo(
    () => plansList.items.find((p) => String(p.id) === String(selectedPlanId)) || null,
    [plansList.items, selectedPlanId]
  );

  const minQty = selectedPlan?.min_quantity || 1;

  const handleCreateCustomerInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!newCustomerName.trim()) errs.name = 'Name is required';
    if (!newCustomerEmail.trim() || !newCustomerEmail.includes('@')) {
      errs.email = 'Enter a valid email';
    }
    if (Object.keys(errs).length > 0) {
      setCustomerFields(errs);
      return;
    }
    setCustomerFields({});
    setSavingCustomer(true);
    try {
      const created = await api.post<Customer>('/customers', {
        name: newCustomerName.trim(),
        email: newCustomerEmail.trim(),
        company: newCustomerCompany.trim(),
        phone: newCustomerPhone.trim(),
        billing_address: newCustomerAddress.trim(),
      });
      setSelectedCustomer(created);
      setCreatingCustomer(false);
      showToast('Customer created', 'success');
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setCustomerFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Failed to create customer', 'error');
      }
    } finally {
      setSavingCustomer(false);
    }
  };

  const applyTemplate = (tpl: Template) => {
    setSelectedTemplateId(String(tpl.id));
    setSelectedPlanId(String(tpl.plan_id));
    const mappedLines: DraftLine[] = (tpl.lines || []).map((l) => ({
      product_id: String(l.product_id),
      variant_id: l.variant_id ? String(l.variant_id) : '',
      quantity: Math.max(l.quantity, 1),
    }));
    setLines(mappedLines);
    setStep(3);
  };

  const addEmptyLine = () => {
    const firstProd = productsList.items[0];
    setLines((prev) => [
      ...prev,
      {
        product_id: firstProd ? String(firstProd.id) : '',
        variant_id: '',
        quantity: minQty,
      },
    ]);
  };

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const computeLineUnitMinor = (line: DraftLine): number => {
    const prod = productsList.items.find((p) => String(p.id) === String(line.product_id));
    if (!prod) return 0;
    const variant = (prod.variants || []).find((v) => String(v.id) === String(line.variant_id));
    return (prod.sales_price_minor || 0) + (variant?.extra_price_minor || 0);
  };

  const handleSubmitSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setStep(1);
      return;
    }
    const clientErrs: Record<string, string> = {};
    if (!selectedPlanId) {
      clientErrs.plan_id = 'Select a plan';
    }
    if (!startDate) {
      clientErrs.start_date = 'Start date is required';
    }
    if (expiryDate && expiryDate < startDate) {
      clientErrs.expiry_date = 'End date must be after start date';
    }
    if (lines.length === 0) {
      clientErrs.lines = 'Add at least one product line';
    }
    for (const l of lines) {
      if (l.quantity < minQty) {
        clientErrs.quantity = `Minimum quantity for this plan is ${minQty}`;
      }
    }
    if (Object.keys(clientErrs).length > 0) {
      setFields(clientErrs);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      const created = await api.post<Subscription>('/subscriptions', {
        customer_id: selectedCustomer.id,
        plan_id: selectedPlanId,
        payment_term_id: paymentTermId || null,
        start_date: startDate,
        expiry_date: expiryDate || null,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id || null,
          quantity: Number(l.quantity),
        })),
      });
      showToast(`Subscription ${created.number} created`, 'success');
      onCreated(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Failed to create subscription', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const stepsMeta = [
    { num: 1, title: 'Customer' },
    { num: 2, title: 'Plan or Template' },
    { num: 3, title: 'Product Lines' },
    { num: 4, title: 'Terms & Dates' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New subscription"
      subtitle="Configure customer, billing plan, product lines, and payment schedule"
      footer={
        <>
          {step > 1 && (
            <Pill
              variant="outline"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
              disabled={submitting}
              className="mr-auto"
            >
              Back
            </Pill>
          )}
          <Pill variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Pill>
          {step < 4 ? (
            <Pill
              variant="primary"
              onClick={() => {
                if (step === 1 && !selectedCustomer) {
                  showToast('Select or create a customer first', 'error');
                  return;
                }
                if (step === 2 && !selectedPlanId) {
                  showToast('Choose a plan or template to continue', 'error');
                  return;
                }
                if (step === 3 && lines.length === 0) {
                  showToast('Add at least one line item', 'error');
                  return;
                }
                setStep((s) => ((s + 1) as 1 | 2 | 3 | 4));
              }}
            >
              Continue
            </Pill>
          ) : (
            <Pill
              type="submit"
              form="new-subscription-form"
              variant="primary"
              loading={submitting}
            >
              Create subscription
            </Pill>
          )}
        </>
      }
    >
      {/* Stepper indicator */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {stepsMeta.map((s) => {
          const active = step === s.num;
          const done = step > s.num;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => {
                if (s.num < step) setStep(s.num as 1 | 2 | 3 | 4);
              }}
              className={`flex items-center gap-2 p-2.5 rounded-[12px] text-left transition-colors ${
                active
                  ? 'bg-[var(--brand-tint)] text-[var(--brand-dark)] font-semibold'
                  : done
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer'
                  : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full text-[12px] font-bold inline-flex items-center justify-center shrink-0 ${
                  active || done
                    ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]'
                    : 'bg-white text-[var(--text-muted)]'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : s.num}
              </span>
              <span className="text-[12px] truncate">{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* Step 1: Customer */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--text-secondary)]">
              {selectedCustomer
                ? `Selected: ${selectedCustomer.name} (${selectedCustomer.email})`
                : 'Select an existing customer or create one inline'}
            </span>
            <Pill
              variant="soft"
              size="sm"
              onClick={() => setCreatingCustomer((v) => !v)}
            >
              {creatingCustomer ? 'Choose existing' : 'Create customer'}
            </Pill>
          </div>

          {creatingCustomer ? (
            <form onSubmit={handleCreateCustomerInline} className="space-y-3 bg-[var(--bg-muted)] p-4 rounded-[16px]" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Full name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  error={customerFields.name}
                  required
                />
                <Field
                  label="Email"
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  error={customerFields.email}
                  required
                />
                <Field
                  label="Company"
                  value={newCustomerCompany}
                  onChange={(e) => setNewCustomerCompany(e.target.value)}
                  error={customerFields.company}
                />
                <Field
                  label="Phone"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  error={customerFields.phone}
                />
              </div>
              <Field
                label="Billing address"
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
                error={customerFields.billing_address}
              />
              <div className="flex justify-end pt-2">
                <Pill type="submit" variant="primary" size="sm" loading={savingCustomer}>
                  Save & select customer
                </Pill>
              </div>
            </form>
          ) : (
            <>
              <Field
                label="Search customers"
                type="search"
                placeholder="Search by name, company, or email…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customersList.loading ? (
                <Skeleton rows={3} />
              ) : customersList.error ? (
                <ErrorState message={customersList.error.message} onRetry={customersList.reset} />
              ) : customersList.items.length === 0 ? (
                <EmptyState
                  message="No customers found."
                  actionLabel="Create customer"
                  onAction={() => setCreatingCustomer(true)}
                />
              ) : (
                <GroupedRowContainer>
                  {customersList.items.map((c) => {
                    const isSelected = selectedCustomer?.id === c.id;
                    return (
                      <GroupedRow
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setStep(2);
                        }}
                        className={isSelected ? 'ring-2 ring-inset ring-[var(--brand-primary)]' : ''}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                              {c.name} {c.company ? `· ${c.company}` : ''}
                            </div>
                            <div className="text-[12px] text-[var(--text-muted)]">{c.email}</div>
                          </div>
                          <span className="text-[12px] font-semibold text-[var(--brand-dark)]">
                            {isSelected ? 'Selected' : 'Select →'}
                          </span>
                        </div>
                      </GroupedRow>
                    );
                  })}
                </GroupedRowContainer>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: Template or Plan */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Option A: Pick a billing plan
            </h3>
            {plansList.loading ? (
              <Skeleton rows={2} />
            ) : plansList.error ? (
              <ErrorState message={plansList.error.message} onRetry={plansList.reset} />
            ) : plansList.items.length === 0 ? (
              <EmptyState message="No plans available in catalog." />
            ) : (
              <GroupedRowContainer>
                {plansList.items.map((plan) => {
                  const isChosen = String(plan.id) === String(selectedPlanId);
                  return (
                    <GroupedRow
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlanId(String(plan.id));
                        setSelectedTemplateId('');
                        setStep(3);
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                            {plan.name}
                          </div>
                          <div className="text-[12px] text-[var(--text-muted)]">
                            Period: {plan.billing_period} · Min qty: {plan.min_quantity}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums">
                            {formatMinor(plan.price_minor)}
                          </div>
                          <div className="text-[11px] font-semibold text-[var(--brand-dark)]">
                            {isChosen ? 'Selected' : 'Choose plan'}
                          </div>
                        </div>
                      </div>
                    </GroupedRow>
                  );
                })}
              </GroupedRowContainer>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Option B: Start from a template
            </h3>
            {templatesList.loading ? (
              <Skeleton rows={2} />
            ) : templatesList.error ? (
              <ErrorState message={templatesList.error.message} onRetry={templatesList.reset} />
            ) : templatesList.items.length === 0 ? (
              <EmptyState message="No subscription templates configured." />
            ) : (
              <GroupedRowContainer>
                {templatesList.items.map((tpl) => (
                  <GroupedRow
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                          {tpl.name}
                        </div>
                        <div className="text-[12px] text-[var(--text-muted)]">
                          Plan: {tpl.plan_name} · Validity: {tpl.validity_days} days ·{' '}
                          {(tpl.lines || []).length} lines
                        </div>
                      </div>
                      <span className="text-[12px] font-semibold text-[var(--brand-dark)]">
                        {String(tpl.id) === selectedTemplateId ? 'Applied' : 'Use template →'}
                      </span>
                    </div>
                  </GroupedRow>
                ))}
              </GroupedRowContainer>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Lines */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] text-[var(--text-secondary)]">
              Plan minimum quantity per line: <strong className="tabular-nums">{minQty}</strong>
            </div>
            <Pill variant="soft" size="sm" onClick={addEmptyLine}>
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add line</span>
            </Pill>
          </div>

          {productsList.loading ? (
            <Skeleton rows={3} />
          ) : productsList.error ? (
            <ErrorState message={productsList.error.message} onRetry={productsList.reset} />
          ) : lines.length === 0 ? (
            <EmptyState
              message="No product lines added yet."
              actionLabel="Add first product line"
              onAction={addEmptyLine}
            />
          ) : (
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const prod = productsList.items.find(
                  (p) => String(p.id) === String(line.product_id)
                );
                const variants = prod?.variants || [];
                const unitMinor = computeLineUnitMinor(line);
                const lineTotalMinor = unitMinor * (Number(line.quantity) || 0);

                return (
                  <div
                    key={idx}
                    className="bg-[var(--bg-surface)] rounded-[16px] p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <SelectField
                        label="Product"
                        value={line.product_id}
                        onChange={(e) =>
                          updateLine(idx, { product_id: e.target.value, variant_id: '' })
                        }
                        required
                      >
                        <option value="">Select product…</option>
                        {productsList.items.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatMinor(p.sales_price_minor)})
                          </option>
                        ))}
                      </SelectField>

                      <SelectField
                        label="Variant"
                        value={line.variant_id}
                        onChange={(e) => updateLine(idx, { variant_id: e.target.value })}
                        disabled={variants.length === 0}
                      >
                        <option value="">Standard (no extra price)</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.attribute}: {v.value} (+{formatMinor(v.extra_price_minor)})
                          </option>
                        ))}
                      </SelectField>

                      <Field
                        label="Quantity"
                        type="number"
                        min={minQty}
                        value={String(line.quantity)}
                        onChange={(e) =>
                          updateLine(idx, {
                            quantity: Math.max(1, parseInt(e.target.value || '1', 10)),
                          })
                        }
                        error={
                          line.quantity < minQty
                            ? `Min quantity is ${minQty}`
                            : undefined
                        }
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[13px]">
                      <span className="text-[var(--text-secondary)] tabular-nums">
                        Unit: {formatMinor(unitMinor)} × {line.quantity} ={' '}
                        <strong className="text-[var(--text-primary)]">
                          {formatMinor(lineTotalMinor)}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        aria-label={`Remove line ${idx + 1}`}
                        className="text-[var(--danger-fg)] hover:underline inline-flex items-center gap-1 text-[12px] font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Payment terms and dates */}
      {step === 4 && (
        <form
          id="new-subscription-form"
          onSubmit={handleSubmitSubscription}
          className="space-y-4"
          noValidate
        >
          {termsList.loading ? (
            <Skeleton rows={2} />
          ) : termsList.error ? (
            <ErrorState message={termsList.error.message} onRetry={termsList.reset} />
          ) : (
            <SelectField
              label="Payment term"
              value={paymentTermId}
              onChange={(e) => setPaymentTermId(e.target.value)}
              error={fields.payment_term_id}
            >
              <option value="">Select payment term…</option>
              {termsList.items.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name} ({pt.due_days} days)
                </option>
              ))}
            </SelectField>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={fields.start_date}
              required
            />
            <Field
              label="Expiry date"
              type="date"
              min={startDate}
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              error={fields.expiry_date}
              helpText="Leave blank for open-ended subscription"
            />
          </div>

          {fields.lines && (
            <p className="text-[12px] font-medium text-[var(--danger-fg)]">{fields.lines}</p>
          )}
          {fields.quantity && (
            <p className="text-[12px] font-medium text-[var(--danger-fg)]">{fields.quantity}</p>
          )}
        </form>
      )}
    </Modal>
  );
}
