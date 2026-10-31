'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, ApiError } from './api';
import { EnumOption, MetaResponse, MeProfile } from './types';

interface MetaContextValue {
  meta: MetaResponse | null;
  loading: boolean;
  error: ApiError | null;
  reloadMeta: () => Promise<MetaResponse | null>;
}

const MetaContext = createContext<MetaContextValue>({
  meta: null,
  loading: true,
  error: null,
  reloadMeta: async () => null,
});

export function MetaProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<MetaResponse>('/meta', { skipAuthRedirect: true });
      setMeta(res);
      return res;
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              error: 'meta_load_failed',
              message: err instanceof Error ? err.message : 'Failed to load metadata',
            });
      setError(apiErr);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  return (
    <MetaContext.Provider value={{ meta, loading, error, reloadMeta: loadMeta }}>
      {children}
    </MetaContext.Provider>
  );
}

export function useMeta() {
  return useContext(MetaContext);
}

/**
 * Returns the enum array [{ value, label }] from GET /meta for the given domain enum name.
 * Never returns hardcoded enum values.
 */
export function useEnum(name: string): EnumOption[] {
  const { meta } = useContext(MetaContext);
  if (!meta || !meta.enums) return [];
  return meta.enums[name] || [];
}

/**
 * Returns the subscription_transitions map from GET /meta.
 */
export function useTransitions(): Record<string, string[]> {
  const { meta } = useContext(MetaContext);
  if (!meta || !meta.subscription_transitions) return {};
  return meta.subscription_transitions;
}

/**
 * Returns the authenticated user's profile and capabilities from GET /meta.
 */
export function useMe(): MeProfile | null {
  const { meta } = useContext(MetaContext);
  return meta?.me ?? null;
}

/**
 * Checks whether the current user has a capability from meta.me.capabilities.
 * When the backend is unreachable in preview (network_error), allows UI affordances to render so forms can be inspected.
 */
export function useCan(capability: string): boolean {
  const { meta, error } = useContext(MetaContext);
  if (!meta && error && error.status === 0) {
    return true;
  }
  const caps = meta?.me?.capabilities;
  if (!Array.isArray(caps)) return false;
  return caps.includes(capability);
}
