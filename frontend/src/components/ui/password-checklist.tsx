"use client";

export interface PasswordChecklistProps {
  password: string;
  className?: string;
}

export const PasswordChecklist = ({
  password,
  className,
}: PasswordChecklistProps) => {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const minLength = password.length >= 9;

  const checklistItems = [
    { id: "length", label: "At least 9 characters", passed: minLength },
    { id: "upper", label: "At least 1 uppercase letter", passed: hasUpper },
    { id: "lower", label: "At least 1 lowercase letter", passed: hasLower },
    { id: "special", label: "At least 1 special character", passed: hasSpecial },
  ];

  return (
    <div className={className}>
      <div className="space-y-1">
        {checklistItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="caption-bold text-[var(--text-secondary)]">{item.label}</span>
            <span
              className={`w-16 h-1.5 rounded-full ${item.passed
                ? "bg-[var(--brand-primary)]"
                : "bg-[var(--border-hair)]"}
                transition-colors duration-150`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};