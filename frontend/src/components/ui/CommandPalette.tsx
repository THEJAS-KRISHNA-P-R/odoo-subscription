'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Home,
  Repeat,
  FileText,
  CreditCard,
  Users,
  Package,
  BarChart3,
  ShieldCheck,
  Settings,
  ExternalLink,
  CornerDownLeft,
  X,
} from 'lucide-react';
import { useRouter } from '@/lib/router';

export interface CommandItem {
  href: string;
  label: string;
  category: string;
  shortcut?: string;
  icon: React.ReactNode;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpen?: () => void;
  canWriteStaff?: boolean;
  onToggleSidebar?: () => void;
}

/**
 * Inline wide header search bar with an extending dropdown list (Ctrl+K).
 * Does not open a modal overlay; extends directly beneath the search input.
 */
export function CommandPalette({
  open,
  onClose,
  onOpen,
  canWriteStaff = false,
  onToggleSidebar,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = useMemo(() => {
    const base: CommandItem[] = [
      {
        href: '/home',
        label: 'Home / Overview',
        category: 'Workspace',
        shortcut: 'Alt+H',
        icon: <Home className="w-4 h-4" />,
      },
      {
        href: '/subscriptions',
        label: 'Subscriptions',
        category: 'Workspace',
        shortcut: 'Alt+S',
        icon: <Repeat className="w-4 h-4" />,
      },
      {
        href: '/invoices',
        label: 'Invoices',
        category: 'Workspace',
        shortcut: 'Alt+I',
        icon: <FileText className="w-4 h-4" />,
      },
      {
        href: '/payments',
        label: 'Payments',
        category: 'Workspace',
        shortcut: 'Alt+P',
        icon: <CreditCard className="w-4 h-4" />,
      },
      {
        href: '/customers',
        label: 'Customers',
        category: 'Workspace',
        shortcut: 'Alt+C',
        icon: <Users className="w-4 h-4" />,
      },
      {
        href: '/catalog/products',
        label: 'Catalog: Products',
        category: 'Catalog',
        icon: <Package className="w-4 h-4" />,
      },
      {
        href: '/catalog/plans',
        label: 'Catalog: Plans',
        category: 'Catalog',
        icon: <Package className="w-4 h-4" />,
      },
      {
        href: '/catalog/templates',
        label: 'Catalog: Templates',
        category: 'Catalog',
        icon: <Package className="w-4 h-4" />,
      },
      {
        href: '/catalog/taxes',
        label: 'Catalog: Taxes & Payment Terms',
        category: 'Catalog',
        icon: <Package className="w-4 h-4" />,
      },
      {
        href: '/catalog/discounts',
        label: 'Catalog: Discounts',
        category: 'Catalog',
        icon: <Package className="w-4 h-4" />,
      },
      {
        href: '/insights',
        label: 'Insights & Reports',
        category: 'Analytics',
        icon: <BarChart3 className="w-4 h-4" />,
      },
      ...(canWriteStaff
        ? [
            {
              href: '/team',
              label: 'Team Management',
              category: 'Administration',
              icon: <ShieldCheck className="w-4 h-4" />,
            },
          ]
        : []),
      {
        href: '/settings',
        label: 'Settings & Shortcuts',
        category: 'Preferences',
        shortcut: 'Alt+,',
        icon: <Settings className="w-4 h-4" />,
      },
      {
        href: '/portal/home',
        label: 'Customer Portal View',
        category: 'Portal',
        icon: <ExternalLink className="w-4 h-4" />,
      },
    ];
    if (onToggleSidebar) {
      base.push({
        href: '__toggle_sidebar__',
        label: 'Toggle Sidebar Collapse',
        category: 'Preferences',
        shortcut: 'Alt+B',
        icon: <Settings className="w-4 h-4" />,
      });
    }
    return base;
  }, [canWriteStaff, onToggleSidebar]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.href.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Close dropdown when clicking outside the search bar + dropdown container
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open, onClose]);

  const executeCommand = (item: CommandItem) => {
    setQuery('');
    onClose();
    inputRef.current?.blur();
    if (item.href === '__toggle_sidebar__' && onToggleSidebar) {
      onToggleSidebar();
      return;
    }
    router.push(item.href);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      onClose();
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && onOpen) onOpen();
      setActiveIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open && onOpen) onOpen();
      setActiveIndex((prev) =>
        filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
      );
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      executeCommand(filtered[activeIndex]);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-[200px] sm:w-[320px] md:w-[420px] lg:w-[480px] transition-all"
    >
      <div
        className={`h-[40px] px-3.5 rounded-full bg-[var(--bg-surface)] flex items-center gap-2.5 border transition-all ${
          open
            ? 'border-[var(--border-focus)] bg-[var(--bg-card)] ring-2 ring-[#9FE870]'
            : 'border-transparent hover:bg-[var(--bg-surface-hover)]'
        }`}
      >
        <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="header-search-dropdown"
          aria-autocomplete="list"
          aria-label="Quick search and navigation (Ctrl+K)"
          placeholder="Jump to page or run command…"
          value={query}
          onFocus={() => {
            if (onOpen) onOpen();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open && onOpen) onOpen();
          }}
          onKeyDown={handleInputKeyDown}
          className="w-full text-[13px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-transparent focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search query"
            className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
        <kbd className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-card)] border border-[var(--border-hair)] text-[11px] font-semibold text-[var(--text-muted)] shrink-0 tabular-nums">
          Ctrl+K
        </kbd>
      </div>

      {open && (
        <div
          id="header-search-dropdown"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 bg-[var(--bg-card)] border border-[var(--border-faint)] rounded-[20px] shadow-[var(--shadow-floating)] overflow-hidden animate-scale-in"
        >
          <div className="max-h-[340px] overflow-y-auto p-2 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="py-8 px-4 text-center text-[13px] text-[var(--text-muted)]">
                No matching destinations for &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={item.href}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => executeCommand(item)}
                    className={`w-full px-3.5 py-2.5 rounded-[12px] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--brand-tint)] text-[var(--brand-dark)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-[8px] inline-flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate">{item.label}</div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.04em]">
                          {item.category}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.shortcut && (
                        <kbd className="px-1.5 py-0.5 rounded-[5px] bg-[var(--bg-card)] border border-[var(--border-hair)] text-[10px] font-semibold text-[var(--text-secondary)] tabular-nums">
                          {item.shortcut}
                        </kbd>
                      )}
                      {isSelected && (
                        <CornerDownLeft
                          className="w-3.5 h-3.5 text-[var(--brand-dark)]"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 bg-[var(--bg-muted)] border-t border-[var(--border-faint)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>↑↓ to navigate · Enter to go</span>
            <span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
