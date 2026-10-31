'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Download, FileDown, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useEnum } from '@/lib/meta';
import { useList } from '@/lib/useList';
import { useSearchParams, useRouter } from '@/lib/router';
import { formatMinor, todayIsoDate } from '@/lib/money';
import { Invoice } from '@/lib/types';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/Toast';
import { InvoiceDrawer } from '@/components/domain/InvoiceDrawer';

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const invoiceStatuses = useEnum('invoice_status');

  const initialOverdue = searchParams.get('overdue') === 'true';
  const initialStatus = searchParams.get('status') || '';
  const customerIdParam = searchParams.get('customer_id') || '';
  const subscriptionIdParam = searchParams.get('subscription_id') || '';

  const [activePill, setActivePill] = useState<string>(
    initialOverdue ? '__overdue__' : initialStatus
  );
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | string | null>(null);

  useEffect(() => {
    if (searchParams.get('overdue') === 'true') {
      setActivePill('__overdue__');
    } else if (searchParams.get('status')) {
      setActivePill(searchParams.get('status') || '');
    }
  }, [searchParams]);

  const isOverdueFilter = activePill === '__overdue__';
  const statusParam = !isOverdueFilter && activePill ? activePill : undefined;

  // Build active filter object used by both GET /invoices and GET /invoices?format=csv
  const activeFilters = useMemo(
    () => ({
      status: statusParam,
      overdue: isOverdueFilter ? true : undefined,
      customer_id: customerIdParam || undefined,
      subscription_id: subscriptionIdParam || undefined,
      q: searchQuery.trim() || undefined,
    }),
    [statusParam, isOverdueFilter, customerIdParam, subscriptionIdParam, searchQuery]
  );

  const list = useList<Invoice>('/invoices', activeFilters);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const params = new URLSearchParams({ format: 'csv' });
      if (activeFilters.status) params.set('status', activeFilters.status);
      if (activeFilters.overdue) params.set('overdue', 'true');
      if (activeFilters.customer_id) params.set('customer_id', activeFilters.customer_id);
      if (activeFilters.subscription_id) {
        params.set('subscription_id', activeFilters.subscription_id);
      }
      if (activeFilters.q) params.set('q', activeFilters.q);

      await api.download(
        `/invoices?${params.toString()}`,
        `invoices-${todayIsoDate()}.csv`
      );
      showToast('Invoices CSV exported', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export CSV', 'error');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDownloadInvoicePdf = async (e: React.MouseEvent, inv: Invoice) => {
    e.stopPropagation();
    setDownloadingPdfId(inv.id);
    try {
      await api.download(
        `/invoices/${inv.id}?format=pdf`,
        `invoice-${inv.number}.pdf`
      );
      showToast(`Downloaded PDF for ${inv.number}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download PDF', 'error');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const clearEntityFilter = () => {
    router.push('/invoices');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Invoices
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Track issued invoices, confirm drafts, download PDF tax statements, export CSV reports, and record payments
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Pill
            variant="outline"
            loading={exportingCsv}
            onClick={handleExportCsv}
            aria-label="Export CSV with current filters"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Export CSV</span>
          </Pill>
        </div>
      </div>

      {(customerIdParam || subscriptionIdParam) && (
        <div className="flex flex-wrap items-center gap-2">
          {customerIdParam && (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-surface)] text-[12px] font-semibold text-[var(--text-primary)]">
              <span>Customer #{customerIdParam}</span>
              <button
                type="button"
                onClick={clearEntityFilter}
                aria-label="Clear customer filter"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          {subscriptionIdParam && (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-surface)] text-[12px] font-semibold text-[var(--text-primary)]">
              <span>Subscription #{subscriptionIdParam}</span>
              <button
                type="button"
                onClick={clearEntityFilter}
                aria-label="Clear subscription filter"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
        </div>
      )}

      <FilterToolbar
        statusOptions={invoiceStatuses}
        extraPills={[{ value: '__overdue__', label: 'Overdue' }]}
        activeStatus={activePill}
        onStatusChange={setActivePill}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by invoice number or customer…"
      />

      <DataList<Invoice>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="No invoices found for the selected filter."
        renderItem={(inv) => (
          <GroupedRow
            key={inv.id}
            onClick={() => setSelectedInvoiceId(inv.id)}
            ariaLabel={`Open invoice ${inv.number}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
                  {inv.number}
                </span>
                <span className="text-[14px] text-[var(--text-secondary)] truncate">
                  {inv.customer_name}
                </span>
                <StatusBadge status={inv.status} />
                {inv.is_overdue && <StatusBadge status="overdue" label="Overdue" />}
              </div>

              <div className="flex flex-wrap items-center gap-5 text-[14px] sm:justify-end">
                <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
                  Due {inv.due_date}
                </span>
                <div className="text-right tabular-nums">
                  <div className="font-bold text-[var(--text-primary)]">
                    {formatMinor(inv.total_minor)}
                  </div>
                  {inv.outstanding_minor > 0 && (
                    <div className="text-[12px] text-[var(--text-secondary)]">
                      {formatMinor(inv.outstanding_minor)} due
                    </div>
                  )}
                </div>
                <Pill
                  variant="ghost"
                  size="sm"
                  loading={downloadingPdfId === inv.id}
                  onClick={(e) => handleDownloadInvoicePdf(e, inv)}
                  title={`Download PDF for ${inv.number}`}
                >
                  <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>PDF</span>
                </Pill>
              </div>
            </div>
          </GroupedRow>
        )}
      />

      <InvoiceDrawer
        invoiceId={selectedInvoiceId}
        open={selectedInvoiceId !== null}
        onClose={() => setSelectedInvoiceId(null)}
        onUpdated={() => {
          void list.reset();
        }}
      />
    </div>
  );
}
