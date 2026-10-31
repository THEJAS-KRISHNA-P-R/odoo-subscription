'use client';

import React, { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { checkPasswordRules } from '@/lib/money';
import { Link, useRouter, useSearchParams } from '@/lib/router';
import { Field } from '@/components/ui/Field';
import { PasswordChecklist } from '@/components/ui/PasswordChecklist';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/Toast';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const initialToken = searchParams.get('token') || '';
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!token.trim()) {
      clientErrors.token = 'Reset token is required';
    }
    if (!checkPasswordRules(password).isValid) {
      clientErrors.password = 'Password must meet all security rules below';
    }
    if (Object.keys(clientErrors).length > 0) {
      setFields(clientErrors);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      await api.post('/auth/reset', {
        token: token.trim(),
        password,
      });
      showToast('Password updated. Please log in.', 'success');
      router.push('/login');
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Reset failed', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-muted)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[440px] bg-[var(--bg-card)] rounded-[24px] px-[36px] py-[40px] shadow-[var(--shadow-diffuse)] space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
            Choose a new password
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            Enter a new password for your Brightloop account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!initialToken && (
            <Field
              label="Reset token"
              type="text"
              placeholder="Paste token from reset link"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              error={fields.token}
              required
            />
          )}

          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fields.password}
            required
          />

          <PasswordChecklist password={password} />

          <Pill type="submit" variant="primary" loading={submitting} className="w-full">
            Update password
          </Pill>
        </form>

        <div className="pt-4 border-t border-[var(--border-faint)] text-center text-[14px] text-[var(--text-secondary)]">
          <Link href="/login" className="font-semibold text-[var(--brand-dark)] hover:underline">
            Back to log in
          </Link>
        </div>
      </div>
    </div>
  );
}
