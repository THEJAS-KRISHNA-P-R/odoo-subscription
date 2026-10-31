'use client';

import React from 'react';
import { ChevronRight, Plus } from 'lucide-react';

export interface DashedActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  className?: string;
}

export function DashedActionCard({
  icon,
  title,
  description,
  onClick,
  className = '',
}: DashedActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left bg-[var(--bg-card)] border-[1.5px] border-dashed border-[var(--border-dashed)] rounded-[16px] px-[22px] py-[20px] flex items-center justify-between gap-4 cursor-pointer transition-all duration-150 hover:border-[var(--brand-primary)] hover:bg-[var(--bg-muted)] hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE870] ${className}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative w-[44px] h-[44px] rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
          {icon}
          <span
            className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] flex items-center justify-center border-2 border-[var(--bg-card)]"
            aria-hidden="true"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[var(--text-primary)] leading-[1.35] truncate">
            {title}
          </div>
          <div className="text-[13px] text-[var(--text-secondary)] leading-[1.45] line-clamp-1 mt-0.5">
            {description}
          </div>
        </div>
      </div>
      <ChevronRight
        className="w-5 h-5 text-[var(--text-muted)] shrink-0 transition-transform duration-150 group-hover:translate-x-[3px] group-hover:text-[var(--text-primary)]"
        aria-hidden="true"
      />
    </button>
  );
}
