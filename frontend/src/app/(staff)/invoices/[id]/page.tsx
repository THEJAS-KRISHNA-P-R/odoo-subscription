'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { InvoiceDrawer } from '@/components/domain/InvoiceDrawer';

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const invoiceID = params.id;

  return (
    <>
      <div className="no-print flex items-center justify-between mb-6">
        <h1 className="text-[26px] font-bold text-[var(--text-primary)]">Invoice {invoiceID}</h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] font-semibold cursor-pointer"
        >
          Print invoice
        </button>
      </div>
      <InvoiceDrawer
        invoiceId={invoiceID}
        open
        onClose={() => router.back()}
        mode="staff"
      />
    </>
  );
}
