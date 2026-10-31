'use client';

import React, { useState, useEffect } from 'react';
import {
  Home,
  Repeat,
  FileText,
  User,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useMe, useMeta } from '@/lib/meta';
import { Link, usePathname, useRouter } from '@/lib/router';
import { useTheme, ThemePreference } from '@/lib/theme';
import { useOrgSettings } from '@/lib/orgSettings';
import { useToast } from '@/components/ui/Toast';
import { BrandLoopLogo } from '@/components/ui/MellowArt';

const PORTAL_NAV_ITEMS: Array<{ href: string; label: string; icon: React.ReactNode }> = [
  { href: '/portal/home', label: 'Home', icon: <Home className="w-5 h-5 shrink-0" /> },
  {
    href: '/portal/subscriptions',
    label: 'My subscriptions',
    icon: <Repeat className="w-5 h-5 shrink-0" />,
  },
  {
    href: '/portal/invoices',
    label: 'My invoices',
    icon: <FileText className="w-5 h-5 shrink-0" />,
  },
  { href: '/portal/profile', label: 'Profile', icon: <User className="w-5 h-5 shrink-0" /> },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const { reloadMeta, loading } = useMeta();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const { settings: orgSettings } = useOrgSettings();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !me) {
      router.replace('/login');
    }
  }, [loading, me, router]);

  const cycleTheme = () => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    showToast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`, 'info');
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network error on logout
    }
    await reloadMeta();
    showToast('Signed out', 'info');
    router.push('/login');
  };

  const initials = (me?.name || 'Customer')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const renderSidebar = (collapsed = false, showToggle = false) => (
    <div className="flex flex-col h-full">
      <div
        className={`pt-[28px] pb-[20px] flex items-center ${
          collapsed ? 'px-3 justify-center' : 'px-[24px] justify-between'
        }`}
      >
        <Link href="/portal/home" className="flex items-center gap-2.5 text-[var(--text-primary)] min-w-0">
          {orgSettings.logoDataUrl ? (
            <img
              src={orgSettings.logoDataUrl}
              alt={`${orgSettings.companyName || 'Company'} logo`}
              className="w-9 h-9 rounded-[10px] object-contain bg-[var(--bg-surface)] p-1 shrink-0"
            />
          ) : (
            <BrandLoopLogo size={36} />
          )}
          {!collapsed && (
            <span className="text-[18px] font-bold tracking-[-0.02em] truncate">
              {orgSettings.companyName || 'Brightloop'}
            </span>
          )}
        </Link>
        {showToggle && !collapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Collapse sidebar"
            className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {showToggle && collapsed && (
        <div className="px-3 pb-3 flex justify-center">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      <nav className="flex-1 px-3 space-y-1" aria-label="Customer portal navigation">
        {PORTAL_NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`h-[44px] px-[18px] rounded-full flex items-center gap-[12px] text-[14px] transition-colors ${
                active
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              {item.icon}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-[var(--border-faint)]">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full h-[40px] px-4 rounded-full flex items-center gap-2.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );

  if (loading || !me) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex">
      {/* Desktop collapsible sidebar */}
      <aside
        className={`hidden lg:block ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[240px]'
        } shrink-0 sticky top-0 h-screen border-r border-[var(--border-faint)] bg-[var(--bg-card)] transition-all duration-200 no-print`}
      >
        {renderSidebar(sidebarCollapsed, true)}
      </aside>

      {/* Tablet icon sidebar */}
      <aside className="hidden md:block lg:hidden w-[76px] shrink-0 sticky top-0 h-screen border-r border-[var(--border-faint)] bg-[var(--bg-card)] no-print">
        {renderSidebar(true, false)}
      </aside>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[99990] md:hidden flex no-print" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[var(--bg-scrim)] backdrop-blur-[4px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-[260px] max-w-[85vw] bg-[var(--bg-card)] h-full shadow-[var(--shadow-floating)] flex flex-col">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close portal menu"
              className="absolute top-6 right-4 w-9 h-9 rounded-full inline-flex items-center justify-center text-[var(--text-secondary)]"
            >
              <X className="w-5 h-5" />
            </button>
            {renderSidebar(false)}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[68px] bg-[var(--bg-card)] border-b border-[var(--border-faint)] px-6 sm:px-[48px] flex items-center justify-between gap-6 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open portal menu"
              className="md:hidden w-10 h-10 rounded-full inline-flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-[14px] font-semibold text-[var(--text-secondary)]">
              Customer Portal
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={cycleTheme}
              suppressHydrationWarning
              aria-label={mounted ? `Switch theme (current: ${theme})` : 'Switch theme'}
              title={mounted ? `Theme: ${theme} (click to switch)` : 'Switch theme'}
              className="w-9 h-9 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE870]"
            >
              {!mounted || theme === 'system' ? (
                <Monitor className="w-4 h-4" aria-hidden="true" />
              ) : theme === 'light' ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <Link
              href="/portal/profile"
              className="inline-flex items-center gap-2.5 p-1 pr-3 rounded-full hover:bg-[var(--bg-surface)] transition-colors"
            >
              <span className="w-[36px] h-[36px] rounded-full bg-[var(--hero-blue)] text-[var(--hero-blue-fg)] font-bold text-[13px] inline-flex items-center justify-center">
                {initials}
              </span>
              <span className="text-[14px] font-semibold text-[var(--text-primary)] hidden sm:inline">
                {me?.name || 'My Account'}
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 sm:px-[48px] pt-[40px] pb-[120px] space-y-[40px]">
          {children}
        </main>
      </div>
    </div>
  );
}
