"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { PasswordChecklist } from "@/components/ui/password-checklist";
import { Pill } from "@/components/ui/pill";
import { signup, authenticate } from "@/lib/api";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [checkingPassword, setCheckingPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setCheckingPassword(true);
    setError(null);

    try {
      const result = await signup({ email, password, fullName });
      setSuccess(true);
      // Auto-login after signup
      const auth = await authenticate(email, password);
      console.log("Auth token:", auth.token);
    } catch (err: any) {
      setError(err.error || "Signup failed");
    } finally {
      setCheckingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted p-40 flex items-center justify-center">
      <div className="bg-white rounded-24 p-8 max-w-md w-full shadow-shadow-floating">
        <h2 className="heading-section text-center mb-8 text-[var(--text-primary)]">Create Account</h2>

        {error && (
          <div className="mb-4 p-3 rounded border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-fg)] text-sm">
            {error}
          </div>
        }}

        {success && (
          <div className="mb-4 p-3 rounded border-[var(--brand-primary)] bg-[var(--brand-tint)] text-[var(--brand-text)] text-sm text-center">
            Account created! Please log in.
          </div>
        }}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Field
            label="Full Name"
            placeholder="John Doe"
            value={fullName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
            disabled={checkingPassword}
          />

          <Field
            label="Email"
            placeholder="john@brightloop.test"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            type="email"
            disabled={checkingPassword}
          />

          <Field
            label="Password"
            placeholder="•••••••••"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            disabled={checkingPassword}
          />
          <PasswordChecklist password={password} onChange={setPassword} />

          <Field
            label="Confirm Password"
            placeholder="•••••••••"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            disabled={checkingPassword}
          />

          <Pill
            variant="primary"
            disabled={checkingPassword}
            className="w-full"
          >
            {checkingPassword ? "Creating..." : "Create Account"}
          </Pill>
        </form>

        <p className="text-center text-sm mt-6 text-[var(--text-muted)]">
          Already have an account? <a href="/login" className="text-[var(--brand-primary)] font-medium">Log in</a>
        </p>
      </div>
    </div>
  );
}