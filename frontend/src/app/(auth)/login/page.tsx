'use client';

import React, { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useMeta } from '@/lib/meta';
import { Link, useRouter } from '@/lib/router';
import { Field } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const router = useRouter();
  const { reloadMeta } = useMeta();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!email.trim() || !email.includes('@')) {
      clientErrors.email = 'Enter a valid email';
    }
    if (!password) {
      clientErrors.password = 'Password is required';
    }
    if (Object.keys(clientErrors).length > 0) {
      setFields(clientErrors);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      const res = await api.post<{ role?: string }>('/auth/login', {
        email: email.trim(),
        password,
      });
      const updatedMeta = await reloadMeta();
      const role = res?.role || updatedMeta?.me?.role;
      if (role === 'customer') {
        router.push('/portal/home');
      } else {
        router.push('/home');
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Login failed', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-muted)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[440px] bg-[var(--bg-card)] rounded-[24px] px-[36px] py-[40px] shadow-[var(--shadow-diffuse)] space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] font-bold text-[18px] mb-1">
            B
          </div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
            Welcome back
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            Sign in to your Brightloop billing account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@company.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fields.email}
            required
          />

          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fields.password}
            required
          />

          <div className="flex items-center justify-end">
            <Link
              href="/forgot"
              className="text-[13px] font-semibold text-[var(--brand-dark)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Pill type="submit" variant="primary" loading={submitting} className="w-full">
            Log in
          </Pill>
        </form>

        <div className="pt-4 border-t border-[var(--border-faint)] text-center space-y-2 text-[14px] text-[var(--text-secondary)]">
          <div>
            New to Brightloop?{' '}
            <Link href="/signup" className="font-semibold text-[var(--brand-dark)] hover:underline">
              Create customer account
            </Link>
          </div>
          <div className="pt-1 flex items-center justify-center gap-4 text-[12px] text-[var(--text-muted)]">
            <Link href="/home" className="hover:text-[var(--text-primary)] hover:underline">
              Staff workspace
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/portal/home" className="hover:text-[var(--text-primary)] hover:underline">
              Customer portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
