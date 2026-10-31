'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { EnumOption } from '@/lib/types';

export interface FilterToolbarProps {
  statusOptions?: EnumOption[];
  activeStatus?: string;
  onStatusChange?: (value: string) => void;
  includeAllOption?: boolean;
  extraPills?: Array<{ value: string; label: string }>;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  rightSlot?: React.ReactNode;
}

export function FilterToolbar({
  statusOptions = [],
  activeStatus = '',
  onStatusChange,
  includeAllOption = true,
  extraPills = [],
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search…',
  rightSlot,
}: FilterToolbarProps) {
  const pills: EnumOption[] = [
    ...(includeAllOption ? [{ value: '', label: 'All' }] : []),
    ...statusOptions,
    ...extraPills,
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {onStatusChange && pills.length > 0 && (
        <div
          className="flex items-center gap-1.5 flex-wrap"
          role="group"
          aria-label="Filter by status"
        >
          {pills.map((opt) => {
            const isActive = activeStatus === opt.value;
            return (
              <button
                key={opt.value || '__all__'}
                type="button"
                onClick={() => onStatusChange(opt.value)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE870] ${
                  isActive
                    ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ml-auto w-full lg:w-auto">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 sm:w-[260px]">
            <Search
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-[42px] pl-10 pr-9 rounded-full bg-[var(--bg-surface)] border border-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:bg-[var(--bg-card)] focus:border-[var(--border-hair)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        {rightSlot}
      </div>
    </div>
  );
}
