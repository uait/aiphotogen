'use client';

import { useEffect } from 'react';

/**
 * Global defensive patches for client runtime.
 * - Prevents duplicate custom element definition errors in dev/overlay environments.
 */
export default function GlobalPatches() {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'customElements' in window) {
        const ce: any = window.customElements as any;
        if (!ce.__define_patched) {
          const origDefine = ce.define?.bind(ce);
          if (typeof origDefine === 'function') {
            ce.define = (name: string, constructor: any, options?: any) => {
              try {
                if (ce.get && ce.get(name)) {
                  // Already registered: ignore duplicate definitions
                  return;
                }
              } catch {}
              return origDefine(name, constructor, options);
            };
            ce.__define_patched = true;
          }
        }
      }
    } catch (e) {
      // Non-fatal; continue without patch
      console.warn('GlobalPatches: customElements patch skipped', e);
    }
  }, []);

  return null;
}

