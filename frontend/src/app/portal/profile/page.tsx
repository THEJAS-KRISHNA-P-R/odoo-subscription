'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { MeProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pill } from '@/components/ui/Pill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';

export default function PortalProfilePage() {
  const { showToast } = useToast();
  const meReq = useApi<MeProfile>('/auth/me');
  const [sendingReset, setSendingReset] = useState(false);

  const handleRequestPasswordReset = async () => {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
          Profile
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">
          Your customer account details and security settings
        </p>
      </div>

      {meReq.loading ? (
        <Skeleton rows={2} heightClass="h-[140px]" />
      ) : meReq.error ? (
        <ErrorState message={meReq.error.message} onRetry={meReq.reload} />
      ) : meReq.data ? (
        <div className="bg-[var(--bg-surface)] rounded-[24px] p-8 space-y-6 max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[20px] font-bold text-[var(--text-primary)]">
                {meReq.data.name}
              </div>
              <div className="text-[14px] text-[var(--text-secondary)] mt-0.5">
                {meReq.data.email}
              </div>
            </div>
            <StatusBadge status="active" label={meReq.data.role} />
          </div>

          <div className="pt-4 border-t border-[var(--border-hair)] flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                Password & security
              </div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                Send a single-use password reset link to your registered email
              </div>
            </div>
            <Pill
              variant="outline"
              size="sm"
              loading={sendingReset}
              onClick={handleRequestPasswordReset}
            >
              Send reset link
            </Pill>
          </div>
        </div>
      ) : null}
    </div>
  );
}
