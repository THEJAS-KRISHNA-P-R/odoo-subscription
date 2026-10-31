'use client';

import React, { useState } from 'react';
import { FileDown } from 'lucide-react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useOrgSettings } from '@/lib/orgSettings';
import { formatMinor } from '@/lib/money';
import { Invoice } from '@/lib/types';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/Toast';
import { InvoiceDrawer } from '@/components/domain/InvoiceDrawer';

export default function PortalInvoicesPage() {
  const { showToast } = useToast();
  const { settings } = useOrgSettings();
  const list = useList<Invoice>('/me/invoices');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | string | null>(null);

  const handleDownloadPdf = async (e: React.MouseEvent, inv: Invoice) => {
    e.stopPropagation();
    setDownloadingPdfId(inv.id);
    try {
      await api.download(
        `/me/invoices/${inv.id}?format=pdf`,
        `invoice-${inv.number}.pdf`
      );
      showToast(`Downloaded PDF for ${inv.number}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF download failed', 'error');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
          My invoices
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">
          Select any invoice to view line items, applied payments, or download a branded PDF tax statement
        </p>
      </div>

      <DataList<Invoice>
        items={list.items}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        onRetry={list.reset}
        nextCursor={list.nextCursor}
        onLoadMore={list.loadMore}
        emptyTitle="You have no invoices yet."
        renderItem={(inv) => (
          <GroupedRow
            key={inv.id}
            onClick={() => setSelectedInvoiceId(inv.id)}
            ariaLabel={`Open invoice ${inv.number}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
                  {inv.number}
                </span>
                <span className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                  {inv.period_start} → {inv.period_end}
                </span>
                <StatusBadge status={inv.status} />
                {inv.is_overdue && <StatusBadge status="overdue" label="Overdue" />}
              </div>

              <div className="flex items-center gap-5 text-[14px]">
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
                {settings.portalAllowPdfDownload && (
                  <Pill
                    variant="ghost"
                    size="sm"
                    loading={downloadingPdfId === inv.id}
                    onClick={(e) => handleDownloadPdf(e, inv)}
                  >
                    <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>PDF</span>
                  </Pill>
                )}
              </div>
            </div>
          </GroupedRow>
        )}
      />

      <InvoiceDrawer
        invoiceId={selectedInvoiceId}
        open={selectedInvoiceId !== null}
        onClose={() => setSelectedInvoiceId(null)}
        mode="portal"
      />
    </div>
  );
}
