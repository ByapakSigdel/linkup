'use client';

import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * A one-shot "confirm with Google" button for the destructive account-deletion
 * dialogs. Unlike GoogleSignInButton it does NOT sign in — it simply surfaces a
 * fresh Google ID token to the parent (`onCredential`) so it can be forwarded to
 * DELETE /users/me as `googleIdToken`. This is the only way an OAuth-only account
 * (whose stored passwordHash is a random `google:<sub>` value the user can never
 * reproduce) can re-authenticate to delete itself. Renders nothing when no client
 * ID is configured. Uses Google Identity Services, already loaded elsewhere.
 */
export function GoogleReauthButton({
  onCredential,
  text = 'continue_with',
  disabled,
}: {
  onCredential: (credential: string) => void;
  text?: 'continue_with' | 'signin_with';
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-initializing the GSI button each render.
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp: { credential?: string }) => {
          if (resp?.credential) cbRef.current(resp.credential);
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text,
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
  }, [text]);

  if (!CLIENT_ID) return null;

  return (
    <div
      className="flex justify-center"
      // GSI's rendered button can't itself be disabled; block interaction while
      // a deletion request is already in flight.
      style={disabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
      ref={ref}
    />
  );
}
