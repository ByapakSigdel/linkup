import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AlertCircle, CheckCircle, FileText, Upload } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText, Button, Spinner } from '@/components/ui';
import { useMediaStore, type MediaItem, type UploadFile } from '@/stores/media-store';

interface UploadControlProps {
  coupleId: string;
  albumId?: string;
  onUploadComplete?: (media: MediaItem) => void;
}

function guessMime(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  if (asset.type === 'video') return 'video/mp4';
  return 'image/jpeg';
}

function deriveName(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.fileName) return asset.fileName;
  const ext = asset.type === 'video' ? 'mp4' : 'jpg';
  return `upload-${Date.now()}.${ext}`;
}

/**
 * RN replacement for the web drag & drop dropzone — opens the device library,
 * uploads each picked asset, and renders the shared upload-progress list.
 */
export function UploadControl({ coupleId, albumId, onUploadComplete }: UploadControlProps) {
  const { colors, radius } = useTheme();
  const uploadFile = useMediaStore((s) => s.uploadFile);
  const uploads = useMediaStore((s) => s.uploads);

  const activeUploads = uploads.filter(
    (u) => u.status === 'uploading' || u.status === 'pending',
  );

  const pickAndUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 50,
      quality: 0.9,
    });

    if (result.canceled) return;

    for (const asset of result.assets) {
      const file: UploadFile = {
        uri: asset.uri,
        name: deriveName(asset),
        type: guessMime(asset),
      };
      const media = await uploadFile(coupleId, file, { albumId });
      if (media && onUploadComplete) onUploadComplete(media);
    }
  }, [coupleId, albumId, uploadFile, onUploadComplete]);

  return (
    <View style={{ gap: 10 }}>
      <Button
        variant="outline"
        onPress={pickAndUpload}
        disabled={activeUploads.length > 0}
        leftIcon={<Upload color={colors.text} size={18} />}
        label={
          activeUploads.length > 0
            ? `Uploading ${activeUploads.length}…`
            : 'Choose photos or videos'
        }
        fullWidth
      />
      <AppText muted variant="caption" center>
        Photos up to 100MB, videos up to 500MB. Max 50 files at once.
      </AppText>

      {uploads.length > 0 ? (
        <View style={{ gap: 8 }}>
          {uploads.map((u) => (
            <View
              key={u.id}
              style={[
                styles.uploadRow,
                { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.card },
              ]}
            >
              {u.status === 'uploading' ? <Spinner size="small" /> : null}
              {u.status === 'complete' ? <CheckCircle color={colors.success} size={18} /> : null}
              {u.status === 'error' ? <AlertCircle color={colors.error} size={18} /> : null}
              {u.status === 'pending' ? <FileText color={colors.textMuted} size={18} /> : null}

              <View style={{ flex: 1 }}>
                <AppText variant="caption" numberOfLines={1}>{u.file.name}</AppText>
                <AppText muted variant="caption" style={{ fontSize: 11 }}>
                  {u.status === 'uploading'
                    ? `${u.progress}%`
                    : u.status === 'error'
                      ? (u.error ?? 'Upload failed')
                      : u.status === 'complete'
                        ? 'Done'
                        : 'Pending'}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    padding: 10,
  },
});
