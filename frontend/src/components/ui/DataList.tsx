'use client';

import React from 'react';
import { Skeleton } from './Skeleton';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { GroupedRowContainer } from './GroupedRow';
import { Pill } from './Pill';

export interface DataListProps<T> {
  items: T[];
  loading: boolean;
  loadingMore?: boolean;
  error: { message: string } | null;
  onRetry: () => void;
  emptyTitle: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  nextCursor?: string | null;
  onLoadMore?: () => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  skeletonCount?: number;
}

export function DataList<T>({
  items,
  loading,
  loadingMore = false,
  error,
  onRetry,
  emptyTitle,
  emptyActionLabel,
  onEmptyAction,
  nextCursor,
  onLoadMore,
  renderItem,
  skeletonCount = 5,
}: DataListProps<T>) {
  if (loading && items.length === 0) {
    return <Skeleton rows={skeletonCount} />;
  }

  if (error && items.length === 0) {
    return <ErrorState message={error.message} onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        message={emptyTitle}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="space-y-5">
      <GroupedRowContainer>
        {items.map((item, idx) => renderItem(item, idx))}
      </GroupedRowContainer>

      {error && (
        <ErrorState message={error.message} onRetry={onRetry} />
      )}

      {nextCursor && onLoadMore && (
        <div className="flex justify-center pt-2">
          <Pill variant="outline" onClick={onLoadMore} loading={loadingMore}>
            Load more
          </Pill>
        </div>
      )}
    </div>
  );
}
