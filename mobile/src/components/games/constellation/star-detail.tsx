import { useState, type JSX } from 'react';
import { Modal, View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { AppText, Muted, Button, Card, Input, Row, Spinner, Touchable } from '@/components/ui';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useConstellationStore } from '@/stores/constellation-store';
import { useMediaStore } from '@/stores/media-store';
import { useToastStore } from '@/stores/toast-store';
import { resolveMediaUrl } from '@/lib/env';
import type { Star } from './types';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function usePartnerName(): string {
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  if (!couple || !user) return 'Partner';
  // couple object has partner1Id + partner2Id but not display names;
  // fall back gracefully — the screen calling us could pass partnerName as a
  // prop in a future improvement.
  void couple;
  return 'Partner';
}

/* ─── Answer display for shared / custom kind ──────────────────────────────── */

function SharedAnswers({
  star,
  userId,
  partnerName,
}: {
  star: Star;
  userId: string;
  partnerName: string;
}): JSX.Element {
  const { colors, radius } = useTheme();
  const patchStar = useConstellationStore((s) => s.patchStar);
  const toast = useToastStore.getState();

  // answers is Record<userId, { text: string }>
  const answers = star.answers as Record<string, { text?: string }>;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveEdit() {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await patchStar(star.id, { text: editText.trim() });
      setEditingId(null);
    } catch {
      toast.push({ title: 'Could not save', body: 'Please try again.', variant: 'info' });
    } finally {
      setSaving(false);
    }
  }

  const entries = Object.entries(answers);
  if (entries.length === 0) {
    return <Muted>No answers yet.</Muted>;
  }

  return (
    <View style={{ gap: 12 }}>
      {entries.map(([uid, val]) => {
        const isMe = uid === userId;
        const label = isMe ? 'You' : partnerName;
        const text = val?.text ?? '';
        const isEditing = editingId === uid;

        return (
          <View
            key={uid}
            style={{
              padding: 12,
              borderRadius: radius.card,
              backgroundColor: isMe ? colors.primaryLight : colors.surfaceHover,
              borderWidth: 1,
              borderColor: isMe ? colors.primary : colors.border,
              gap: 4,
            }}
          >
            <Row gap={6} style={{ justifyContent: 'space-between' }}>
              <AppText variant="label" color={isMe ? colors.primary : colors.textMuted}>
                {label}
              </AppText>
              {isMe && !isEditing && (
                <Touchable
                  onPress={() => {
                    setEditText(text);
                    setEditingId(uid);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <AppText variant="caption" color={colors.textMuted}>
                    Edit
                  </AppText>
                </Touchable>
              )}
            </Row>

            {isEditing ? (
              <View style={{ gap: 8 }}>
                <Input
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 72, textAlignVertical: 'top' }}
                  autoFocus
                />
                <Row gap={8}>
                  <Button
                    label="Save"
                    size="sm"
                    onPress={() => void saveEdit()}
                    loading={saving}
                    disabled={!editText.trim()}
                  />
                  <Button
                    label="Cancel"
                    variant="ghost"
                    size="sm"
                    onPress={() => setEditingId(null)}
                  />
                </Row>
              </View>
            ) : (
              <AppText>{text}</AppText>
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ─── Answer display for guess kind ─────────────────────────────────────────── */

function GuessAnswers({
  star,
  userId,
  partnerName,
}: {
  star: Star;
  userId: string;
  partnerName: string;
}): JSX.Element {
  const { colors, radius } = useTheme();
  const patchStar = useConstellationStore((s) => s.patchStar);
  const toast = useToastStore.getState();

  // answers shape for guess: { answer?: { text, by }, guess?: { text, by }, subjectId?: string, matched?: boolean | null }
  const ans = star.answers as {
    answer?: { text?: string; by?: string };
    guess?: { text?: string; by?: string };
    subjectId?: string;
    matched?: boolean | null;
  };

  const [judging, setJudging] = useState(false);

  async function judge(matched: boolean) {
    setJudging(true);
    try {
      await patchStar(star.id, { matched });
    } catch {
      toast.push({ title: 'Could not save', body: 'Please try again.', variant: 'info' });
    } finally {
      setJudging(false);
    }
  }

  const iAmSubject = ans.subjectId === userId;

  return (
    <View style={{ gap: 12 }}>
      {/* The answer (subject's response) */}
      {ans.answer && (
        <View
          style={{
            padding: 12,
            borderRadius: radius.card,
            backgroundColor: iAmSubject ? colors.primaryLight : colors.surfaceHover,
            borderWidth: 1,
            borderColor: iAmSubject ? colors.primary : colors.border,
            gap: 4,
          }}
        >
          <AppText
            variant="label"
            color={iAmSubject ? colors.primary : colors.textMuted}
          >
            {iAmSubject ? 'Your answer' : `${partnerName}'s answer`}
          </AppText>
          <AppText>{ans.answer.text ?? ''}</AppText>
        </View>
      )}

      {/* The guess — labelled by who actually wrote it (guess.by). */}
      {ans.guess &&
        (() => {
          const guessIsMine = ans.guess?.by === userId;
          return (
            <View
              style={{
                padding: 12,
                borderRadius: radius.card,
                backgroundColor: guessIsMine ? colors.primaryLight : colors.surfaceHover,
                borderWidth: 1,
                borderColor: guessIsMine ? colors.primary : colors.border,
                gap: 4,
              }}
            >
              <AppText
                variant="label"
                color={guessIsMine ? colors.primary : colors.textMuted}
              >
                {guessIsMine ? 'Your guess' : `${partnerName}'s guess`}
              </AppText>
              <AppText>{ans.guess.text ?? ''}</AppText>
            </View>
          );
        })()}

      {/* Self-judge: show only if I am the subject AND a guess exists AND not yet judged */}
      {iAmSubject && ans.guess && ans.matched == null && (
        <Card variant="bordered">
          <View style={{ gap: 8 }}>
            <AppText variant="label">Did they nail it?</AppText>
            {judging ? (
              <Spinner size="small" />
            ) : (
              <Row gap={8}>
                <Button
                  label="Nailed it ✓"
                  size="sm"
                  onPress={() => void judge(true)}
                />
                <Button
                  label="So close"
                  variant="secondary"
                  size="sm"
                  onPress={() => void judge(false)}
                />
              </Row>
            )}
          </View>
        </Card>
      )}

      {/* Matched indicator if already judged */}
      {ans.matched != null && (
        <Muted variant="caption" style={{ fontStyle: 'italic' }}>
          {ans.matched ? '✓ matched' : 'missed'}
        </Muted>
      )}
    </View>
  );
}

/* ─── Photo section ──────────────────────────────────────────────────────── */

function PhotoSection({ star }: { star: Star }): JSX.Element {
  const { colors, radius } = useTheme();
  const couple = useAuthStore((s) => s.couple);
  const uploadFile = useMediaStore((s) => s.uploadFile);
  const patchStar = useConstellationStore((s) => s.patchStar);
  const toast = useToastStore.getState();

  const [busy, setBusy] = useState(false);

  async function addPhoto() {
    if (!couple?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setBusy(true);
    try {
      const media = await uploadFile(couple.id, {
        uri: a.uri,
        name: a.fileName || 'star.jpg',
        type: a.mimeType || 'image/jpeg',
      });
      if (media?.cdnUrl) await patchStar(star.id, { photoUrl: media.cdnUrl });
    } catch {
      toast.push({ title: 'Upload failed', body: 'Please try again.', variant: 'info' });
    } finally {
      setBusy(false);
    }
  }

  const resolvedUrl = resolveMediaUrl(star.photoUrl);

  return (
    <View style={{ gap: 10 }}>
      {resolvedUrl ? (
        <Image
          source={{ uri: resolvedUrl }}
          style={{
            width: '100%',
            height: 220,
            borderRadius: radius.card,
            backgroundColor: colors.surfaceHover,
          }}
          contentFit="cover"
        />
      ) : null}

      <Button
        label={busy ? 'Uploading…' : star.photoUrl ? 'Change photo' : 'Add a photo'}
        variant="outline"
        size="sm"
        loading={busy}
        onPress={() => void addPhoto()}
      />
    </View>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export function StarDetail({
  star,
  onClose,
}: {
  star: Star;
  onClose: () => void;
}): JSX.Element {
  const { colors, radius } = useTheme();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const partnerName = usePartnerName();

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
        onPress={onClose}
      />

      {/* Panel */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '88%',
        }}
      >
        <Card
          variant="elevated"
          style={{
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderTopLeftRadius: radius.card * 2,
            borderTopRightRadius: radius.card * 2,
          }}
          padded={false}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingBottom: 4,
            }}
          >
            <AppText variant="subtitle" style={{ flex: 1, marginRight: 8 }}>
              {star.title}
            </AppText>
            <Touchable onPress={onClose} hitSlop={8} accessibilityRole="button">
              <AppText color={colors.textMuted} style={{ fontSize: 24, lineHeight: 28 }}>
                ×
              </AppText>
            </Touchable>
          </View>

          {/* Kind chip */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <AppText variant="caption" color={colors.textMuted} style={{ textTransform: 'capitalize' }}>
              {star.kind === 'guess' ? 'Guess the answer' : star.kind === 'custom' ? 'Your story' : 'Shared memory'}
            </AppText>
          </View>

          {/* Scrollable content */}
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Answers section */}
            {star.kind === 'guess' ? (
              <GuessAnswers star={star} userId={userId} partnerName={partnerName} />
            ) : (
              <SharedAnswers star={star} userId={userId} partnerName={partnerName} />
            )}

            {/* Photo section */}
            <PhotoSection star={star} />
          </ScrollView>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}
