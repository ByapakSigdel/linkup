import { Alert, Linking } from 'react-native';
import { APP_BUILD, UPDATE_MANIFEST_URL } from '@/lib/env';

let autoChecked = false;

interface UpdateManifest {
  build?: number;
  version?: string;
  url?: string;
  notes?: string;
}

/**
 * Check the server for a newer APK and (if found) prompt the user to download it.
 * Pure JS — opens the APK URL in the browser, which downloads it; tapping the
 * download installs it. No native modules required.
 *
 * @param opts.silent  true = launch check (no "you're up to date" / error popups,
 *                      and only runs once per app session).
 */
export async function checkForUpdate(opts?: { silent?: boolean }): Promise<void> {
  const silent = opts?.silent ?? false;
  if (silent && autoChecked) return;
  if (silent) autoChecked = true;

  try {
    const res = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`);
    if (!res.ok) {
      if (!silent) Alert.alert('Update check failed', 'Could not reach the update server. Try again later.');
      return;
    }
    const m: UpdateManifest = await res.json();
    const latest = Number(m.build ?? 0);

    if (!latest || latest <= APP_BUILD) {
      if (!silent) {
        Alert.alert("You're up to date", `LinkUp ${m.version ?? ''} is the latest version.`.trim());
      }
      return;
    }

    const url = String(m.url ?? '');
    if (!url) return;

    Alert.alert(
      'Update available',
      `${m.version ? `LinkUp ${m.version}` : 'A new version'} is ready.${m.notes ? `\n\n${m.notes}` : ''}\n\nThis opens the download — tap the file when it finishes to install.`,
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Update', onPress: () => void Linking.openURL(url).catch(() => {}) },
      ],
    );
  } catch {
    if (!silent) Alert.alert('Update check failed', 'Could not reach the update server. Try again later.');
  }
}
