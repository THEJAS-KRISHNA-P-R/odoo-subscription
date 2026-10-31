"use client";

export interface StatusBadgeProps {
  status:
    | "draft"
    | "quotation"
    | "confirmed"
    | "active"
    | "paused"
    | "closed"
    | "paid"
    | "overdue";
  className?: string;
  size?: "sm" | "md";
}

const statusColors: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#E2E8F0", fg: "#475569" },
  quotation: { bg: "#BFDBFE", fg: "#1E4ED8" },
  confirmed: { bg: "#A855F7", fg: "#EC4899" },
  active: { bg: "#9FE870", fg: "#163300" },
  paused: { bg: "#FDD677", fg: "#D97706" },
  closed: { bg: "#9CA3AF", fg: "#6B7280" },
  paid: { bg: "#9FE870", fg: "#163300" },
  overdue: { bg: "#FECACA", fg: "#DC2626" },
};

export const StatusBadge = ({
  status,
  className,
  size = "md",
}: StatusBadgeProps) => {
  const colors = statusColors[status];
  const fontSize = size === "sm" ? "0.65rem" : "0.75rem";
  const padding = size === "sm" ? "3px 6px" : "4px 8px";

  const style: React.CSSProperties = {
    backgroundColor: colors.bg,
    padding: padding,
    fontSize: fontSize,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full ${className ?? ""}`}
      style={style}
      aria-label={status}
    >
      {status}
    </span>
  );
};