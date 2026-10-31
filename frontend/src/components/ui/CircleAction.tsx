'use client';

import React from 'react';
import { Plus } from 'lucide-react';

export interface CircleActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children?: React.ReactNode;
}

export function CircleAction({ label, children, className = '', ...rest }: CircleActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`w-[52px] h-[52px] rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] inline-flex items-center justify-center font-bold text-[26px] cursor-pointer transition-all duration-150 hover:bg-[var(--brand-primary-hover)] hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163300] focus-visible:ring-offset-2 shrink-0 ${className}`}
      {...rest}
    >
      {children || <Plus className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />}
    </button>
  );
}
