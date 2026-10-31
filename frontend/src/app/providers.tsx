'use client';

import React from 'react';
import { ThemeProvider } from '@/lib/theme';
import { OrgSettingsProvider } from '@/lib/orgSettings';
import { MetaProvider } from '@/lib/meta';
import { RouterProvider } from '@/lib/router';
import { ToastProvider } from '@/components/ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <OrgSettingsProvider>
        <RouterProvider>
          <ToastProvider>
            <MetaProvider>{children}</MetaProvider>
          </ToastProvider>
        </RouterProvider>
      </OrgSettingsProvider>
    </ThemeProvider>
  );
}
