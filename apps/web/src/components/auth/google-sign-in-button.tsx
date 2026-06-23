'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * "Continue with Google" via Google Identity Services. Renders Google's official
 * button (dark theme to suit the celestial palette); on success it posts the ID
 * token to /auth/google and redirects. Renders nothing if no client ID is set.
 */
export function GoogleSignInButton({ redirectTo = '/chat' }: { redirectTo?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (resp: { credential?: string }) => {
          if (!resp?.credential) return;
          try {
            await loginWithGoogle(resp.credential);
            router.push(redirectTo);
          } catch {
            setError('Google sign-in failed. Please try again.');
          }
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'center',
        width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      const existing = document.getElementById('gsi-client') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', init, { once: true });
      } else {
        const s = document.createElement('script');
        s.id = 'gsi-client';
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.onload = init;
        document.head.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle, router, redirectTo]);

  if (!CLIENT_ID) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex justify-center" ref={ref} />
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex w-full items-center gap-3 text-xs text-text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
