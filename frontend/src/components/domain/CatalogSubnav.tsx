'use client';

/**
 * @file components/domain/CatalogSubnav.tsx
 * @description Horizontal pill navigation bar shared across all /catalog/* screens
 * (Products, Plans, Templates, Taxes & Terms, Discounts) to reduce visual load and
 * enable single-click switching across the entire product/plan setup lifecycle.
 */

import React from 'react';
import { Package, Layers, FileSpreadsheet, Percent, Tag } from 'lucide-react';
import { Link, usePathname } from '@/lib/router';

const CATALOG_TABS: Array<{ href: string; label: string; icon: React.ReactNode }> = [
  {
    href: '/catalog/products',
    label: 'Products & Variants',
    icon: <Package className="w-4 h-4 shrink-0" />,
  },
  {
    href: '/catalog/plans',
    label: 'Billing Plans',
    icon: <Layers className="w-4 h-4 shrink-0" />,
  },
  {
    href: '/catalog/templates',
    label: 'Quotation Templates',
    icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
  },
  {
    href: '/catalog/taxes',
    label: 'Taxes & Terms',
    icon: <Percent className="w-4 h-4 shrink-0" />,
  },
  {
    href: '/catalog/discounts',
    label: 'Discounts',
    icon: <Tag className="w-4 h-4 shrink-0" />,
  },
];

export function CatalogSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Catalog sections"
      className="flex items-center gap-2 overflow-x-auto pb-1 no-print"
    >
      {CATALOG_TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-all duration-150 ${
              active
                ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
