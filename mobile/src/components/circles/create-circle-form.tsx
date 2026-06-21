// Opt-in profile creation for a couple's Circle. Ported from
// apps/web/src/components/circles/create-circle-form.tsx. Collects @handle,
// display name, bio, avatar + cover (uploaded via /media/upload), and a
// public/private toggle, then POST /circles.

import { useState } from 'react';
import { View, Pressable, Image, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Globe, ImagePlus, Lock } from 'lucide-react-native';
import { AppText, Button, Input, Card, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { resolveMediaUrl } from '@/lib/env';
import { useToastStore } from '@/stores/toast-store';
import { useAuthStore } from '@/stores/auth-store';
import * as circlesApi from '@/lib/circles-api';
import { assetToUploadFile, isHandleValid, sanitizeHandle, errMessage } from './helpers';
import type { CircleProfileResponse } from './types';

interface CreateCircleFormProps {
  onCreated: (circle: CircleProfileResponse['circle']) => void;
  onCancel?: () => void;
}

export function CreateCircleForm({ onCreated, onCancel }: CreateCircleFormProps) {
  const { colors, radius } = useTheme();
  const couple = useAuthStore((s) => s.couple);
  const pushToast = useToastStore((s) => s.push);

  const [handle, setHandle] = useState('');
  const [name, setName] = useState(couple?.coupleName ?? '');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(couple?.coupleAvatarUrl ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValid = isHandleValid(handle);
  const handleTooShort = handle.length > 0 && handle.length < 3;

  async function pickAndUpload(
    setUrl: (url: string) => void,
    setBusy: (busy: boolean) => void,
  ) {
    if (!couple?.id) {
      setError('You must be part of a couple to create a circle.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      useToastStore.getState().push({ title: 'Permission needed', body: 'Allow photo access to pick an image.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    setError(null);
    try {
      const { media } = await circlesApi.uploadMedia(assetToUploadFile(result.assets[0]), couple.id);
      setUrl(media.cdnUrl);
    } catch {
      setError('Image upload failed. Please try another file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!handleValid) {
      setError('Pick a handle: 3-30 lowercase letters, numbers or underscores.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { circle } = await circlesApi.createCircle({
        handle,
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl ?? undefined,
        coverImageUrl: coverUrl ?? undefined,
        isPrivate,
      });
      pushToast({
        title: 'Your circle is live',
        body: `@${circle.handle} is ready to share.`,
        variant: 'success',
      });
      onCreated(circle);
    } catch (err) {
      setError(errMessage(err, 'Could not create your circle. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card variant="elevated" padded={false} style={{ overflow: 'hidden' }}>
      {/* Cover band with overlapping avatar */}
      <Pressable onPress={() => pickAndUpload(setCoverUrl, setUploadingCover)} disabled={uploadingCover}>
        <View style={{ height: 128, backgroundColor: colors.surfaceHover, alignItems: 'center', justifyContent: 'center' }}>
          {coverUrl ? (
            <Image source={{ uri: resolveMediaUrl(coverUrl) }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
          ) : null}
          <Row gap={6} style={{ backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <ImagePlus size={14} color="#fff" />
            <AppText style={{ fontSize: 12, fontWeight: '600' }} color="#fff">
              {uploadingCover ? 'Uploading…' : coverUrl ? 'Change cover' : 'Add cover'}
            </AppText>
          </Row>
        </View>
      </Pressable>

      <View style={{ paddingHorizontal: 20 }}>
        {/* Avatar uploader overlapping cover */}
        <Pressable
          onPress={() => pickAndUpload(setAvatarUrl, setUploadingAvatar)}
          disabled={uploadingAvatar}
          accessibilityLabel="Upload avatar"
          style={{ marginTop: -40, width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: colors.surface, overflow: 'hidden', backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}
        >
          {avatarUrl ? (
            <Image source={{ uri: resolveMediaUrl(avatarUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Camera size={24} color={colors.primary} />
          )}
        </Pressable>
      </View>

      <View style={{ padding: 20, paddingTop: 12, gap: 16 }}>
        <View>
          <AppText variant="subtitle">Create your circle</AppText>
          <AppText variant="caption" muted>
            One shared profile for the two of you.
          </AppText>
        </View>

        {/* Handle */}
        <View style={{ gap: 6 }}>
          <AppText variant="label">Handle</AppText>
          <View style={{ position: 'relative', justifyContent: 'center' }}>
            <AppText muted style={{ position: 'absolute', left: 14, zIndex: 1 }}>
              @
            </AppText>
            <TextInput
              value={handle}
              onChangeText={(t) => setHandle(sanitizeHandle(t))}
              placeholder="usandyou"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              style={{
                backgroundColor: colors.background,
                borderColor: handleTooShort ? colors.error : colors.border,
                borderWidth: 1,
                borderRadius: radius.input,
                paddingLeft: 28,
                paddingRight: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: colors.text,
              }}
            />
          </View>
          {handleTooShort ? (
            <AppText variant="caption" color={colors.error}>
              At least 3 characters
            </AppText>
          ) : (
            <AppText variant="caption" muted>
              Lowercase letters, numbers and underscores. This is your public @handle.
            </AppText>
          )}
        </View>

        <Input label="Name" value={name} onChangeText={setName} placeholder="Sam & Alex" maxLength={60} />

        <View style={{ gap: 6 }}>
          <AppText variant="label">
            Bio <AppText variant="label" muted>(optional)</AppText>
          </AppText>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="A little about the two of you…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={280}
            style={{
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.input,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: colors.text,
              minHeight: 72,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Privacy */}
        <View style={{ gap: 6 }}>
          <AppText variant="label">Privacy</AppText>
          <Row gap={8}>
            {[
              { val: false, Icon: Globe, label: 'Public' },
              { val: true, Icon: Lock, label: 'Private' },
            ].map(({ val, Icon, label }) => {
              const selected = isPrivate === val;
              return (
                <Pressable
                  key={label}
                  onPress={() => setIsPrivate(val)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primaryLight : 'transparent',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Icon size={16} color={selected ? colors.primary : colors.textMuted} />
                  <AppText weight="600" color={selected ? colors.primary : colors.textMuted}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </Row>
          <AppText variant="caption" muted>
            {isPrivate
              ? 'People send a request before they can follow and see your posts.'
              : 'Anyone can follow and see your posts.'}
          </AppText>
        </View>

        {error ? (
          <AppText variant="caption" color={colors.error}>
            {error}
          </AppText>
        ) : null}

        <Row gap={8} style={{ justifyContent: 'flex-end' }}>
          {onCancel ? <Button variant="ghost" onPress={onCancel} disabled={submitting} label="Cancel" /> : null}
          <Button
            onPress={handleSubmit}
            loading={submitting}
            disabled={!handleValid || uploadingAvatar || uploadingCover}
            label="Create circle"
          />
        </Row>
      </View>
    </Card>
  );
}
