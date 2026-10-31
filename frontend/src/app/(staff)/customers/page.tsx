'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useList } from '@/lib/useList';
import { formatMinor } from '@/lib/money';
import { Customer, Invoice, Subscription } from '@/lib/types';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow, GroupedRowContainer } from '@/components/ui/GroupedRow';
import { Drawer, DrawerSection } from '@/components/ui/Drawer';
import { Modal } from '@/components/ui/Modal';
import { Field, TextareaField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { SubscriptionDrawer } from '@/components/domain/SubscriptionDrawer';
import { InvoiceDrawer } from '@/components/domain/InvoiceDrawer';

export default function CustomersPage() {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'subscriptions' | 'invoices'>('profile');

  // Create customer modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cCompany, setCCompany] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [createFields, setCreateFields] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // Nested drawers
  const [subDrawerId, setSubDrawerId] = useState<number | string | null>(null);
  const [invDrawerId, setInvDrawerId] = useState<number | string | null>(null);

  const list = useList<Customer>('/customers', {
    q: searchQuery || undefined,
  });

  const customerDetail = useApi<Customer>(
    selectedCustomerId !== null ? `/customers/${selectedCustomerId}` : null
  );

  const customerSubs = useList<Subscription>(
    selectedCustomerId !== null && activeTab === 'subscriptions' ? '/subscriptions' : null,
    selectedCustomerId !== null ? { customer_id: selectedCustomerId } : undefined
  );

  const customerInvoices = useList<Invoice>(
    selectedCustomerId !== null && activeTab === 'invoices' ? '/invoices' : null,
    selectedCustomerId !== null ? { customer_id: selectedCustomerId } : undefined
  );

  // Edit profile state inside drawer
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (customerDetail.data) {
      setEditName(customerDetail.data.name || '');
      setEditEmail(customerDetail.data.email || '');
      setEditCompany(customerDetail.data.company || '');
      setEditPhone(customerDetail.data.phone || '');
      setEditAddress(customerDetail.data.billing_address || '');
      setEditFields({});
    }
  }, [customerDetail.data]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!cName.trim()) errs.name = 'Name is required';
    if (!cEmail.trim() || !cEmail.includes('@')) errs.email = 'Enter a valid email';
    if (Object.keys(errs).length > 0) {
      setCreateFields(errs);
      return;
    }
    setCreateFields({});
    setCreating(true);
    try {
      const created = await api.post<Customer>('/customers', {
        name: cName.trim(),
        email: cEmail.trim(),
        company: cCompany.trim(),
        phone: cPhone.trim(),
        billing_address: cAddress.trim(),
      });
      showToast('Customer added', 'success');
      setCreateOpen(false);
      setCName('');
      setCEmail('');
      setCCompany('');
      setCPhone('');
      setCAddress('');
      await list.reset();
      setSelectedCustomerId(created.id);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setCreateFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Could not create customer', 'error');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    if (!editName.trim()) {
      setEditFields({ name: 'Name is required' });
      return;
    }
    setEditFields({});
    setSavingProfile(true);
    try {
      await api.patch(`/customers/${selectedCustomerId}`, {
        name: editName.trim(),
        email: editEmail.trim(),
        company: editCompany.trim(),
        phone: editPhone.trim(),
        billing_address: editAddress.trim(),
      });
      showToast('Customer profile updated', 'success');
      await Promise.all([customerDetail.reload(), list.reset()]);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setEditFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Update failed', 'error');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Customers
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Directory of customer accounts, billing addresses, subscriptions, and invoices
          </p>
        </div>
        <Pill variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>New customer</span>
        </Pill>
      </div>

      <FilterToolbar
        includeAllOption={false}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search customers by name, email, or company…"
      />

      <DataList<Customer>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="No customers found."
        emptyActionLabel="New customer"
        onEmptyAction={() => setCreateOpen(true)}
        renderItem={(cust) => (
          <GroupedRow
            key={cust.id}
            onClick={() => {
              setSelectedCustomerId(cust.id);
              setActiveTab('profile');
            }}
            ariaLabel={`Open customer ${cust.name}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {cust.name}
                  {cust.company ? (
                    <span className="font-normal text-[var(--text-secondary)]">
                      {' '}
                      · {cust.company}
                    </span>
                  ) : null}
                </div>
                <div className="text-[12px] text-[var(--text-muted)]">{cust.email}</div>
              </div>
              <div className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                {cust.phone || 'No phone'}
              </div>
            </div>
          </GroupedRow>
        )}
      />

      {/* Customer Detail Drawer with Profile / Subscriptions / Invoices tabs */}
      <Drawer
        open={selectedCustomerId !== null}
        onClose={() => setSelectedCustomerId(null)}
        title={customerDetail.data?.name || 'Customer'}
      >
        <DrawerSection>
          <div className="flex items-center gap-2" role="tablist">
            {(['profile', 'subscriptions', 'invoices'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold capitalize cursor-pointer transition-colors ${
                  activeTab === tab
                    ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </DrawerSection>

        {activeTab === 'profile' && (
          <DrawerSection title="Customer profile">
            {customerDetail.loading ? (
              <Skeleton rows={4} />
            ) : customerDetail.error ? (
              <ErrorState
                message={customerDetail.error.message}
                onRetry={customerDetail.reload}
              />
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-4" noValidate>
                <Field
                  label="Full name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  error={editFields.name}
                  required
                />
                <Field
                  label="Email address"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  error={editFields.email}
                  required
                />
                <Field
                  label="Company"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  error={editFields.company}
                />
                <Field
                  label="Phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  error={editFields.phone}
                />
                <TextareaField
                  label="Billing address"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  error={editFields.billing_address}
                />
                <div className="flex justify-end pt-2">
                  <Pill type="submit" variant="primary" size="sm" loading={savingProfile}>
                    Save changes
                  </Pill>
                </div>
              </form>
            )}
          </DrawerSection>
        )}

        {activeTab === 'subscriptions' && (
          <DrawerSection title="Customer subscriptions">
            {customerSubs.loading ? (
              <Skeleton rows={3} />
            ) : customerSubs.error ? (
              <ErrorState message={customerSubs.error.message} onRetry={customerSubs.reset} />
            ) : customerSubs.items.length === 0 ? (
              <EmptyState message="No subscriptions for this customer." />
            ) : (
              <GroupedRowContainer>
                {customerSubs.items.map((sub) => (
                  <GroupedRow
                    key={sub.id}
                    onClick={() => setSubDrawerId(sub.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[14px] font-semibold">{sub.number}</span>
                        <span className="text-[13px] text-[var(--text-secondary)]">
                          {sub.plan_name}
                        </span>
                        <StatusBadge status={sub.status} />
                      </div>
                      <span className="text-[14px] font-bold tabular-nums">
                        {formatMinor(sub.totals?.total_minor ?? 0)}
                      </span>
                    </div>
                  </GroupedRow>
                ))}
              </GroupedRowContainer>
            )}
          </DrawerSection>
        )}

        {activeTab === 'invoices' && (
          <DrawerSection title="Customer invoices">
            {customerInvoices.loading ? (
              <Skeleton rows={3} />
            ) : customerInvoices.error ? (
              <ErrorState
                message={customerInvoices.error.message}
                onRetry={customerInvoices.reset}
              />
            ) : customerInvoices.items.length === 0 ? (
              <EmptyState message="No invoices for this customer." />
            ) : (
              <GroupedRowContainer>
                {customerInvoices.items.map((inv) => (
                  <GroupedRow
                    key={inv.id}
                    onClick={() => setInvDrawerId(inv.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[14px] font-semibold">{inv.number}</span>
                        <StatusBadge status={inv.status} />
                        {inv.is_overdue && <StatusBadge status="overdue" label="Overdue" />}
                      </div>
                      <span className="text-[14px] font-bold tabular-nums">
                        {formatMinor(inv.total_minor)}
                      </span>
                    </div>
                  </GroupedRow>
                ))}
              </GroupedRowContainer>
            )}
          </DrawerSection>
        )}
      </Drawer>

      {/* New Customer Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New customer"
        subtitle="Create a customer profile for subscriptions and invoicing"
        footer={
          <>
            <Pill variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Pill>
            <Pill
              type="submit"
              form="create-customer-form"
              variant="primary"
              loading={creating}
            >
              Create customer
            </Pill>
          </>
        }
      >
        <form id="create-customer-form" onSubmit={handleCreateCustomer} className="space-y-4" noValidate>
          <Field
            label="Full name"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            error={createFields.name}
            required
          />
          <Field
            label="Email address"
            type="email"
            value={cEmail}
            onChange={(e) => setCEmail(e.target.value)}
            error={createFields.email}
            required
          />
          <Field
            label="Company"
            value={cCompany}
            onChange={(e) => setCCompany(e.target.value)}
            error={createFields.company}
          />
          <Field
            label="Phone"
            value={cPhone}
            onChange={(e) => setCPhone(e.target.value)}
            error={createFields.phone}
          />
          <TextareaField
            label="Billing address"
            value={cAddress}
            onChange={(e) => setCAddress(e.target.value)}
            error={createFields.billing_address}
          />
        </form>
      </Modal>

      <SubscriptionDrawer
        subscriptionId={subDrawerId}
        open={subDrawerId !== null}
        onClose={() => setSubDrawerId(null)}
        onUpdated={() => {
          void customerSubs.reset();
        }}
      />

      <InvoiceDrawer
        invoiceId={invDrawerId}
        open={invDrawerId !== null}
        onClose={() => setInvDrawerId(null)}
        onUpdated={() => {
          void customerInvoices.reset();
        }}
      />
    </div>
  );
}
