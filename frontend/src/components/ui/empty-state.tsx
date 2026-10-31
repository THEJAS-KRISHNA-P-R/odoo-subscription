"use client";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "soft";
  };
  className?: string;
}

export const EmptyState = ({
  title,
  description,
  action,
  className,
}: EmptyStateProps) => {
  return (
    <div className={`text-center py-20 ${className}`}>
      <p className="text-[var(--text-muted)] text-lg max-w-md mx-auto">
        {title}
      </p>
      {description && (
        <p className="mt-2 text-[var(--text-secondary)]">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          <button
            className="pill-btn pill-btn--primary"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
};