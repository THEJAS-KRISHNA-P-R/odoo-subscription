'use client';

import React, { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { checkPasswordRules } from '@/lib/money';
import { useMeta } from '@/lib/meta';
import { Link, useRouter } from '@/lib/router';
import { Field } from '@/components/ui/Field';
import { PasswordChecklist } from '@/components/ui/PasswordChecklist';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/Toast';

export default function SignupPage() {
  const router = useRouter();
  const { meta, loading, reloadMeta } = useMeta();
  const { showToast } = useToast();

  useEffect(() => {
    if (!loading && meta?.me) {
      if (meta.me.role === 'customer') {
        router.replace('/portal/home');
      } else {
        router.replace('/home');
      }
    }
  }, [loading, meta, router]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!fullName.trim()) {
      clientErrors.full_name = 'Name is required';
    }
    if (!email.trim() || !email.includes('@')) {
      clientErrors.email = 'Enter a valid email';
    }
    const rules = checkPasswordRules(password);
    if (!rules.isValid) {
      clientErrors.password = 'Password must meet all security rules below';
    }
    if (Object.keys(clientErrors).length > 0) {
      setFields(clientErrors);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      const res = await api.post<{ role?: string }>('/auth/signup', {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });
      await reloadMeta();
      showToast('Account created', 'success');
      if (res?.role === 'admin' || res?.role === 'staff') {
        router.push('/home');
      } else {
        router.push('/portal/home');
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Sign-up failed', 'error');
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
            Create your account
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            Manage your subscriptions and invoices in one place
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field
            label="Full name"
            type="text"
            autoComplete="name"
            placeholder="Asha Narayanan"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fields.full_name}
            required
          />

          <Field
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="asha@shop.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fields.email}
            required
          />

          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fields.password}
            required
          />

          <PasswordChecklist password={password} />

          <Pill type="submit" variant="primary" loading={submitting} className="w-full">
            Sign up
          </Pill>
        </form>

        <div className="pt-4 border-t border-[var(--border-faint)] text-center text-[14px] text-[var(--text-secondary)]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[var(--brand-dark)] hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
