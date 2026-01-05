'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

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
      return urlString.includes('/api/access-requests') && urlString.includes('status=pending');
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

  const hide = () => {
    setFadeOut(true);
    setTimeout(() => setVisible(false), 400);
  };
  const show = () => {
    setVisible(true);
    setFadeOut(false);
  };

  // Hide when page fully loaded
  useEffect(() => {
    if (STICKY_OVERLAY) return; // testing bypass
    if (document.readyState === 'complete') hide();
    else {
      const onLoad = () => hide();
      window.addEventListener('load', onLoad);
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  // On route changes: briefly show overlay and fade it out
  useEffect(() => {
    if (STICKY_OVERLAY) return;
    show();
    const t = setTimeout(() => hide(), 500);
    return () => clearTimeout(t);
  }, [pathname]);

  // Listen to network busy/idle to control overlay
  useEffect(() => {
    if (STICKY_OVERLAY) return;
    const onBusy = () => show();
    const onIdle = () => hide();
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
        <img src="/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png" alt="loading" className="preloader-image" />
        <div className="preloader-text">Loading…</div>
      </div>
    </div>
  );
}


