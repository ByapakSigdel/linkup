// PostComposer — photo-first composer for the owner's circle. Ported from
// apps/web/src/components/circles/post-composer.tsx. Pick one or more images,
// upload each to /media/upload, then createPost with the returned cdnUrls plus an
// optional caption.

import { useCallback, useState } from 'react';
import { View, Pressable, Image, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X, Images } from 'lucide-react-native';
import { AppText, Button, Card, Spinner, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import * as circlesApi from '@/lib/circles-api';
import { assetToUploadFile, errMessage } from './helpers';
import type { CirclePost } from './types';

const MAX_IMAGES = 10;

export interface PostComposerProps {
  onPosted?: (post: CirclePost) => void;
  onCancel?: () => void;
}

export function PostComposer({ onPosted, onCancel }: PostComposerProps) {
  const { colors, radius } = useTheme();
  const coupleId = useAuthStore((s) => s.couple?.id ?? null);

  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      useToastStore.getState().push({ title: 'Permission needed', body: 'Allow photo access to share a post.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 0.9,
    });
    if (result.canceled) return;
    setError(null);
    setAssets((prev) => {
      const room = MAX_IMAGES - prev.length;
      const accepted = result.assets.slice(0, Math.max(0, room));
      if (result.assets.length > room) {
        setError(`You can attach up to ${MAX_IMAGES} photos per post.`);
      }
      return [...prev, ...accepted];
    });
  }, []);

  const removeImage = useCallback((uri: string) => {
    setAssets((prev) => prev.filter((a) => a.uri !== uri));
  }, []);

  const canSubmit = assets.length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (assets.length === 0) {
      setError('Add at least one photo to share.');
      return;
    }
    if (!coupleId) {
      setError('We could not find your couple. Please reload and try again.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const uploaded = await Promise.all(
        assets.map((a) => circlesApi.uploadMedia(assetToUploadFile(a), coupleId)),
      );
      const mediaUrls = uploaded.map((u) => u.media.cdnUrl);
      const { post } = await circlesApi.createPost({
        mediaUrls,
        caption: caption.trim() || undefined,
        type: mediaUrls.length > 1 ? 'carousel' : 'photo',
      });
      onPosted?.(post);
      setAssets([]);
      setCaption('');
    } catch (err) {
      setError(errMessage(err, 'Something went wrong while sharing your post.'));
    } finally {
      setSubmitting(false);
    }
  }, [assets, coupleId, caption, onPosted]);

  return (
    <Card variant="bordered" style={{ gap: 16 }}>
      {assets.length === 0 ? (
        <Pressable
          onPress={pick}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            borderRadius: 14,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.border,
            paddingVertical: 36,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceActive, alignItems: 'center', justifyContent: 'center' }}>
            <ImagePlus size={26} color={colors.textMuted} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <AppText variant="label">Share a photo</AppText>
            <AppText variant="caption" muted style={{ marginTop: 2 }}>
              Pick one or more photos for your circle
            </AppText>
          </View>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {assets.map((a) => (
            <View key={a.uri} style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <Image source={{ uri: a.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <Pressable
                onPress={() => removeImage(a.uri)}
                disabled={submitting}
                accessibilityLabel="Remove photo"
                style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={13} color="#fff" />
              </Pressable>
            </View>
          ))}
          {assets.length < MAX_IMAGES ? (
            <Pressable
              onPress={pick}
              disabled={submitting}
              accessibilityLabel="Add more photos"
              style={{ width: 80, height: 80, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 2 }}
            >
              <Images size={20} color={colors.textMuted} />
              <AppText style={{ fontSize: 10, fontWeight: '600' }} muted>
                Add
              </AppText>
            </Pressable>
          ) : null}
        </View>
      )}

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Write a caption… (optional)"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={2200}
        editable={!submitting}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.input,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.text,
          minHeight: 64,
          textAlignVertical: 'top',
        }}
      />

      {error ? (
        <AppText variant="caption" color={colors.error}>
          {error}
        </AppText>
      ) : null}

      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="caption" muted>
          {assets.length > 0 ? `${assets.length} photo${assets.length === 1 ? '' : 's'} selected` : 'Photos only'}
        </AppText>
        <Row gap={8}>
          {onCancel ? (
            <Button variant="ghost" size="sm" onPress={onCancel} disabled={submitting} label="Cancel" />
          ) : null}
          <Button variant="primary" size="sm" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} label={submitting ? 'Sharing…' : 'Share'} />
        </Row>
      </Row>

      {submitting && assets.length > 0 ? (
        <Row gap={8}>
          <Spinner size="small" />
          <AppText variant="caption" muted>
            Uploading {assets.length} photo{assets.length === 1 ? '' : 's'}…
          </AppText>
        </Row>
      ) : null}
    </Card>
  );
}
