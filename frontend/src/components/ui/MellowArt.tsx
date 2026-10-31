import React from 'react';

/**
 * Custom mellow and clean brand logo for Brightloop.
 * An elegant continuous Möbius / infinite subscription loop with soft geometric curves.
 */
export function BrandLoopLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 hover:scale-[1.05] ${className}`}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="12" fill="#9FE870" />
      {/* Sleek recurring loop path in dark forest tone */}
      <path
        d="M13 23.5C11.067 23.5 9.5 21.933 9.5 20C9.5 18.067 11.067 16.5 13 16.5C15.4 16.5 18.2 19.5 20 21.5C21.8 23.5 24.6 26.5 27 26.5C28.933 26.5 30.5 24.933 30.5 23C30.5 21.067 28.933 19.5 27 19.5C24.6 19.5 21.8 16.5 20 14.5C18.2 12.5 15.4 9.5 13 9.5"
        stroke="#163300"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dynamic orbital dot */}
      <circle cx="28.5" cy="14" r="2.2" fill="#163300" />
    </svg>
  );
}

/**
 * Custom mellow, clean vector illustration for the "Run today's billing" Bento Hero.
 * Soft layered invoice statements, mellow calendar disc, and gentle currency token.
 */
export function BillingRunArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="132"
      height="100"
      viewBox="0 0 132 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Background soft ambient halo */}
      <circle cx="66" cy="50" r="42" fill="currentColor" fillOpacity="0.08" />

      {/* Back bill statement sheet */}
      <rect
        x="22"
        y="14"
        width="56"
        height="68"
        rx="10"
        fill="#FFFFFF"
        fillOpacity="0.7"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="1.5"
        transform="rotate(-6 22 14)"
      />
      <rect
        x="32"
        y="26"
        width="28"
        height="4"
        rx="2"
        fill="currentColor"
        fillOpacity="0.2"
        transform="rotate(-6 32 26)"
      />
      <rect
        x="30"
        y="35"
        width="38"
        height="3"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.15"
        transform="rotate(-6 30 35)"
      />

      {/* Front calendar & billing card */}
      <rect
        x="42"
        y="18"
        width="66"
        height="64"
        rx="14"
        fill="#FFFFFF"
        fillOpacity="0.95"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />

      {/* Calendar header pill */}
      <rect x="42" y="18" width="66" height="18" rx="14" fill="#9FE870" />
      <rect x="42" y="26" width="66" height="10" fill="#9FE870" />

      {/* Two calendar binder rings */}
      <rect x="56" y="14" width="4" height="8" rx="2" fill="#163300" />
      <rect x="88" y="14" width="4" height="8" rx="2" fill="#163300" />

      {/* Internal clean date grid dots */}
      <circle cx="58" cy="46" r="3" fill="currentColor" fillOpacity="0.2" />
      <circle cx="75" cy="46" r="3" fill="currentColor" fillOpacity="0.2" />
      <circle cx="92" cy="46" r="3" fill="currentColor" fillOpacity="0.2" />
      <circle cx="58" cy="62" r="3" fill="currentColor" fillOpacity="0.2" />
      <circle cx="75" cy="62" r="4.5" fill="#163300" />
      <circle cx="92" cy="62" r="3" fill="currentColor" fillOpacity="0.2" />

      {/* Recurring sync arrow token */}
      <g transform="translate(86, 54)">
        <circle cx="16" cy="16" r="16" fill="#163300" />
        <path
          d="M16 10C19.3137 10 22 12.6863 22 16C22 17.5 21.4 18.8 20.5 19.8L21 21M16 22C12.6863 22 10 19.3137 10 16C10 14.5 10.6 13.2 11.5 12.2L11 11"
          stroke="#9FE870"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M22 19.5V22H19.5" stroke="#9FE870" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 12.5V10H12.5" stroke="#9FE870" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * Custom mellow, clean vector illustration for the "Next invoice due" Bento Hero.
 * Soft floating tax invoice statement with elegant lines and status check emblem.
 */
export function InvoiceDueArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="132"
      height="100"
      viewBox="0 0 132 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Ambient background glow */}
      <circle cx="68" cy="50" r="40" fill="currentColor" fillOpacity="0.08" />

      {/* Back ledger shadow card */}
      <rect
        x="24"
        y="14"
        width="68"
        height="72"
        rx="12"
        fill="#FFFFFF"
        fillOpacity="0.6"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1.5"
        transform="rotate(5 24 14)"
      />

      {/* Main clean invoice sheet */}
      <rect
        x="28"
        y="12"
        width="70"
        height="76"
        rx="14"
        fill="#FFFFFF"
        fillOpacity="0.95"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />

      {/* Sheet header badge */}
      <rect x="40" y="24" width="22" height="6" rx="3" fill="#93C5FD" fillOpacity="0.6" />
      <rect x="76" y="24" width="12" height="6" rx="3" fill="currentColor" fillOpacity="0.15" />

      {/* Invoice line items */}
      <rect x="40" y="38" width="46" height="4" rx="2" fill="currentColor" fillOpacity="0.2" />
      <rect x="40" y="48" width="36" height="4" rx="2" fill="currentColor" fillOpacity="0.15" />
      <rect x="40" y="58" width="42" height="4" rx="2" fill="currentColor" fillOpacity="0.15" />

      {/* Subtotal line */}
      <line x1="40" y1="68" x2="86" y2="68" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" strokeDasharray="3 3" />

      {/* Floating verified payment / due token */}
      <g transform="translate(82, 52)">
        <circle cx="16" cy="16" r="16" fill="#1E3A8A" />
        <path
          d="M11 16.5L14.5 20L21 12.5"
          stroke="#9FE870"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/**
 * Custom mellow, clean vector illustration for the "All caught up" state.
 */
export function AllCaughtUpArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="100"
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="50" r="38" fill="currentColor" fillOpacity="0.08" />
      <circle cx="60" cy="50" r="28" fill="#FFFFFF" fillOpacity="0.9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <circle cx="60" cy="50" r="20" fill="#9FE870" />
      <path
        d="M53 50.5L58 55.5L68 45"
        stroke="#163300"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Custom mellow, clean illustration for Empty State screens.
 * Replaces the raw Lucide Inbox icon with a gentle layered document tray.
 */
export function EmptyStateArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="28" cy="28" r="26" fill="var(--bg-surface)" stroke="var(--border-hair)" strokeWidth="1.5" />
      {/* Gentle folder base */}
      <rect x="14" y="20" width="28" height="20" rx="6" fill="var(--bg-card)" stroke="var(--border-dashed)" strokeWidth="1.5" />
      {/* Front pocket with smooth dipped center */}
      <path
        d="M14 26C14 22.6863 16.6863 20 20 20H23.5L25.5 22.5H36C39.3137 22.5 42 25.1863 42 28.5V34C42 37.3137 39.3137 40 36 40H20C16.6863 40 14 37.3137 14 34V26Z"
        fill="var(--bg-surface)"
        stroke="var(--border-hair)"
        strokeWidth="1.2"
      />
      {/* Soft floating spark / accent dot */}
      <circle cx="37" cy="18" r="2.5" fill="#9FE870" />
      <path d="M22 29H34" stroke="var(--text-disabled)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Clean mellow illustration for "New subscription" quick action.
 */
export function NewSubscriptionArt() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="4" fill="var(--bg-card)" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="4" width="18" height="5" rx="4" fill="#9FE870" />
      <path d="M8 14H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 11V17" stroke="#163300" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Clean mellow illustration for "Record payment" quick action.
 */
export function RecordPaymentArt() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="4" fill="var(--bg-card)" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="8" width="18" height="3" fill="#9FE870" />
      <circle cx="16" cy="15" r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * Clean mellow illustration for "View overdue" quick action.
 */
export function OverdueAlertArt() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" fill="var(--bg-card)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 9H20" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="14" r="2.5" fill="#F87171" />
      <path d="M8 2V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 2V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Mellow vector illustration for Subscriptions section.
 * Features recurring cycle loops, active contract badge, and lifecycle progression nodes.
 */
export function SubscriptionsHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      {/* Base plan card */}
      <rect x="22" y="16" width="76" height="56" rx="14" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
      {/* Top accent badge */}
      <rect x="32" y="26" width="32" height="7" rx="3.5" fill="#9FE870" />
      <rect x="70" y="26" width="18" height="7" rx="3.5" fill="currentColor" fillOpacity="0.15" />
      {/* Recurring wave timeline */}
      <path
        d="M32 48C38 43 44 53 50 48C56 43 62 53 68 48C74 43 80 53 88 48"
        stroke="#163300"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Active renewal status token */}
      <g transform="translate(80, 44)">
        <circle cx="14" cy="14" r="14" fill="#163300" />
        <path d="M10 14L13 17L18 11" stroke="#9FE870" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/**
 * Mellow vector illustration for Invoices section.
 * Clean tax invoice statement with INR currency token and verified stamp.
 */
export function InvoicesHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      {/* Back ledger card */}
      <rect x="24" y="14" width="60" height="60" rx="12" fill="#FFFFFF" fillOpacity="0.65" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" transform="rotate(-5 24 14)" />
      {/* Main invoice card */}
      <rect x="30" y="12" width="64" height="64" rx="14" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <rect x="40" y="22" width="22" height="6" rx="3" fill="#9FE870" />
      <rect x="68" y="22" width="16" height="6" rx="3" fill="currentColor" fillOpacity="0.12" />
      <rect x="40" y="34" width="44" height="4" rx="2" fill="currentColor" fillOpacity="0.2" />
      <rect x="40" y="42" width="34" height="4" rx="2" fill="currentColor" fillOpacity="0.15" />
      <line x1="40" y1="52" x2="84" y2="52" stroke="currentColor" strokeOpacity="0.18" strokeDasharray="2 2" strokeWidth="1.5" />
      {/* Floating verified token */}
      <g transform="translate(74, 46)">
        <circle cx="14" cy="14" r="14" fill="#DBEAFE" />
        <path d="M10 14L13 17L19 11" stroke="#1E3A8A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/**
 * Mellow vector illustration for Payments section.
 * Digital payment transaction stream with INR coin, settlement check, and security lock.
 */
export function PaymentsHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      {/* Terminal base plate */}
      <rect x="22" y="18" width="76" height="52" rx="14" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <rect x="32" y="28" width="28" height="6" rx="3" fill="currentColor" fillOpacity="0.18" />
      <rect x="32" y="38" width="42" height="5" rx="2.5" fill="currentColor" fillOpacity="0.12" />
      <rect x="32" y="48" width="20" height="12" rx="4" fill="#E8F8DE" stroke="#9FE870" strokeWidth="1.2" />
      {/* Floating INR coin */}
      <g transform="translate(68, 22)">
        <circle cx="18" cy="18" r="18" fill="#9FE870" />
        <path d="M13 13H23M13 17H21M17 13V23M17 17C20 17 21 20 21 23" stroke="#163300" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/**
 * Mellow vector illustration for Customers section.
 * Multi-account profile cards with organization network nodes.
 */
export function CustomersHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      {/* Background card */}
      <rect x="20" y="20" width="46" height="48" rx="12" fill="#FFFFFF" fillOpacity="0.75" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
      <circle cx="34" cy="34" r="7" fill="currentColor" fillOpacity="0.2" />
      <rect x="26" y="46" width="30" height="4" rx="2" fill="currentColor" fillOpacity="0.15" />
      {/* Primary prominent customer profile card */}
      <rect x="46" y="14" width="56" height="58" rx="14" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx="74" cy="30" r="10" fill="#9FE870" />
      <path d="M68 30C68 26.6863 70.6863 24 74 24C77.3137 24 80 26.6863 80 30" stroke="#163300" strokeWidth="2" strokeLinecap="round" />
      <rect x="58" y="46" width="32" height="5" rx="2.5" fill="#163300" />
      <rect x="62" y="55" width="24" height="4" rx="2" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

/**
 * Mellow vector illustration for Plans catalog section.
 * Tier hierarchy cards with cadence rhythm indicator.
 */
export function PlansHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      <rect x="18" y="24" width="36" height="48" rx="10" fill="#FFFFFF" fillOpacity="0.7" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
      <rect x="66" y="24" width="36" height="48" rx="10" fill="#FFFFFF" fillOpacity="0.7" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
      {/* Featured center plan card */}
      <rect x="36" y="14" width="48" height="62" rx="12" fill="#FFFFFF" fillOpacity="0.95" stroke="#9FE870" strokeWidth="2" />
      <rect x="44" y="22" width="32" height="6" rx="3" fill="#9FE870" />
      <rect x="46" y="34" width="28" height="4" rx="2" fill="currentColor" fillOpacity="0.25" />
      <circle cx="50" cy="46" r="2.5" fill="#163300" />
      <rect x="56" y="44.5" width="18" height="3" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      <circle cx="50" cy="54" r="2.5" fill="#163300" />
      <rect x="56" y="52.5" width="18" height="3" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      <rect x="44" y="62" width="32" height="6" rx="3" fill="#163300" />
    </svg>
  );
}

/**
 * Mellow vector illustration for Products catalog section.
 * Software bundle boxes and modular variant tag chips.
 */
export function ProductsHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      {/* Box back */}
      <rect x="28" y="20" width="42" height="44" rx="10" fill="#FFFFFF" fillOpacity="0.8" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      {/* Box front */}
      <rect x="44" y="16" width="52" height="54" rx="12" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <rect x="54" y="26" width="32" height="6" rx="3" fill="#FEF08A" />
      <rect x="54" y="38" width="24" height="4" rx="2" fill="currentColor" fillOpacity="0.2" />
      <rect x="54" y="46" width="30" height="4" rx="2" fill="currentColor" fillOpacity="0.15" />
      {/* Floating brand variant tag */}
      <g transform="translate(20, 42)">
        <rect width="36" height="20" rx="8" fill="#163300" />
        <text x="18" y="14" fill="#9FE870" fontSize="10" fontWeight="bold" textAnchor="middle">Odoo</text>
      </g>
    </svg>
  );
}

/**
 * Mellow vector illustration for Templates catalog section.
 * Pre-configured quotation blueprint sheet ready for instant 1-click instantiation.
 */
export function TemplatesHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      <rect x="22" y="14" width="54" height="60" rx="10" fill="#FFFFFF" fillOpacity="0.7" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" transform="rotate(-6 22 14)" />
      {/* Blueprint front sheet */}
      <rect x="36" y="12" width="60" height="64" rx="12" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <rect x="46" y="22" width="28" height="6" rx="3" fill="#DBEAFE" />
      <rect x="46" y="34" width="40" height="4" rx="2" fill="currentColor" fillOpacity="0.2" />
      <rect x="46" y="42" width="32" height="4" rx="2" fill="currentColor" fillOpacity="0.15" />
      <rect x="46" y="50" width="36" height="4" rx="2" fill="currentColor" fillOpacity="0.15" />
      {/* Instant instantiate spark arrow */}
      <g transform="translate(76, 44)">
        <circle cx="16" cy="16" r="16" fill="#163300" />
        <path d="M12 16H20M20 16L16 12M20 16L16 20" stroke="#9FE870" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/**
 * Mellow vector illustration for Taxes section.
 * Fiscal GST rule badge and rate breakdown.
 */
export function TaxesHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      <rect x="26" y="16" width="68" height="56" rx="14" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <rect x="36" y="26" width="24" height="6" rx="3" fill="#FEF08A" />
      <rect x="36" y="38" width="48" height="4" rx="2" fill="currentColor" fillOpacity="0.2" />
      <rect x="36" y="46" width="36" height="4" rx="2" fill="currentColor" fillOpacity="0.15" />
      {/* 18% GST seal */}
      <g transform="translate(68, 38)">
        <circle cx="15" cy="15" r="15" fill="#163300" />
        <text x="15" y="19" fill="#9FE870" fontSize="10" fontWeight="bold" textAnchor="middle">18%</text>
      </g>
    </svg>
  );
}

/**
 * Mellow vector illustration for Discounts section.
 * Promotional discount tag and voucher ribbon.
 */
export function DiscountsHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      <rect x="24" y="20" width="72" height="48" rx="14" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      {/* Coupon perforated notch */}
      <circle cx="24" cy="44" r="6" fill="var(--bg-surface)" />
      <circle cx="96" cy="44" r="6" fill="var(--bg-surface)" />
      <line x1="34" y1="44" x2="86" y2="44" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" strokeWidth="1.5" />
      <rect x="36" y="28" width="28" height="6" rx="3" fill="#F3E8FF" />
      <text x="60" y="58" fill="#581C87" fontSize="11" fontWeight="bold" textAnchor="middle">SAVE20</text>
    </svg>
  );
}

/**
 * Mellow vector illustration for Insights section.
 * MRR revenue trajectory line and retention indicator.
 */
export function InsightsHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      <rect x="22" y="16" width="76" height="56" rx="14" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      {/* Smooth upward curve */}
      <path
        d="M32 56C42 56 46 48 54 44C62 40 68 32 78 26"
        stroke="#9FE870"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="78" cy="26" r="4.5" fill="#163300" stroke="#9FE870" strokeWidth="2" />
      <rect x="32" y="24" width="24" height="6" rx="3" fill="#E8F8DE" />
      <text x="44" y="29" fill="#163300" fontSize="8" fontWeight="bold" textAnchor="middle">MRR</text>
    </svg>
  );
}

/**
 * Mellow vector illustration for Team section.
 * Staff permission keycards and collaborative team badge.
 */
export function TeamHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      {/* Two team member circles */}
      <circle cx="44" cy="38" r="14" fill="#FEF08A" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="44" cy="36" r="6" fill="#713F12" />
      <circle cx="72" cy="38" r="16" fill="#9FE870" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="72" cy="36" r="7" fill="#163300" />
      {/* Role badge */}
      <rect x="36" y="58" width="48" height="14" rx="7" fill="#163300" />
      <text x="60" y="68" fill="#9FE870" fontSize="9" fontWeight="bold" textAnchor="middle">Admin &amp; Staff</text>
    </svg>
  );
}

/**
 * Mellow vector illustration for Settings section.
 * Organization branding dial and tax registration seal.
 */
export function SettingsHeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="120"
      height="88"
      viewBox="0 0 120 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="44" r="38" fill="currentColor" fillOpacity="0.06" />
      <rect x="24" y="16" width="72" height="56" rx="14" fill="#FFFFFF" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx="44" cy="36" r="10" fill="#9FE870" />
      <path d="M44 32V40M40 36H48" stroke="#163300" strokeWidth="2" strokeLinecap="round" />
      <rect x="60" y="30" width="26" height="5" rx="2.5" fill="currentColor" fillOpacity="0.25" />
      <rect x="60" y="38" width="18" height="4" rx="2" fill="currentColor" fillOpacity="0.15" />
      <rect x="36" y="52" width="48" height="6" rx="3" fill="currentColor" fillOpacity="0.12" />
    </svg>
  );
}

/**
 * Mellow vector illustration for Auth & Welcome screens.
 * Clean security shield and keyless token for trusted subscription portal.
 */
export function AuthWelcomeArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="18" fill="#E8F8DE" />
      <circle cx="32" cy="32" r="20" fill="#9FE870" />
      <path
        d="M26 31C26 27.6863 28.6863 25 32 25C35.3137 25 38 27.6863 38 31V33H26V31Z"
        stroke="#163300"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="23" y="33" width="18" height="13" rx="4" fill="#163300" />
      <circle cx="32" cy="39" r="1.8" fill="#9FE870" />
    </svg>
  );
}

/**
 * Mellow vector illustration for Password Reset screens.
 */
export function PasswordResetArt({ className = '' }: { className?: string }) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="18" fill="#FEF08A" />
      <circle cx="32" cy="32" r="20" fill="#FFFFFF" fillOpacity="0.9" />
      <path
        d="M26 32A6 6 0 1 1 38 32C38 35.3137 35.3137 38 32 38"
        stroke="#713F12"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M26 28V32H30" stroke="#713F12" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

