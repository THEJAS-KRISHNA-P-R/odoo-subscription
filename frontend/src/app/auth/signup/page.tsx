"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/field";
import { PasswordChecklist } from "@/components/ui/password-checklist";
import { Pill } from "@/components/ui/pill";
import { signup } from "@/lib/api";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSuccess, setHasSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordType = showPassword ? "text" : "password";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password || !fullName) {
      setHasError(true);
      setErrorMessage("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setHasError(true);
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setHasError(false);
    setHasSuccess(false);

    try {
      await signup({ email, password, fullName });
      setHasSuccess(true);
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      setHasError(true);
      setErrorMessage(
        error instanceof Error ? error.message : "Signup failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-10 flex items-center justify-center">
      <div className="bg-white rounded-24 p-8 max-w-md w-full shadow-shadow-floating">
        <h1 className="heading-section text-center mb-8 text-[var(--text-primary)]">
          Create Account
        </h1>

        {hasError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-fg)] text-sm"
          >
            {errorMessage}
          </div>
        )}

        {hasSuccess && (
          <div
            role="status"
            className="mb-4 p-3 rounded border-[var(--brand-primary)] bg-[var(--brand-tint)] text-[var(--brand-text)] text-sm text-center"
          >
            Account created.{" "}
            <Link href="/" className="font-medium underline">
              Continue
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <Field
            label="Full Name"
            placeholder="John Doe"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={submitting}
          />

          <Field
            label="Email"
            placeholder="john@brightloop.test"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            disabled={submitting}
          />

          <div className="space-y-2">
            <Field
              label="Password"
              placeholder="•••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={passwordType}
              disabled={submitting}
            />
            <PasswordChecklist password={password} />
          </div>

          <Field
            label="Confirm Password"
            placeholder="•••••••••"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type={passwordType}
            disabled={submitting}
          />

          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
              disabled={submitting}
            />
            Show passwords
          </label>

          <Pill
            variant="primary"
            disabled={submitting}
            className="w-full justify-center"
          >
            {submitting ? "Creating..." : "Create Account"}
          </Pill>
        </form>

        <p className="text-center text-sm mt-6 text-[var(--text-muted)]">
          Already have an account?{" "}
          <Link href="/" className="text-[var(--brand-primary)] font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
