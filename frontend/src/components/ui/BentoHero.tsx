'use client';

import React from 'react';

export interface BentoHeroProps {
  tone?: 'yellow' | 'blue' | 'purple';
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function BentoHero({
  tone = 'yellow',
  title,
  subtitle,
  action,
  icon,
  className = '',
}: BentoHeroProps) {
  const toneStyles: Record<NonNullable<BentoHeroProps['tone']>, string> = {
    yellow: 'bg-[var(--hero-yellow)] text-[var(--hero-yellow-fg)]',
    blue: 'bg-[var(--hero-blue)] text-[var(--hero-blue-fg)]',
    purple: 'bg-[var(--hero-purple)] text-[var(--hero-purple-fg)]',
  };

  return (
    <div
      className={`rounded-[24px] px-[36px] py-[32px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[var(--shadow-diffuse)] ${toneStyles[tone]} ${className}`}
    >
      <div className="space-y-2 max-w-xl">
        <h2 className="text-[22px] font-bold tracking-[-0.02em] leading-[1.25]">{title}</h2>
        {subtitle && <p className="text-[14px] leading-[1.55] opacity-90">{subtitle}</p>}
        {action && <div className="pt-3">{action}</div>}
      </div>
      {icon && (
        <div className="shrink-0 opacity-80 hidden sm:flex items-center justify-center w-16 h-16 rounded-2xl bg-white/40">
          {icon}
        </div>
      )}
    </div>
  );
}
