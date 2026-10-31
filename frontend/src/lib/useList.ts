import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, ApiError } from './api';

export interface KeysetPage<T> {
  items: T[];
  next_cursor: string | null;
}

export interface UseListResult<T> {
  items: T[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  loadMore: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useList<T = unknown>(
  path: string | null,
  filters?: Record<string, string | number | boolean | undefined | null>,
  pageSize = 25
): UseListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  const filterKey = useMemo(() => {
    if (!filters) return '';
    const params = new URLSearchParams();
    Object.keys(filters)
      .sort()
      .forEach((k) => {
        const val = filters[k];
        if (val !== undefined && val !== null && val !== '') {
          params.set(k, String(val));
        }
      });
    return params.toString();
  }, [filters]);

  const buildUrl = useCallback(
    (cursor?: string | null) => {
      if (!path) return null;
      const [basePath, existingQuery] = path.split('?');
      const params = new URLSearchParams(existingQuery || '');
      if (!params.has('limit')) {
        params.set('limit', String(pageSize));
      }
      if (filterKey) {
        const extra = new URLSearchParams(filterKey);
        extra.forEach((val, key) => {
          params.set(key, val);
        });
      }
      if (cursor) {
        params.set('cursor', cursor);
      }
      const qs = params.toString();
      return qs ? `${basePath}?${qs}` : basePath;
    },
    [path, filterKey, pageSize]
  );

  const loadFirstPage = useCallback(async () => {
    const url = buildUrl(null);
    if (!url) {
      setItems([]);
      setNextCursor(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<KeysetPage<T> | T[]>(url);
      if (Array.isArray(response)) {
        setItems(response);
        setNextCursor(null);
      } else {
        setItems(Array.isArray(response?.items) ? response.items : []);
        setNextCursor(response?.next_cursor ?? null);
      }
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              error: 'unexpected_error',
              message: err instanceof Error ? err.message : 'Failed to load list',
            });
      setError(apiErr);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return;
    const url = buildUrl(nextCursor);
    if (!url) return;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await api.get<KeysetPage<T> | T[]>(url);
      if (Array.isArray(response)) {
        setItems((prev) => [...prev, ...response]);
        setNextCursor(null);
      } else {
        const nextItems = Array.isArray(response?.items) ? response.items : [];
        setItems((prev) => [...prev, ...nextItems]);
        setNextCursor(response?.next_cursor ?? null);
      }
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              error: 'unexpected_error',
              message: err instanceof Error ? err.message : 'Failed to load more items',
            });
      setError(apiErr);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, loading, buildUrl]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  return {
    items,
    nextCursor,
    loading,
    loadingMore,
    error,
    loadMore,
    reset: loadFirstPage,
  };
}
