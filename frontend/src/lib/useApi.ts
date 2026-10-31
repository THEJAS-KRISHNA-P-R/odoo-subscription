import { useState, useEffect, useCallback } from 'react';
import { api, ApiError, RequestOptions } from './api';

export interface UseApiResult<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
}

export function useApi<T = unknown>(
  path: string | null,
  options?: RequestOptions
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));

  const fetchResource = useCallback(async () => {
    if (!path) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<T>(path, options);
      setData(res);
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              error: 'unexpected_error',
              message: err instanceof Error ? err.message : 'Failed to load data',
            });
      setError(apiErr);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void fetchResource();
  }, [fetchResource]);

  return { data, error, loading, reload: fetchResource };
}
