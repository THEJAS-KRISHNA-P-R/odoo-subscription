'use client';

import React, { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Link } from '@/lib/router';
import { Field } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/Toast';

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setFields({ email: 'Enter a valid email' });
      return;
    }
    setFields({});
    setSubmitting(true);
    try {
      await api.post('/auth/forgot', { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Request failed', 'error');
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
            Reset password
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            Enter your account email to receive a password reset link
          </p>
        </div>

        {submitted ? (
          <div className="bg-[var(--brand-tint)] text-[var(--brand-dark)] rounded-[16px] p-5 text-[14px] font-medium text-center space-y-3">
            <p>If the account exists, we sent a link.</p>
            <div>
              <Link href="/login" className="underline font-semibold">
                Return to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field
              label="Email address"
              type="email"
              placeholder="you@company.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fields.email}
              required
            />
            <Pill type="submit" variant="primary" loading={submitting} className="w-full">
              Send reset link
            </Pill>
          </form>
        )}

        <div className="pt-4 border-t border-[var(--border-faint)] text-center text-[14px] text-[var(--text-secondary)]">
          <Link href="/login" className="font-semibold text-[var(--brand-dark)] hover:underline">
            Back to log in
          </Link>
        </div>
      </div>
    </div>
  );
}
