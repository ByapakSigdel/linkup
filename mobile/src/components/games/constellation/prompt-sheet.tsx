import { useState, type JSX } from 'react';
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { AppText, Muted, Button, Card, Input, Row, Spinner, Touchable } from '@/components/ui';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useConstellationStore } from '@/stores/constellation-store';
import { useToastStore } from '@/stores/toast-store';
import { CONSTELLATIONS, promptsFor } from './deck';
import type { Prompt } from './types';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type GuessRole = 'subject' | 'guesser';

/** What the user is currently doing inside the sheet. */
type Step =
  | { kind: 'list' }
  | { kind: 'role-pick'; prompt: Prompt }
  | { kind: 'answer'; prompt: Prompt; role?: GuessRole }
  | { kind: 'custom' };

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function usePartnerName(): string {
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  if (!couple || !user) return 'your partner';
  const partnerId =
    couple.partner1Id === user.id ? couple.partner2Id : couple.partner1Id;
  // We only have the partner's id here; the display name isn't in the couple
  // object, so fall back gracefully.
  void partnerId;
  return 'your partner';
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

/** The back-button row inside the sheet. */
function BackRow({ onBack, label = 'Back' }: { onBack: () => void; label?: string }) {
  const { colors } = useTheme();
  return (
    <Touchable
      onPress={onBack}
      hitSlop={8}
      accessibilityRole="button"
      style={{ paddingBottom: 8 }}
    >
      <AppText color={colors.primary}>‹ {label}</AppText>
    </Touchable>
  );
}

/** Answer step — collects text then calls store.answer. */
function AnswerStep({
  prompt,
  role,
  onClose,
  onBack,
}: {
  prompt: Prompt;
  role?: GuessRole;
  onClose: () => void;
  onBack: () => void;
}): JSX.Element {
  const { colors } = useTheme();
  const answer = useConstellationStore((s) => s.answer);
  const toast = useToastStore.getState();
  const partnerName = usePartnerName();

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const placeholder =
    prompt.kind === 'guess'
      ? role === 'subject'
        ? 'Write your answer…'
        : `Guess ${partnerName}'s answer…`
      : 'Write your answer…';

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      let contribution: unknown;
      if (prompt.kind === 'guess') {
        contribution = { role: role ?? 'subject', text: text.trim() };
      } else {
        contribution = { text: text.trim() };
      }
      await answer({
        constellationKey: prompt.constellationKey,
        promptKey: prompt.key,
        kind: prompt.kind === 'guess' ? 'guess' : 'shared',
        title: prompt.title,
        contribution,
      });
      onClose();
    } catch {
      toast.push({ title: 'Could not save', body: 'Please try again.', variant: 'info' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <BackRow onBack={onBack} />
      <AppText variant="subtitle">{prompt.title}</AppText>
      {prompt.kind === 'guess' && role === 'guesser' && (
        <Muted variant="caption">
          Guessing {partnerName}'s answer
        </Muted>
      )}
      <Input
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        multiline
        numberOfLines={4}
        style={{ minHeight: 96, textAlignVertical: 'top' }}
        autoFocus
      />
      <Row gap={8}>
        <Button
          label="Save"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={!text.trim()}
        />
        <Button label="Cancel" variant="ghost" onPress={onBack} />
      </Row>
    </View>
  );
}

/** Role-picker step for guess prompts. */
function RolePickStep({
  prompt,
  onPick,
  onBack,
}: {
  prompt: Prompt;
  onPick: (role: GuessRole) => void;
  onBack: () => void;
}): JSX.Element {
  const partnerName = usePartnerName();
  return (
    <View style={{ gap: 12 }}>
      <BackRow onBack={onBack} />
      <AppText variant="subtitle">{prompt.title}</AppText>
      <Muted>Who are you answering for?</Muted>
      <Button label="Answer about myself" onPress={() => onPick('subject')} />
      <Button
        label={`Guess ${partnerName}'s answer`}
        variant="secondary"
        onPress={() => onPick('guesser')}
      />
    </View>
  );
}

/** Write-your-own step. */
function CustomStep({
  onClose,
  onBack,
}: {
  onClose: () => void;
  onBack: () => void;
}): JSX.Element {
  const answer = useConstellationStore((s) => s.answer);
  const toast = useToastStore.getState();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim() || !text.trim()) return;
    setSaving(true);
    try {
      await answer({
        constellationKey: 'custom',
        kind: 'custom',
        title: title.trim(),
        contribution: { text: text.trim() },
      });
      onClose();
    } catch {
      toast.push({ title: 'Could not save', body: 'Please try again.', variant: 'info' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <BackRow onBack={onBack} />
      <AppText variant="subtitle">Write your own star ✍️</AppText>
      <Input
        value={title}
        onChangeText={setTitle}
        placeholder="A short title…"
        autoFocus
      />
      <Input
        value={text}
        onChangeText={setText}
        placeholder="Your memory or moment…"
        multiline
        numberOfLines={4}
        style={{ minHeight: 96, textAlignVertical: 'top' }}
      />
      <Row gap={8}>
        <Button
          label="Save"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={!title.trim() || !text.trim()}
        />
        <Button label="Cancel" variant="ghost" onPress={onBack} />
      </Row>
    </View>
  );
}

/* ─── Deck browser (list step) ────────────────────────────────────────────── */

function DeckList({
  dailyPrompt,
  onSelectPrompt,
  onCustom,
}: {
  dailyPrompt: Prompt | null;
  onSelectPrompt: (p: Prompt) => void;
  onCustom: () => void;
}): JSX.Element {
  const { colors, radius } = useTheme();
  // Per-constellation spicy-reveal toggle.
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <View style={{ gap: 16 }}>
      {/* Daily highlight */}
      {dailyPrompt && (
        <Card variant="elevated" style={{ borderColor: colors.primary, borderWidth: 1.5 }}>
          <View style={{ gap: 8 }}>
            <Row gap={6}>
              <AppText color={colors.primary} style={{ fontSize: 14 }}>★</AppText>
              <AppText variant="caption" color={colors.primary} weight="700">
                Today's star
              </AppText>
            </Row>
            <AppText variant="subtitle">{dailyPrompt.title}</AppText>
            <Button
              label="Light this star"
              size="sm"
              onPress={() => onSelectPrompt(dailyPrompt)}
            />
          </View>
        </Card>
      )}

      {/* Constellation groups */}
      {CONSTELLATIONS.map((constellation) => {
        const prompts = promptsFor(constellation.key);
        const warmDeep = prompts.filter((p) => p.tier !== 'spicy');
        const spicy = prompts.filter((p) => p.tier === 'spicy');
        const isRevealed = !!revealed[constellation.key];

        return (
          <View key={constellation.key} style={{ gap: 8 }}>
            {/* Constellation header */}
            <View>
              <AppText variant="label" weight="700">{constellation.name}</AppText>
              <Muted variant="caption">{constellation.blurb}</Muted>
            </View>

            {/* Warm + deep prompts */}
            {warmDeep.map((p) => (
              <Touchable
                key={p.key}
                onPress={() => onSelectPrompt(p)}
                accessibilityRole="button"
              >
                <View
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: radius.card,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <AppText variant="body">{p.title}</AppText>
                  {p.tier === 'deep' && (
                    <AppText variant="caption" color={colors.secondary} style={{ marginTop: 2 }}>
                      Deep
                    </AppText>
                  )}
                </View>
              </Touchable>
            ))}

            {/* Spicy gate */}
            {spicy.length > 0 && (
              <>
                {!isRevealed ? (
                  <Touchable
                    onPress={() => setRevealed((r) => ({ ...r, [constellation.key]: true }))}
                    accessibilityRole="button"
                  >
                    <View
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: radius.card,
                        backgroundColor: colors.surfaceHover,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                      }}
                    >
                      <AppText variant="caption" muted>
                        Just Us 🔒 — tap to reveal
                      </AppText>
                    </View>
                  </Touchable>
                ) : (
                  spicy.map((p) => (
                    <Touchable
                      key={p.key}
                      onPress={() => onSelectPrompt(p)}
                      accessibilityRole="button"
                    >
                      <View
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: radius.card,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.accent,
                        }}
                      >
                        <AppText variant="body">{p.title}</AppText>
                        <AppText variant="caption" color={colors.accent} style={{ marginTop: 2 }}>
                          🔥 Spicy
                        </AppText>
                      </View>
                    </Touchable>
                  ))
                )}
              </>
            )}
          </View>
        );
      })}

      {/* Write your own */}
      <Touchable onPress={onCustom} accessibilityRole="button">
        <View
          style={{
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: radius.card,
            backgroundColor: colors.surfaceHover,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
          }}
        >
          <AppText variant="label">Write your own ✍️</AppText>
          <Muted variant="caption">Add a memory or moment of your own</Muted>
        </View>
      </Touchable>
    </View>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export function PromptSheet({
  visible,
  onClose,
  dailyPrompt,
}: {
  visible: boolean;
  onClose: () => void;
  dailyPrompt: Prompt | null;
}): JSX.Element | null {
  const { colors, radius } = useTheme();
  const [step, setStep] = useState<Step>({ kind: 'list' });

  // Reset to list whenever the sheet opens.
  function handleOpen() {
    setStep({ kind: 'list' });
  }

  function handleSelectPrompt(p: Prompt) {
    if (p.kind === 'guess') {
      setStep({ kind: 'role-pick', prompt: p });
    } else {
      setStep({ kind: 'answer', prompt: p });
    }
  }

  function handleRolePick(role: GuessRole) {
    if (step.kind === 'role-pick') {
      setStep({ kind: 'answer', prompt: step.prompt, role });
    }
  }

  function handleBack() {
    if (step.kind === 'answer' && step.role !== undefined) {
      // Came from role-pick — go back there.
      setStep({ kind: 'role-pick', prompt: step.prompt });
    } else {
      setStep({ kind: 'list' });
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={handleOpen}
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

          {/* Close button row */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingBottom: 4,
            }}
          >
            <AppText variant="subtitle">
              {step.kind === 'list' ? 'Light a Star' : ''}
            </AppText>
            <Touchable onPress={onClose} hitSlop={8} accessibilityRole="button">
              <AppText color={colors.textMuted} style={{ fontSize: 24, lineHeight: 28 }}>
                ×
              </AppText>
            </Touchable>
          </View>

          {/* Scrollable content */}
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 0, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step.kind === 'list' && (
              <DeckList
                dailyPrompt={dailyPrompt}
                onSelectPrompt={handleSelectPrompt}
                onCustom={() => setStep({ kind: 'custom' })}
              />
            )}

            {step.kind === 'role-pick' && (
              <RolePickStep
                prompt={step.prompt}
                onPick={handleRolePick}
                onBack={() => setStep({ kind: 'list' })}
              />
            )}

            {step.kind === 'answer' && (
              <AnswerStep
                prompt={step.prompt}
                role={step.role}
                onClose={onClose}
                onBack={handleBack}
              />
            )}

            {step.kind === 'custom' && (
              <CustomStep
                onClose={onClose}
                onBack={() => setStep({ kind: 'list' })}
              />
            )}
          </ScrollView>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}
