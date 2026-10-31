'use client';

import { useEffect } from 'react';
import { useRouter } from '@/lib/router';
import { useMeta } from '@/lib/meta';

export default function RootPage() {
  const router = useRouter();
  const { meta, loading } = useMeta();

  useEffect(() => {
    if (loading) return;
    if (!meta?.me) {
      router.replace('/login');
    } else if (meta.me.role === 'customer') {
      router.replace('/portal/home');
    } else {
      router.replace('/home');
    }
  }, [meta, loading, router]);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
