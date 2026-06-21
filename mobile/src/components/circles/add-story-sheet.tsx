// AddStorySheet — a bottom-sheet modal for adding a 24h story to MY circle.
// Ported from apps/web/src/components/circles/add-story-sheet.tsx. Pick an image
// -> preview -> optional caption -> upload via /media/upload -> POST
// /circles/me/stories. On success calls onAdded(story) to refresh the tray.

import { useEffect, useState } from 'react';
import { View, Modal, Pressable, Image, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { X, ImagePlus, Send } from 'lucide-react-native';
import { AppText, Button, Spinner } from '@/components/ui';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import * as circlesApi from '@/lib/circles-api';
import { assetToUploadFile, errMessage } from './helpers';
import type { Story } from './types';

interface AddStorySheetProps {
  open: boolean;
  onClose: () => void;
  onAdded?: (story: Story) => void;
}

export function AddStorySheet({ open, onClose, onAdded }: AddStorySheetProps) {
  const { colors, radius } = useTheme();
  const couple = useAuthStore((s) => s.couple);

  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setAsset(null);
      setCaption('');
      setSubmitting(false);
    }
  }, [open]);

  const pickFile = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      useToastStore.getState().push({
        title: 'Permission needed',
        body: 'Allow photo access to add a story.',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setAsset(result.assets[0]);
    }
  };

  const handleShare = async () => {
    if (!asset || submitting) return;
    if (!couple?.id) {
      useToastStore.getState().push({
        title: 'No couple linked',
        body: 'You need a linked couple to post a story.',
      });
      return;
    }
    setSubmitting(true);
    try {
      const { media } = await circlesApi.uploadMedia(assetToUploadFile(asset), couple.id);
      const { story } = await circlesApi.addStory({
        mediaUrl: media.cdnUrl,
        mediaType: 'image',
        caption: caption.trim() || undefined,
      });
      useToastStore.getState().push({
        title: 'Story added',
        body: 'Your story is live for the next 24 hours.',
        variant: 'success',
      });
      onAdded?.(story);
      onClose();
    } catch (err) {
      useToastStore.getState().push({
        title: 'Could not add story',
        body: errMessage(err, 'Something went wrong. Please try again.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => !submitting && onClose()}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => !submitting && onClose()}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}
        />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: '90%',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <AppText variant="subtitle">Add to your story</AppText>
            <Pressable onPress={() => !submitting && onClose()} disabled={submitting} accessibilityLabel="Close">
              <X size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Body */}
          <View style={{ padding: 16, gap: 16 }}>
            {asset ? (
              <View style={{ gap: 16 }}>
                <View
                  style={{
                    alignSelf: 'center',
                    width: 220,
                    aspectRatio: 9 / 16,
                    borderRadius: 16,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  }}
                >
                  <Image source={{ uri: asset.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {caption.trim() ? (
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: 12,
                        backgroundColor: 'rgba(0,0,0,0.45)',
                      }}
                    >
                      <AppText center weight="600" color="#fff" style={{ fontSize: 14 }}>
                        {caption.trim()}
                      </AppText>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => !submitting && setAsset(null)}
                    accessibilityLabel="Remove image"
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={16} color="#fff" />
                  </Pressable>
                </View>

                <View>
                  <AppText variant="caption" muted weight="600" style={{ marginBottom: 6 }}>
                    Caption (optional)
                  </AppText>
                  <TextInput
                    value={caption}
                    onChangeText={setCaption}
                    placeholder="Say something..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={300}
                    editable={!submitting}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.input,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 14,
                      color: colors.text,
                      minHeight: 56,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                <Pressable onPress={pickFile} disabled={submitting}>
                  <AppText variant="caption" weight="600" color={colors.primary}>
                    Choose a different photo
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={pickFile}
                style={{
                  alignSelf: 'center',
                  width: 220,
                  aspectRatio: 9 / 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: 12,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.primaryLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ImagePlus size={26} color={colors.primary} />
                </View>
                <AppText variant="label">Choose a photo</AppText>
                <AppText variant="caption" muted center>
                  Shared with your followers for 24 hours ✨
                </AppText>
              </Pressable>
            )}
          </View>

          {/* Footer */}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Button onPress={handleShare} loading={submitting} disabled={!asset || submitting} fullWidth>
              {submitting ? (
                <>
                  <Spinner size="small" color={colors.textOnPrimary} />
                  <AppText weight="700" color={colors.textOnPrimary}>Sharing...</AppText>
                </>
              ) : (
                <>
                  <Send size={16} color={colors.textOnPrimary} />
                  <AppText weight="700" color={colors.textOnPrimary}>Share to story</AppText>
                </>
              )}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
