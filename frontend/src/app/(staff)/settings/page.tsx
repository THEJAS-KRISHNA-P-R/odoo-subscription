'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Upload,
  Trash2,
  FileText,
  Repeat,
  Users,
  PanelLeft,
  Server,
  Shield,
  Sun,
  Moon,
  Monitor,
  Check,
  RotateCcw,
} from 'lucide-react';
import { api, API_BASE_URL } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useTheme, ThemePreference } from '@/lib/theme';
import { useOrgSettings, ProrationPolicy } from '@/lib/orgSettings';
import { MeProfile } from '@/lib/types';
import { Field, SelectField, TextareaField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const { showToast } = useToast();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { settings, updateSettings, resetSettings } = useOrgSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const meReq = useApi<MeProfile>('/auth/me');
  const healthReq = useApi<Record<string, unknown>>('/healthz');

  // Local editable form state synced with OrgSettingsProvider
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail);
  const [gstin, setGstin] = useState(settings.gstin);
  const [billingAddress, setBillingAddress] = useState(settings.billingAddress);
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix);
  const [quotePrefix, setQuotePrefix] = useState(settings.quotePrefix);
  const [defaultPaymentTermDays, setDefaultPaymentTermDays] = useState(
    settings.defaultPaymentTermDays
  );
  const [defaultQuoteValidityDays, setDefaultQuoteValidityDays] = useState(
    settings.defaultQuoteValidityDays
  );
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(settings.invoiceFooterNote);
  const [autoEmailInvoices, setAutoEmailInvoices] = useState(settings.autoEmailInvoices);
  const [autoConfirmBillingRun, setAutoConfirmBillingRun] = useState(
    settings.autoConfirmBillingRun
  );
  const [dunningFirstReminderDays, setDunningFirstReminderDays] = useState(
    settings.dunningFirstReminderDays
  );
  const [dunningSecondReminderDays, setDunningSecondReminderDays] = useState(
    settings.dunningSecondReminderDays
  );
  const [dunningAutoPauseDays, setDunningAutoPauseDays] = useState(
    settings.dunningAutoPauseDays
  );
  const [prorationPolicy, setProrationPolicy] = useState<ProrationPolicy>(
    settings.prorationPolicy
  );
  const [portalAllowPause, setPortalAllowPause] = useState(settings.portalAllowPause);
  const [portalAllowClose, setPortalAllowClose] = useState(settings.portalAllowClose);
  const [portalAllowPdfDownload, setPortalAllowPdfDownload] = useState(
    settings.portalAllowPdfDownload
  );
  const [portalRequireCancelReason, setPortalRequireCancelReason] = useState(
    settings.portalRequireCancelReason
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('brightloop:sidebar-collapsed') === 'true';
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    const syncCollapse = () => {
      setSidebarCollapsed(window.localStorage.getItem('brightloop:sidebar-collapsed') === 'true');
    };
    window.addEventListener('brightloop:sidebar-changed', syncCollapse);
    return () => window.removeEventListener('brightloop:sidebar-changed', syncCollapse);
  }, []);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid PNG, JPG, SVG, or WebP image file', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo image must be under 2 MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateSettings({ logoDataUrl: reader.result });
        showToast('Company logo updated across workspace and PDF invoices', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    updateSettings({ logoDataUrl: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast('Company logo removed', 'info');
  };

  const handleSaveAllSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const nextPayload = {
      companyName: companyName.trim() || 'Brightloop',
      supportEmail: supportEmail.trim(),
      gstin: gstin.trim().toUpperCase(),
      billingAddress: billingAddress.trim(),
      invoicePrefix: invoicePrefix.trim() || 'INV-',
      quotePrefix: quotePrefix.trim() || 'QT-',
      defaultPaymentTermDays: defaultPaymentTermDays || '15',
      defaultQuoteValidityDays: defaultQuoteValidityDays || '30',
      invoiceFooterNote: invoiceFooterNote.trim(),
      autoEmailInvoices,
      autoConfirmBillingRun,
      dunningFirstReminderDays: dunningFirstReminderDays || '3',
      dunningSecondReminderDays: dunningSecondReminderDays || '7',
      dunningAutoPauseDays: dunningAutoPauseDays || '21',
      prorationPolicy,
      portalAllowPause,
      portalAllowClose,
      portalAllowPdfDownload,
      portalRequireCancelReason,
    };

    updateSettings(nextPayload);
    try {
      await api.patch('/settings', nextPayload);
    } catch {
      // Persist locally even when backend /settings is offline in preview
    } finally {
      setSavingSettings(false);
    }
    showToast('Subscription & invoicing settings saved', 'success');
  };

  const handleResetDefaults = () => {
    resetSettings();
    setCompanyName('Brightloop');
    setSupportEmail('');
    setGstin('');
    setBillingAddress('');
    setInvoicePrefix('INV-');
    setQuotePrefix('QT-');
    setDefaultPaymentTermDays('15');
    setDefaultQuoteValidityDays('30');
    setInvoiceFooterNote('');
    setAutoEmailInvoices(true);
    setAutoConfirmBillingRun(false);
    setDunningFirstReminderDays('3');
    setDunningSecondReminderDays('7');
    setDunningAutoPauseDays('21');
    setProrationPolicy('prorate_immediately');
    setPortalAllowPause(true);
    setPortalAllowClose(true);
    setPortalAllowPdfDownload(true);
    setPortalRequireCancelReason(true);
    showToast('Organization settings restored to defaults', 'info');
  };

  const handleToggleSidebarPref = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    window.localStorage.setItem('brightloop:sidebar-collapsed', String(next));
    window.dispatchEvent(new CustomEvent('brightloop:sidebar-changed'));
    showToast(next ? 'Sidebar collapsed to compact icon mode' : 'Sidebar expanded', 'info');
  };

  const handleThemeSelect = (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    showToast(`Appearance set to ${nextTheme}`, 'info');
  };

  const handlePasswordReset = async () => {
    if (!meReq.data?.email) return;
    setSendingReset(true);
    try {
      await api.post('/auth/forgot', { email: meReq.data.email });
      showToast('If the account exists, we sent a password reset link.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Request failed', 'error');
    } finally {
      setSendingReset(false);
    }
  };

  const themeOptions: Array<{
    value: ThemePreference;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      value: 'light',
      label: 'Light',
      description: 'Original Wise daylight palette',
      icon: <Sun className="w-4 h-4" aria-hidden="true" />,
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Forest-carbon dark surfaces matched to Wise lime',
      icon: <Moon className="w-4 h-4" aria-hidden="true" />,
    },
    {
      value: 'system',
      label: 'System',
      description: `Follows OS setting (currently ${resolvedTheme})`,
      icon: <Monitor className="w-4 h-4" aria-hidden="true" />,
    },
  ];

  return (
    <form onSubmit={handleSaveAllSettings} className="space-y-[40px]" noValidate>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Organization & Billing Settings
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Configure company logo, PDF tax invoice branding, recurring billing &amp; dunning rules, and customer portal policies
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Pill type="button" variant="outline" onClick={handleResetDefaults}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Reset defaults</span>
          </Pill>
          <Pill type="submit" variant="primary" loading={savingSettings}>
            <Check className="w-4 h-4" aria-hidden="true" />
            <span>Save settings</span>
          </Pill>
        </div>
      </div>

      {/* 1. Company Branding, Logo Upload & PDF Invoice Identity */}
      <section aria-label="Company branding and logo" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-5 h-5 text-[var(--brand-dark)]" aria-hidden="true" />
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Company branding &amp; tax identity
          </h2>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-[24px] p-7 space-y-6">
          {/* Company Logo Uploader + Live PDF Header Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pb-6 border-b border-[var(--border-hair)]">
            <div className="lg:col-span-7 flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-20 h-20 rounded-[18px] bg-[var(--bg-card)] border border-[var(--border-hair)] flex items-center justify-center overflow-hidden shrink-0">
                {settings.logoDataUrl ? (
                  <img
                    src={settings.logoDataUrl}
                    alt="Uploaded company logo"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] font-bold text-[22px] inline-flex items-center justify-center">
                    {(companyName || 'Brightloop').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Company logo
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] max-w-md">
                  Displayed in the staff sidebar, customer self-service portal, and at the top of every exported PDF tax invoice. Accepts PNG, JPG, SVG, or WebP (max 2 MB).
                </p>
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <input
                    ref={fileInputRef}
                    id="company-logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoFileChange}
                    className="sr-only"
                  />
                  <Pill
                    type="button"
                    variant="soft"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{settings.logoDataUrl ? 'Change logo' : 'Upload logo'}</span>
                  </Pill>
                  {settings.logoDataUrl && (
                    <Pill
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Remove logo</span>
                    </Pill>
                  )}
                </div>
              </div>
            </div>

            {/* Live PDF Invoice Header Preview */}
            <div className="lg:col-span-5 bg-[var(--bg-card)] border border-[var(--border-hair)] rounded-[18px] p-4 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                <span>Live PDF Invoice Header Preview</span>
                <span>A4 Tax Invoice</span>
              </div>
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="flex items-center gap-3 min-w-0">
                  {settings.logoDataUrl ? (
                    <img
                      src={settings.logoDataUrl}
                      alt="Invoice preview logo"
                      className="w-10 h-10 rounded-[10px] object-contain bg-[var(--bg-surface)] p-1 shrink-0"
                    />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] font-bold text-[16px] inline-flex items-center justify-center shrink-0">
                      {(companyName || 'Brightloop').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">
                      {companyName || 'Brightloop'}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                      {gstin ? `GSTIN: ${gstin}` : 'Tax ID / GSTIN not set'}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-bold text-[var(--text-primary)] tabular-nums">
                    {invoicePrefix || 'INV-'}00042
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Due in {defaultPaymentTermDays || '15'} days
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Organization Legal & Contact Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field
              label="Legal business name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Brightloop Software Pvt. Ltd."
              className="bg-[var(--bg-card)]"
            />
            <Field
              label="Billing & support email"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="billing@brightloop.in"
              className="bg-[var(--bg-card)]"
            />
            <Field
              label="Tax Registration / GSTIN"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="29ABCDE1234F1Z5"
              className="bg-[var(--bg-card)]"
            />
          </div>

          <TextareaField
            label="Registered billing address (printed on PDF invoices)"
            rows={2}
            value={billingAddress}
            onChange={(e) => setBillingAddress(e.target.value)}
            placeholder="Street address, tech park, city, state, PIN code"
            className="bg-[var(--bg-card)]"
          />
        </div>
      </section>

      {/* 2. PDF Invoicing & Numbering Rules */}
      <section aria-label="Invoicing and PDF configuration" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-[var(--brand-dark)]" aria-hidden="true" />
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            PDF invoicing &amp; numbering
          </h2>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-[24px] p-7 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Field
              label="Invoice number prefix"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              placeholder="INV-"
              className="bg-[var(--bg-card)]"
            />
            <Field
              label="Quotation prefix"
              value={quotePrefix}
              onChange={(e) => setQuotePrefix(e.target.value)}
              placeholder="QT-"
              className="bg-[var(--bg-card)]"
            />
            <Field
              label="Default payment term (days)"
              type="number"
              min="0"
              value={defaultPaymentTermDays}
              onChange={(e) => setDefaultPaymentTermDays(e.target.value)}
              className="bg-[var(--bg-card)]"
            />
            <Field
              label="Default quote validity (days)"
              type="number"
              min="1"
              value={defaultQuoteValidityDays}
              onChange={(e) => setDefaultQuoteValidityDays(e.target.value)}
              className="bg-[var(--bg-card)]"
            />
          </div>

          <TextareaField
            label="PDF invoice footer & payment remittance instructions"
            rows={2}
            value={invoiceFooterNote}
            onChange={(e) => setInvoiceFooterNote(e.target.value)}
            placeholder="Bank NEFT / RTGS details, UPI ID, or statutory tax declaration printed at the bottom of PDF invoices"
            className="bg-[var(--bg-card)]"
          />

          <label className="flex items-center justify-between gap-4 p-4 rounded-[16px] bg-[var(--bg-card)] border border-[var(--border-faint)] cursor-pointer">
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                Automatically email PDF tax invoice to customer upon confirmation
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                Dispatches the branded PDF statement as soon as an invoice transitions from Draft to Confirmed.
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoEmailInvoices}
              onChange={(e) => setAutoEmailInvoices(e.target.checked)}
              className="w-4 h-4 accent-[#163300] shrink-0"
            />
          </label>
        </div>
      </section>

      {/* 3. Recurring Billing Engine, Proration & Overdue Dunning */}
      <section aria-label="Recurring billing and dunning rules" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Repeat className="w-5 h-5 text-[var(--brand-dark)]" aria-hidden="true" />
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Recurring billing, proration &amp; dunning
          </h2>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-[24px] p-7 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <SelectField
              label="Mid-cycle upgrade proration"
              value={prorationPolicy}
              onChange={(e) => setProrationPolicy(e.target.value as ProrationPolicy)}
              options={[
                { value: 'prorate_immediately', label: 'Prorate difference immediately' },
                { value: 'next_billing_cycle', label: 'Add proration to next invoice' },
                { value: 'none', label: 'Full period charge (no proration)' },
              ]}
              className="bg-[var(--bg-card)]"
            />
            <Field
              label="1st overdue reminder (days late)"
              type="number"
              min="1"
              value={dunningFirstReminderDays}
              onChange={(e) => setDunningFirstReminderDays(e.target.value)}
              className="bg-[var(--bg-card)]"
            />
            <Field
              label="2nd overdue reminder (days late)"
              type="number"
              min="1"
              value={dunningSecondReminderDays}
              onChange={(e) => setDunningSecondReminderDays(e.target.value)}
              className="bg-[var(--bg-card)]"
            />
            <Field
              label="Auto-pause subscription after (days)"
              type="number"
              min="1"
              value={dunningAutoPauseDays}
              onChange={(e) => setDunningAutoPauseDays(e.target.value)}
              className="bg-[var(--bg-card)]"
            />
          </div>

          <label className="flex items-center justify-between gap-4 p-4 rounded-[16px] bg-[var(--bg-card)] border border-[var(--border-faint)] cursor-pointer">
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                Auto-confirm invoices generated during scheduled billing runs
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                When enabled, recurring billing runs immediately confirm generated invoices instead of holding them in Draft review.
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoConfirmBillingRun}
              onChange={(e) => setAutoConfirmBillingRun(e.target.checked)}
              className="w-4 h-4 accent-[#163300] shrink-0"
            />
          </label>
        </div>
      </section>

      {/* 4. Customer Self-Service Portal Permissions */}
      <section aria-label="Customer portal self-service permissions" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-[var(--brand-dark)]" aria-hidden="true" />
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Customer self-service portal policy
          </h2>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-[24px] p-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-start justify-between gap-4 p-4 rounded-[16px] bg-[var(--bg-card)] border border-[var(--border-faint)] cursor-pointer">
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                Allow customers to pause subscriptions
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                Permits customers on pausable plans to temporarily pause billing from the portal.
              </div>
            </div>
            <input
              type="checkbox"
              checked={portalAllowPause}
              onChange={(e) => setPortalAllowPause(e.target.checked)}
              className="w-4 h-4 mt-1 accent-[#163300] shrink-0"
            />
          </label>

          <label className="flex items-start justify-between gap-4 p-4 rounded-[16px] bg-[var(--bg-card)] border border-[var(--border-faint)] cursor-pointer">
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                Allow self-service subscription cancellation
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                Permits customers on closable plans to close their subscription without emailing support.
              </div>
            </div>
            <input
              type="checkbox"
              checked={portalAllowClose}
              onChange={(e) => setPortalAllowClose(e.target.checked)}
              className="w-4 h-4 mt-1 accent-[#163300] shrink-0"
            />
          </label>

          <label className="flex items-start justify-between gap-4 p-4 rounded-[16px] bg-[var(--bg-card)] border border-[var(--border-faint)] cursor-pointer">
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                Allow PDF tax invoice downloads in portal
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                Enables one-click PDF invoice and payment receipt downloads for signed-in customers.
              </div>
            </div>
            <input
              type="checkbox"
              checked={portalAllowPdfDownload}
              onChange={(e) => setPortalAllowPdfDownload(e.target.checked)}
              className="w-4 h-4 mt-1 accent-[#163300] shrink-0"
            />
          </label>

          <label className="flex items-start justify-between gap-4 p-4 rounded-[16px] bg-[var(--bg-card)] border border-[var(--border-faint)] cursor-pointer">
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                Require cancellation reason note
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                Prompts customers and staff to record a churn reason in the subscription timeline when closing.
              </div>
            </div>
            <input
              type="checkbox"
              checked={portalRequireCancelReason}
              onChange={(e) => setPortalRequireCancelReason(e.target.checked)}
              className="w-4 h-4 mt-1 accent-[#163300] shrink-0"
            />
          </label>
        </div>
      </section>

      {/* 5. Appearance & Workspace Layout */}
      <section aria-label="Appearance and workspace layout" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Appearance &amp; workspace layout
          </h2>
          <span className="text-[12px] font-medium text-[var(--text-muted)]">
            Active theme: <strong className="text-[var(--text-primary)] capitalize">{resolvedTheme}</strong>
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Theme preference"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {themeOptions.map((opt) => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleThemeSelect(opt.value)}
                className={`p-5 rounded-[20px] text-left transition-all cursor-pointer flex items-start gap-3.5 border ${
                  active
                    ? 'bg-[var(--brand-tint)] border-[var(--brand-primary)] text-[var(--brand-dark)] shadow-[var(--shadow-subtle)]'
                    : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 ${
                    active
                      ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                  }`}
                >
                  {opt.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">{opt.label}</div>
                  <div
                    className={`text-[12px] mt-0.5 ${
                      active ? 'text-[var(--brand-dark)] opacity-90' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {opt.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-[var(--bg-surface)] rounded-[24px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
              <PanelLeft className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                Compact icon sidebar
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                Collapse the navigation sidebar to compact icons to maximize horizontal table and chart space.
              </p>
            </div>
          </div>
          <Pill
            type="button"
            variant={sidebarCollapsed ? 'primary' : 'outline'}
            size="sm"
            onClick={handleToggleSidebarPref}
          >
            {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </Pill>
        </div>
      </section>

      {/* 6. Staff Account & API Connection */}
      <section aria-label="Staff profile and backend service health" className="space-y-4">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Account &amp; API connection
        </h2>

        {meReq.loading ? (
          <Skeleton rows={1} heightClass="h-[96px]" />
        ) : meReq.error ? (
          <ErrorState message={meReq.error.message} onRetry={meReq.reload} />
        ) : meReq.data ? (
          <div className="bg-[var(--bg-surface)] rounded-[24px] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] text-[var(--brand-dark)] flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                    {meReq.data.name}
                  </div>
                  <div className="text-[13px] text-[var(--text-secondary)]">
                    {meReq.data.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status="active" label={meReq.data.role} />
                <Pill
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={sendingReset}
                  onClick={handlePasswordReset}
                >
                  Send password reset link
                </Pill>
              </div>
            </div>
          </div>
        ) : null}

        <div className="bg-[var(--bg-surface)] rounded-[24px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
              <Server className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                Base URL: <span className="font-mono text-[13px]">{API_BASE_URL}</span>
              </div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                Health endpoint: GET /healthz
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {healthReq.loading ? (
              <StatusBadge status="draft" label="Checking…" />
            ) : healthReq.error ? (
              <StatusBadge status="overdue" label="Unreachable" />
            ) : (
              <StatusBadge status="active" label="Connected" />
            )}
            <Pill type="button" variant="outline" size="sm" onClick={healthReq.reload}>
              Check connection
            </Pill>
          </div>
        </div>
      </section>
    </form>
  );
}
