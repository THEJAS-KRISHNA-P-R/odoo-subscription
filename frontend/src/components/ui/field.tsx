"use client";

export interface FieldProps {
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Field = ({
  label,
  type = "text",
  placeholder,
  error,
  disabled = false,
  className,
  value,
  onChange,
}: FieldProps) => {
  return (
    <div className="space-y-1.5">
      <label className="label-meta text-[var(--text-secondary)] uppercase tracking-wider w-full">{label}</label>
      <div className="relative">
        <input
          className={`appearance-none rounded-control w-full py-2 px-3 text-[var(--text-primary)] leading-tight border border-[var(--border-hair)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] disabled:opacity-50 ${className}`}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          value={value ?? ""}
          onChange={onChange}
        />
      </div>
      {error && (
        <p className="caption-bold text-[var(--danger-fg)] mt-1">{error}</p>
      )}
    </div>
  );
};