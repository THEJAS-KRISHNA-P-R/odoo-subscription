"use client";

export interface SkeletonProps {
  className?: string;
  rows?: number;
}

export const Skeleton = ({ className, rows = 3 }: SkeletonProps) => {
  return (
    <div className={`space-y-2 min-h-8 ${className ?? ""}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-6 rounded w-full animate-pulse bg-[var(--bg-surface)]"
        />
      ))}
    </div>
  );
};
