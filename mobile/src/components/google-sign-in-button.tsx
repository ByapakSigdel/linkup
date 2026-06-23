import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { AppText } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { CELESTIAL as C } from '@/theme/celestial';
import { GOOGLE_WEB_CLIENT_ID } from '@/lib/env';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/**
 * Native "Continue with Google". Uses @react-native-google-signin configured
 * with the Web client ID, so the returned ID token's audience is the web client
 * — which the backend /auth/google accepts. Requires the Android OAuth client
 * (package + signing SHA-1) to exist in the same Google project.
 */
export function GoogleSignInButton({ onError }: { onError?: (msg: string) => void }) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [loading, setLoading] = useState(false);

  const onPress = async () => {
    setLoading(true);
    onError?.('');
    try {
      ensureConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res: any = await GoogleSignin.signIn();
      // v13+ returns { type, data: { idToken } }; older returns { idToken }.
      const idToken = res?.data?.idToken ?? res?.idToken;
      if (!idToken) throw new Error('No ID token returned from Google');
      await loginWithGoogle(idToken);
      router.replace('/dashboard');
    } catch (e: any) {
      const code = e?.code;
      // Silently ignore user-cancelled / in-progress.
      if (code === 'SIGN_IN_CANCELLED' || code === '12501' || code === -5 || code === 'IN_PROGRESS') {
        // no-op
      } else {
        onError?.('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Pressable
        onPress={onPress}
        disabled={loading}
        style={{
          height: 50,
          borderRadius: 999,
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? <ActivityIndicator color={C.text} /> : <GoogleG />}
        <AppText weight="500" style={{ fontSize: 15, color: C.text }}>
          Continue with Google
        </AppText>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        <AppText muted style={{ fontSize: 12 }}>
          or
        </AppText>
        <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
      </View>
    </View>
  );
}
