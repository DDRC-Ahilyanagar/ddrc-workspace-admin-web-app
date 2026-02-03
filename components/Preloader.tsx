'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Use relative path for static assets to avoid hydration mismatch
const LOGO_URL = '/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png';

export default function Preloader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const STICKY_OVERLAY = false; // normal behaviour

  // Install a tiny global fetch monitor to know when APIs finish
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.__fetchMonInstalled) return;
    w.__fetchMonInstalled = true;
    w.__pendingFetch = 0;
    const emit = (name: 'app:busy' | 'app:idle') => window.dispatchEvent(new CustomEvent(name));
    const orig = window.fetch.bind(window);

    // URLs that should not trigger the loader
    const shouldExcludeLoader = (url: string | Request | URL): boolean => {
      let urlString: string | undefined;
      if (typeof url === 'string') {
        urlString = url;
      } else if (url instanceof URL) {
        urlString = url.toString();
      } else if (url instanceof Request) {
        urlString = url.url;
      } else {
        // Fallback: try to get URL from any object
        urlString = (url as any)?.url || (url as any)?.href || String(url);
      }

      // If we still don't have a valid URL string, don't exclude (let loader show)
      if (!urlString || typeof urlString !== 'string') {
        return false;
      }

      // Exclude /api/access-requests?status=pending (with or without additional params)
      if (urlString.includes('/api/access-requests') && urlString.includes('status=pending')) {
        return true;
      }

      // Exclude location tracking polling endpoints that run frequently
      // These should not trigger the preloader as they're background updates
      // Check for both relative and absolute URLs
      const locationEndpoints = ['/api/location/online-status', '/api/location/latest'];
      for (const endpoint of locationEndpoints) {
        if (urlString.includes(endpoint)) {
          return true;
        }
      }

      return false;
    };

    window.fetch = async (...args: any[]) => {
      const url = args[0];
      const excludeLoader = shouldExcludeLoader(url);

      try {
        if (!excludeLoader && w.__pendingFetch++ === 0) emit('app:busy');
        const res = await orig(...(args as [RequestInfo, RequestInit]));
        return res;
      } finally {
        if (!excludeLoader) {
          if (--w.__pendingFetch <= 0) {
            w.__pendingFetch = 0;
            emit('app:idle');
          }
        }
      }
    };
  }, []);

  // Wrap state updates to prevent "update while rendering" warnings
  const safeSetVisible = (val: boolean) => {
    requestAnimationFrame(() => {
      setVisible(val);
    });
  };

  const hide = () => {
    setFadeOut(true);
    setTimeout(() => safeSetVisible(false), 400);
  };
  const show = () => {
    // Only show if not already visible to avoid redundant updates
    setVisible((prev) => {
      if (!prev) {
        setFadeOut(false);
        return true;
      }
      return prev;
    });
    setFadeOut(false);
  };

  // Hide when page fully loaded
  useEffect(() => {
    if (STICKY_OVERLAY) return;

    // Defer the check to ensure hydration is complete
    const t = setTimeout(() => {
      if (document.readyState === 'complete') hide();
    }, 100);

    const onLoad = () => hide();
    window.addEventListener('load', onLoad);
    return () => {
      clearTimeout(t);
      window.removeEventListener('load', onLoad);
    };
  }, []);

  // On route changes: briefly show overlay and fade it out
  useEffect(() => {
    if (STICKY_OVERLAY) return;

    // Use a small timeout to ensure we don't update state during the render commit of the new route
    const t1 = setTimeout(() => show(), 0);
    const t2 = setTimeout(() => hide(), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  // Listen to network busy/idle to control overlay
  useEffect(() => {
    if (STICKY_OVERLAY) return;

    const onBusy = () => {
      // Small delay to prevent flashing for very fast requests
      requestAnimationFrame(() => show());
    };
    const onIdle = () => {
      requestAnimationFrame(() => hide());
    };

    window.addEventListener('app:busy', onBusy);
    window.addEventListener('app:idle', onIdle);
    return () => {
      window.removeEventListener('app:busy', onBusy);
      window.removeEventListener('app:idle', onIdle);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`global-preloader ${fadeOut ? 'fade-out' : ''}`}>
      <div className="preloader-inner">
        <img src={LOGO_URL} alt="loading" className="preloader-image" />
        <div className="preloader-text">Loading…</div>
      </div>
    </div>
  );
}


