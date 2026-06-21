import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Check, Eye, EyeOff } from 'lucide-react-native';

import { AuthBanner, AuthShell } from '@/components/auth-shell';
import { AppText, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { apiErrorMessage } from '@/lib/api';
import { useTheme } from '@/theme';

interface FieldErrors {
  email?: string;
  username?: string;
  displayName?: string;
  password?: string;
  confirmPassword?: string;
  dateOfBirth?: string;
}

type PasswordStrength = 'weak' | 'medium' | 'strong';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'weak';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

// Mirror registerSchema from @linkup/validation.
function validate(input: {
  email: string;
  username: string;
  displayName: string;
  password: string;
  dateOfBirth: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL_RE.test(input.email)) errors.email = 'Invalid email address';

  if (input.username.length < 3) errors.username = 'Username must be at least 3 characters';
  else if (input.username.length > 30) errors.username = 'Username must be at most 30 characters';
  else if (!/^[a-zA-Z0-9_]+$/.test(input.username))
    errors.username = 'Username can only contain letters, numbers, and underscores';

  if (input.displayName.length < 1) errors.displayName = 'Display name is required';
  else if (input.displayName.length > 50)
    errors.displayName = 'Display name must be at most 50 characters';

  if (input.password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (!/[A-Z]/.test(input.password))
    errors.password = 'Password must contain at least one uppercase letter';
  else if (!/[a-z]/.test(input.password))
    errors.password = 'Password must contain at least one lowercase letter';
  else if (!/[0-9]/.test(input.password))
    errors.password = 'Password must contain at least one number';

  if (input.dateOfBirth && !DOB_RE.test(input.dateOfBirth))
    errors.dateOfBirth = 'Use the format YYYY-MM-DD';

  return errors;
}

export default function RegisterScreen() {
  const { colors, radius } = useTheme();
  const { register, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const strengthInfo: Record<PasswordStrength, { label: string; color: string; fraction: number }> = {
    weak: { label: 'Weak', color: colors.error, fraction: 1 / 3 },
    medium: { label: 'Medium', color: colors.warning, fraction: 2 / 3 },
    strong: { label: 'Strong', color: colors.success, fraction: 1 },
  };
  const strength = strengthInfo[passwordStrength];

  async function handleSubmit() {
    setFieldErrors({});
    setApiError('');

    const errors = validate({ email, username, displayName, password, dateOfBirth });
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

    if (!agreedToTerms) {
      setApiError('You must agree to the Terms of Service to continue.');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!agreedToTerms) return;

    try {
      await register({
        email,
        username,
        displayName,
        password,
        ...(dateOfBirth ? { dateOfBirth } : {}),
      });
      router.replace('/(tabs)/dashboard');
    } catch (err) {
      setApiError(apiErrorMessage(err, 'Registration failed. Please try again.'));
    }
  }

  return (
    <AuthShell
      eyebrow="new sky"
      title="Find your other star"
      description="Create your account, then link up with the one you orbit."
    >
      <View style={{ gap: 16 }}>
        {apiError ? <AuthBanner kind="error" message={apiError} /> : null}

        <Input
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          editable={!isLoading}
        />

        <View>
          <Input
            label="Username"
            placeholder="your_username"
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChangeText={setUsername}
            error={fieldErrors.username}
            editable={!isLoading}
          />
          {!fieldErrors.username ? (
            <AppText muted style={{ marginTop: 4, fontSize: 12 }}>
              3-30 characters, letters, numbers, and underscores only
            </AppText>
          ) : null}
        </View>

        <Input
          label="Display Name"
          placeholder="Your Name"
          autoComplete="name"
          value={displayName}
          onChangeText={setDisplayName}
          error={fieldErrors.displayName}
          editable={!isLoading}
        />

        {/* Password */}
        <View>
          <View>
            <Input
              label="Password"
              placeholder="Create a password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              editable={!isLoading}
              style={{ paddingRight: 44 }}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={10}
              style={{ position: 'absolute', right: 12, top: 34 }}
            >
              {showPassword ? (
                <EyeOff color={colors.textMuted} size={18} />
              ) : (
                <Eye color={colors.textMuted} size={18} />
              )}
            </Pressable>
          </View>

          {password.length > 0 ? (
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.surfaceHover,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${strength.fraction * 100}%`,
                    borderRadius: 3,
                    backgroundColor: strength.color,
                  }}
                />
              </View>
              <AppText style={{ fontSize: 12, fontWeight: '600', color: strength.color }}>
                {strength.label}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Confirm Password */}
        <View>
          <Input
            label="Confirm Password"
            placeholder="Re-enter your password"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={fieldErrors.confirmPassword}
            editable={!isLoading}
            style={{ paddingRight: 44 }}
          />
          <Pressable
            onPress={() => setShowConfirmPassword((v) => !v)}
            hitSlop={10}
            style={{ position: 'absolute', right: 12, top: 34 }}
          >
            {showConfirmPassword ? (
              <EyeOff color={colors.textMuted} size={18} />
            ) : (
              <Eye color={colors.textMuted} size={18} />
            )}
          </Pressable>
        </View>

        {/* Optional date of birth */}
        <Input
          label="Date of Birth (optional)"
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          error={fieldErrors.dateOfBirth}
          editable={!isLoading}
        />

        {/* Terms checkbox */}
        <Pressable
          onPress={() => setAgreedToTerms((v) => !v)}
          disabled={isLoading}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
        >
          <View
            style={{
              marginTop: 2,
              width: 18,
              height: 18,
              borderRadius: 5,
              borderWidth: 1,
              borderColor: agreedToTerms ? colors.primary : colors.border,
              backgroundColor: agreedToTerms ? colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {agreedToTerms ? <Check color={colors.textOnPrimary} size={13} /> : null}
          </View>
          <AppText muted style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>
            I agree to the{' '}
            <AppText color={colors.primary} style={{ fontSize: 13 }}>
              Terms of Service
            </AppText>{' '}
            and{' '}
            <AppText color={colors.primary} style={{ fontSize: 13 }}>
              Privacy Policy
            </AppText>
          </AppText>
        </Pressable>

        <Button
          label="Create Account"
          size="lg"
          fullWidth
          loading={isLoading}
          onPress={handleSubmit}
          style={{ marginTop: 4, borderRadius: radius.button }}
        />
      </View>

      <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
        <AppText muted style={{ fontSize: 13 }}>
          Already have an account?
        </AppText>
        <Pressable onPress={() => router.push('/(auth)/login')}>
          <AppText color={colors.primary} style={{ fontSize: 13, fontWeight: '600' }}>
            Log in
          </AppText>
        </Pressable>
      </View>
    </AuthShell>
  );
}
