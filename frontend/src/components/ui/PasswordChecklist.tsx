'use client';

import React from 'react';
import { Check, Circle } from 'lucide-react';
import { checkPasswordRules } from '@/lib/money';

export interface PasswordChecklistProps {
  password: string;
}

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const rules = checkPasswordRules(password);

  const items = [
    { key: 'len', passed: rules.minLength, text: 'More than 8 characters (9+)' },
    { key: 'upper', passed: rules.hasUpper, text: 'At least one uppercase letter (A–Z)' },
    { key: 'lower', passed: rules.hasLower, text: 'At least one lowercase letter (a–z)' },
    { key: 'spec', passed: rules.hasSpecial, text: 'At least one special character (!@#$…)' },
  ];

  return (
    <div
      className="bg-[var(--bg-surface)] rounded-[12px] p-3.5 space-y-2"
      aria-label="Password requirements"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
        Password security rules
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex items-center gap-2 text-[13px] transition-colors ${
              item.passed ? 'text-[var(--brand-dark)] font-medium' : 'text-[var(--text-secondary)]'
            }`}
          >
            {item.passed ? (
              <span className="w-4 h-4 rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] inline-flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
              </span>
            ) : (
              <Circle className="w-4 h-4 text-[var(--text-disabled)] shrink-0" aria-hidden="true" />
            )}
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
