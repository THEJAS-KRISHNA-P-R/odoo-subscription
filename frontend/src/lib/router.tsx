'use client';

import React, { useEffect } from 'react';
import NextLink from 'next/link';
import {
  usePathname as useNextPathname,
  useRouter as useNextRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

// Keeps a router instance available to plain functions such as navigateTo().
let globalRouter: AppRouterInstance | null = null;

function RouterBridge() {
  const router = useNextRouter();
  useEffect(() => {
    globalRouter = router;
  }, [router]);
  return null;
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouterBridge />
      {children}
    </>
  );
}

export function navigateTo(href: string, replaceMode = false) {
  if (typeof window === 'undefined') return;
  if (!globalRouter) {
    if (replaceMode) window.location.replace(href);
    else window.location.assign(href);
    return;
  }
  if (replaceMode) globalRouter.replace(href);
  else globalRouter.push(href);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function useRouter() {
  const router = useNextRouter();
  return {
    push: (href: string) => router.push(href),
    replace: (href: string) => router.replace(href),
    back: () => router.back(),
  };
}

export function usePathname(): string {
  return useNextPathname() ?? '/home';
}

export function useSearchParams(): URLSearchParams {
  const params = useNextSearchParams();
  return new URLSearchParams(params?.toString() ?? '');
}

interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: React.ReactNode;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, ...rest },
  ref,
) {
  return (
    <NextLink href={href} ref={ref} {...rest}>
      {children}
    </NextLink>
  );
});
