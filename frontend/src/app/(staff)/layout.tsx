'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Repeat,
  FileText,
  CreditCard,
  Users,
  Package,
  BarChart3,
  ShieldCheck,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  ExternalLink,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useCan, useMe, useMeta } from '@/lib/meta';
import { Link, usePathname, useRouter } from '@/lib/router';
import { useTheme, ThemePreference } from '@/lib/theme';
import { useOrgSettings } from '@/lib/orgSettings';
import { Drawer, DrawerSection } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { useToast } from '@/components/ui/Toast';
import { BrandLoopLogo } from '@/components/ui/MellowArt';

interface NavLinkItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const CATALOG_LINKS: Array<{ href: string; label: string }> = [
  { href: '/catalog/products', label: 'Products' },
  { href: '/catalog/plans', label: 'Plans' },
  { href: '/catalog/templates', label: 'Templates' },
  { href: '/catalog/taxes', label: 'Taxes' },
  { href: '/catalog/discounts', label: 'Discounts' },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const { reloadMeta } = useMeta();
  const canWriteStaff = useCan('staff.write');
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const { settings: orgSettings } = useOrgSettings();

  const [catalogOpen, setCatalogOpen] = useState(() => pathname.startsWith('/catalog'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('brightloop:sidebar-collapsed') === 'true';
  });

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('brightloop:sidebar-collapsed', String(next));
        window.dispatchEvent(new CustomEvent('brightloop:sidebar-changed'));
      }
      return next;
    });
  }, []);

  const cycleTheme = () => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    showToast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`, 'info');
  };

  useEffect(() => {
    const syncSidebarState = () => {
      setSidebarCollapsed(window.localStorage.getItem('brightloop:sidebar-collapsed') === 'true');
    };
    const handleOpenPaletteEvent = () => {
      setCommandPaletteOpen(true);
    };
    window.addEventListener('brightloop:sidebar-changed', syncSidebarState);
    window.addEventListener('brightloop:open-command-palette', handleOpenPaletteEvent);
    return () => {
      window.removeEventListener('brightloop:sidebar-changed', syncSidebarState);
      window.removeEventListener('brightloop:open-command-palette', handleOpenPaletteEvent);
    };
  }, []);

  // Global keyboard shortcuts (Ctrl+K / Cmd+K, Alt+B, Alt+H/S/I/P/C/,)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        Boolean(target?.isContentEditable);

      if (isEditable) return;

      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === 'b') {
          e.preventDefault();
          toggleSidebarCollapse();
        } else if (key === 'h') {
          e.preventDefault();
          router.push('/home');
        } else if (key === 's') {
          e.preventDefault();
          router.push('/subscriptions');
        } else if (key === 'i') {
          e.preventDefault();
          router.push('/invoices');
        } else if (key === 'p') {
          e.preventDefault();
          router.push('/payments');
        } else if (key === 'c') {
          e.preventDefault();
          router.push('/customers');
        } else if (key === ',') {
          e.preventDefault();
          router.push('/settings');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [router, toggleSidebarCollapse]);

  useEffect(() => {
    if (pathname.startsWith('/catalog')) {
      setCatalogOpen(true);
    }
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (me && me.role === 'customer') {
      router.replace('/portal/home');
    }
  }, [me, router]);

  const primaryLinks: NavLinkItem[] = [
    { href: '/home', label: 'Home', icon: <Home className="w-5 h-5 shrink-0" /> },
    { href: '/subscriptions', label: 'Subscriptions', icon: <Repeat className="w-5 h-5 shrink-0" /> },
    { href: '/invoices', label: 'Invoices', icon: <FileText className="w-5 h-5 shrink-0" /> },
    { href: '/payments', label: 'Payments', icon: <CreditCard className="w-5 h-5 shrink-0" /> },
    { href: '/customers', label: 'Customers', icon: <Users className="w-5 h-5 shrink-0" /> },
  ];

  const bottomLinks: NavLinkItem[] = [
    { href: '/insights', label: 'Insights', icon: <BarChart3 className="w-5 h-5 shrink-0" /> },
    ...(canWriteStaff
      ? [{ href: '/team', label: 'Team', icon: <ShieldCheck className="w-5 h-5 shrink-0" /> }]
      : []),
    { href: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5 shrink-0" /> },
  ];

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout network error and route to login
    }
    await reloadMeta();
    showToast('Signed out', 'info');
    router.push('/login');
  };

  const breadcrumbText = (() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Home';
    return parts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' '))
      .join(' / ');
  })();

  const userInitials = (() => {
    const fullName = me?.name || 'Staff';
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  })();

  const renderNavContent = (collapsed = false, showCollapseToggle = false) => (
    <div className="flex flex-col h-full">
      <div
        className={`pt-[28px] pb-[20px] flex items-center ${
          collapsed ? 'px-3 justify-center' : 'px-[24px] justify-between'
        }`}
      >
        <Link
          href="/home"
          className="flex items-center gap-2.5 text-[var(--text-primary)] focus-visible:outline-none min-w-0"
        >
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

        {showCollapseToggle && !collapsed && (
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar (Alt+B)"
            className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {showCollapseToggle && collapsed && (
        <div className="px-3 pb-3 flex justify-center">
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar (Alt+B)"
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto" aria-label="Staff navigation">
        {primaryLinks.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
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

        {/* Catalog Accordion */}
        <div>
          <button
            type="button"
            onClick={() => {
              if (collapsed) {
                router.push('/catalog/products');
              } else {
                setCatalogOpen((v) => !v);
              }
            }}
            title={collapsed ? 'Catalog' : undefined}
            aria-expanded={catalogOpen}
            className={`w-full h-[44px] px-[18px] rounded-full flex items-center justify-between gap-[12px] text-[14px] cursor-pointer transition-colors ${
              pathname.startsWith('/catalog')
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
            } ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <span className="flex items-center gap-[12px] min-w-0">
              <Package className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">Catalog</span>}
            </span>
            {!collapsed &&
              (catalogOpen ? (
                <ChevronDown className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0" />
              ))}
          </button>

          {!collapsed && catalogOpen && (
            <div className="mt-1 space-y-0.5">
              {CATALOG_LINKS.map((sub) => {
                const subActive = pathname === sub.href;
                return (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    className={`h-[38px] pl-[44px] pr-4 rounded-full flex items-center text-[13px] transition-colors ${
                      subActive
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold'
                        : 'text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {sub.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {bottomLinks.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
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
          <Link
            href="/portal/home"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span>Customer Portal View</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );

  if (me && me.role === 'customer') {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex">
      {/* Desktop collapsible sidebar (>=1024px) */}
      <aside
        className={`hidden lg:block ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[240px]'
        } shrink-0 sticky top-0 h-screen border-r border-[var(--border-faint)] bg-[var(--bg-card)] transition-all duration-200 no-print`}
      >
        {renderNavContent(sidebarCollapsed, true)}
      </aside>

      {/* Tablet icon-only sidebar (768px - 1023px) */}
      <aside className="hidden md:block lg:hidden w-[76px] shrink-0 sticky top-0 h-screen border-r border-[var(--border-faint)] bg-[var(--bg-card)] no-print">
        {renderNavContent(true, false)}
      </aside>

      {/* Mobile slide-over menu (<768px) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[99990] md:hidden flex no-print" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[var(--bg-scrim)] backdrop-blur-[4px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-[260px] max-w-[85vw] bg-[var(--bg-card)] h-full shadow-[var(--shadow-floating)] flex flex-col">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-6 right-4 w-9 h-9 rounded-full inline-flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
            >
              <X className="w-5 h-5" />
            </button>
            {renderNavContent(false, false)}
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[68px] bg-[var(--bg-card)] border-b border-[var(--border-faint)] px-6 sm:px-[48px] flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden w-10 h-10 rounded-full inline-flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-[14px] font-semibold text-[var(--text-secondary)] truncate">
              {breadcrumbText}
            </div>
          </div>

          <div className="relative flex items-center gap-2.5 shrink-0">
            <CommandPalette
              open={commandPaletteOpen}
              onOpen={() => setCommandPaletteOpen(true)}
              onClose={() => setCommandPaletteOpen(false)}
              canWriteStaff={canWriteStaff}
              onToggleSidebar={toggleSidebarCollapse}
            />

            <button
              type="button"
              onClick={cycleTheme}
              suppressHydrationWarning
              aria-label={`Switch theme (current: ${theme})`}
              title={`Theme: ${theme} (click to switch)`}
              className="w-9 h-9 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE870]"
            >
              {theme === 'light' ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : theme === 'dark' ? (
                <Moon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Monitor className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label="Notifications"
              className="w-9 h-9 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE870]"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-expanded={userMenuOpen}
              aria-label="Account menu"
              className="inline-flex items-center gap-2.5 p-1 pr-3 rounded-full hover:bg-[var(--bg-surface)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE870]"
            >
              <span className="w-[36px] h-[36px] rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)] font-bold text-[13px] inline-flex items-center justify-center">
                {userInitials}
              </span>
              <span className="text-[14px] font-semibold text-[var(--text-primary)] hidden xl:inline">
                {me?.name || 'Staff Account'}
              </span>
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-[52px] w-56 bg-[var(--bg-card)] rounded-[16px] shadow-[var(--shadow-floating)] border border-[var(--border-faint)] py-2 z-50">
                <div className="px-4 py-2 border-b border-[var(--border-faint)]">
                  <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    {me?.name || 'Not signed in'}
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] truncate">
                    {me?.email || 'Authenticate via /login'}
                  </div>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </Link>
                <Link
                  href="/login"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] flex items-center gap-2"
                >
                  <span>Switch account / Log in</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    void handleLogout();
                  }}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-[var(--danger-fg)] hover:bg-[var(--danger-bg)] flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 sm:px-[48px] pt-[40px] pb-[120px] space-y-[40px]">
          {children}
        </main>

        <Drawer
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          title="Notifications"
        >
          <DrawerSection>
            <EmptyState message="No new billing or payment alerts from the server." />
          </DrawerSection>
        </Drawer>
      </div>
    </div>
  );
}
