'use client';

import React, { useId } from 'react';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export function Field({
  label,
  error,
  helpText,
  required,
  id,
  className = '',
  ...rest
}: FieldProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]"
      >
        {label}
        {required && <span className="text-[var(--danger-fg)] ml-1">*</span>}
      </label>
      <input
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
        className={`w-full h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-card)] border text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-dark)] disabled:bg-[var(--bg-muted)] disabled:text-[var(--text-disabled)] ${
          error ? 'border-[var(--danger-fg)] bg-[var(--danger-bg)]/20' : 'border-[var(--border-hair)]'
        } ${className}`}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-[12px] font-medium text-[var(--danger-fg)]">
          {error}
        </p>
      )}
      {!error && helpText && (
        <p id={`${inputId}-help`} className="text-[12px] text-[var(--text-muted)]">
          {helpText}
        </p>
      )}
    </div>
  );
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  children?: React.ReactNode;
}

export function SelectField({
  label,
  error,
  helpText,
  required,
  id,
  className = '',
  options,
  children,
  ...rest
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={selectId}
        className="block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]"
      >
        {label}
        {required && <span className="text-[var(--danger-fg)] ml-1">*</span>}
      </label>
      <select
        id={selectId}
        required={required}
        aria-invalid={Boolean(error)}
        className={`w-full h-[44px] px-3.5 rounded-[10px] bg-[var(--bg-card)] border text-[14px] text-[var(--text-primary)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-dark)] disabled:bg-[var(--bg-muted)] ${
          error ? 'border-[var(--danger-fg)]' : 'border-[var(--border-hair)]'
        } ${className}`}
        {...rest}
      >
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : children}
      </select>
      {error && <p className="text-[12px] font-medium text-[var(--danger-fg)]">{error}</p>}
      {!error && helpText && <p className="text-[12px] text-[var(--text-muted)]">{helpText}</p>}
    </div>
  );
}

export interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export function TextareaField({
  label,
  error,
  helpText,
  required,
  id,
  className = '',
  ...rest
}: TextareaFieldProps) {
  const generatedId = useId();
  const areaId = id || generatedId;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={areaId}
        className="block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]"
      >
        {label}
        {required && <span className="text-[var(--danger-fg)] ml-1">*</span>}
      </label>
      <textarea
        id={areaId}
        required={required}
        aria-invalid={Boolean(error)}
        className={`w-full p-3.5 rounded-[10px] bg-[var(--bg-card)] border text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-dark)] ${
          error ? 'border-[var(--danger-fg)]' : 'border-[var(--border-hair)]'
        } ${className}`}
        rows={3}
        {...rest}
      />
      {error && <p className="text-[12px] font-medium text-[var(--danger-fg)]">{error}</p>}
      {!error && helpText && <p className="text-[12px] text-[var(--text-muted)]">{helpText}</p>}
    </div>
  );
}
