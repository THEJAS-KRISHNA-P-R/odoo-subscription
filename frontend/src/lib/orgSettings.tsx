'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type ProrationPolicy = 'prorate_immediately' | 'next_billing_cycle' | 'none';

export interface OrgSettings {
  logoDataUrl: string;
  companyName: string;
  supportEmail: string;
  gstin: string;
  billingAddress: string;
  invoicePrefix: string;
  quotePrefix: string;
  defaultPaymentTermDays: string;
  defaultQuoteValidityDays: string;
  invoiceFooterNote: string;
  autoEmailInvoices: boolean;
  autoConfirmBillingRun: boolean;
  dunningFirstReminderDays: string;
  dunningSecondReminderDays: string;
  dunningAutoPauseDays: string;
  prorationPolicy: ProrationPolicy;
  portalAllowPause: boolean;
  portalAllowClose: boolean;
  portalAllowPdfDownload: boolean;
  portalRequireCancelReason: boolean;
}

const STORAGE_KEY = 'brightloop:org-settings';

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  logoDataUrl: '',
  companyName: 'Brightloop',
  supportEmail: '',
  gstin: '',
  billingAddress: '',
  invoicePrefix: 'INV-',
  quotePrefix: 'QT-',
  defaultPaymentTermDays: '15',
  defaultQuoteValidityDays: '30',
  invoiceFooterNote: '',
  autoEmailInvoices: true,
  autoConfirmBillingRun: false,
  dunningFirstReminderDays: '3',
  dunningSecondReminderDays: '7',
  dunningAutoPauseDays: '21',
  prorationPolicy: 'prorate_immediately',
  portalAllowPause: true,
  portalAllowClose: true,
  portalAllowPdfDownload: true,
  portalRequireCancelReason: true,
};

interface OrgSettingsContextValue {
  settings: OrgSettings;
  updateSettings: (partial: Partial<OrgSettings>) => void;
  resetSettings: () => void;
}

const OrgSettingsContext = createContext<OrgSettingsContextValue>({
  settings: DEFAULT_ORG_SETTINGS,
  updateSettings: () => {},
  resetSettings: () => {},
});

function loadStoredSettings(): OrgSettings {
  if (typeof window === 'undefined') return DEFAULT_ORG_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORG_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<OrgSettings>;
    return { ...DEFAULT_ORG_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_ORG_SETTINGS;
  }
}

export function OrgSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<OrgSettings>(() => loadStoredSettings());

  const updateSettings = useCallback((partial: Partial<OrgSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors for oversized data URLs
        }
      }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_ORG_SETTINGS);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      resetSettings,
    }),
    [settings, updateSettings, resetSettings]
  );

  return <OrgSettingsContext.Provider value={value}>{children}</OrgSettingsContext.Provider>;
}

export function useOrgSettings() {
  return useContext(OrgSettingsContext);
}
