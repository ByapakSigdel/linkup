import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Search as SearchIcon,
  X,
  MessageCircle,
  Image as ImageIcon,
  Calendar,
  Smile,
  Music,
} from 'lucide-react-native';

import {
  Screen,
  AppText,
  Muted,
  Card,
  Spinner,
  Row,
  Touchable,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { LinkupMark } from '@/components/brand-mark';
import { useTheme } from '@/theme';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/env';

/* ─── Types (ported from web search-results) ──────────────────────────────── */
interface MessageResult {
  id: string;
  content: string;
  createdAt: string;
  type: 'message';
}
interface MediaResult {
  id: string;
  caption: string | null;
  cdnUrl: string;
  mediaType: string;
  type: 'media';
}
interface DateResult {
  id: string;
  title: string;
  date: string;
  type: 'date';
}
interface EmojiResult {
  id: string;
  name: string;
  imageUrl: string;
  type: 'emoji';
}
interface PlaylistResult {
  id: string;
  name: string;
  type: 'playlist';
}
interface SearchResults {
  messages: MessageResult[];
  media: MediaResult[];
  dates: DateResult[];
  emojis: EmojiResult[];
  playlists: PlaylistResult[];
}

const EMPTY_RESULTS: SearchResults = {
  messages: [],
  media: [],
  dates: [],
  emojis: [],
  playlists: [],
};

function searchTotalCount(r: SearchResults): number {
  return (
    r.messages.length +
    r.media.length +
    r.dates.length +
    r.emojis.length +
    r.playlists.length
  );
}

type SearchType = '' | 'messages' | 'media' | 'dates' | 'emojis' | 'playlists';

const SEARCH_FILTERS: { value: SearchType; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'messages', label: 'Messages' },
  { value: 'media', label: 'Media' },
  { value: 'dates', label: 'Dates' },
  { value: 'emojis', label: 'Emojis' },
  { value: 'playlists', label: 'Playlists' },
];

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SearchScreen() {
  const { colors, radius } = useTheme();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<SearchType>('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<TextInput>(null);

  // Autofocus on mount.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  // Debounce the query (~300ms).
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Run the search when debounced query or type filter changes.
  useEffect(() => {
    if (!debouncedQuery) {
      setResults(EMPTY_RESULTS);
      setTotal(0);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const res = await api.get('/search', {
          params: {
            q: debouncedQuery,
            ...(type ? { type } : {}),
            limit: 20,
          },
        });
        if (cancelled) return;
        const payload = res.data.data;
        const next: SearchResults = {
          messages: payload?.results?.messages ?? [],
          media: payload?.results?.media ?? [],
          dates: payload?.results?.dates ?? [],
          emojis: payload?.results?.emojis ?? [],
          playlists: payload?.results?.playlists ?? [],
        };
        setResults(next);
        setTotal(payload?.total ?? searchTotalCount(next));
        setHasSearched(true);
      } catch {
        if (cancelled) return;
        setResults(EMPTY_RESULTS);
        setTotal(0);
        setHasSearched(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, type]);

  const totalCount = total || searchTotalCount(results);
  const showResults = hasSearched && !isLoading && totalCount > 0;
  const showNoResults =
    hasSearched && !isLoading && totalCount === 0 && !!debouncedQuery;
  const showEmptyPrompt = !debouncedQuery && !isLoading;

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenHeader title="Search" subtitle="Find anything across your shared world" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceHover,
            borderRadius: 16,
            paddingHorizontal: 14,
          }}
        >
          <SearchIcon color={colors.textMuted} size={20} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search messages, photos, dates, emojis…"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              paddingVertical: 14,
              paddingHorizontal: 10,
              fontSize: 16,
              color: colors.text,
            }}
          />
          {query ? (
            <Touchable
              onPress={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X color={colors.textMuted} size={18} />
            </Touchable>
          ) : null}
        </View>

        {/* Type filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          {SEARCH_FILTERS.map((f) => {
            const isActive = type === f.value;
            return (
              <Pressable
                key={f.value || 'all'}
                onPress={() => setType(f.value)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: isActive
                    ? colors.primary
                    : colors.surfaceHover,
                }}
              >
                <AppText
                  variant="caption"
                  weight="700"
                  color={isActive ? colors.textOnPrimary : colors.textMuted}
                >
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Total count */}
        {showResults && (
          <Muted variant="caption">
            {totalCount} result{totalCount !== 1 ? 's' : ''} for{' '}
            <AppText variant="caption" color={colors.text} weight="700">
              &ldquo;{debouncedQuery}&rdquo;
            </AppText>
          </Muted>
        )}

        {/* Loading */}
        {isLoading && (
          <View style={{ paddingVertical: 64, alignItems: 'center' }}>
            <Spinner />
          </View>
        )}

        {/* Results */}
        {showResults && <SearchResultsView results={results} />}

        {/* No results */}
        {showNoResults && (
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 64 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.surfaceActive,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SearchIcon color={colors.textMuted} size={28} />
            </View>
            <AppText variant="subtitle" center>
              No results
            </AppText>
            <Muted center style={{ maxWidth: 320 }}>
              We couldn&apos;t find anything matching &ldquo;{debouncedQuery}
              &rdquo;. Try a different word or remove the filter.
            </Muted>
          </View>
        )}

        {/* Empty prompt */}
        {showEmptyPrompt && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={{ alignItems: 'center', gap: 16, paddingVertical: 56 }}
          >
            <LinkupMark size={56} />
            <View style={{ gap: 4, alignItems: 'center' }}>
              <AppText variant="subtitle" center>
                Search your universe
              </AppText>
              <Muted center style={{ maxWidth: 320 }}>
                Search across your messages, photos, dates and more.
              </Muted>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ─── Results view ─────────────────────────────────────────────────────────── */
function GroupHeader({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  const { colors } = useTheme();
  return (
    <Row gap={8} style={{ paddingHorizontal: 2 }}>
      {icon}
      <AppText variant="label">{label}</AppText>
      <View
        style={{
          borderRadius: 999,
          backgroundColor: colors.surfaceHover,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
      >
        <AppText variant="caption" muted weight="700">
          {count}
        </AppText>
      </View>
    </Row>
  );
}

function ResultRow({
  icon,
  iconBg,
  onPress,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { radius } = useTheme();
  return (
    <Touchable onPress={onPress}>
      <Card padded={false} style={{ padding: 10 }}>
        <Row gap={12}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.button,
              backgroundColor: iconBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
        </Row>
      </Card>
    </Touchable>
  );
}

function SearchResultsView({ results }: { results: SearchResults }) {
  const { colors, radius } = useTheme();

  return (
    <View style={{ gap: 28 }}>
      {/* Messages */}
      {results.messages.length > 0 && (
        <View style={{ gap: 10 }}>
          <GroupHeader
            icon={<MessageCircle color={colors.accent} size={16} />}
            label="Messages"
            count={results.messages.length}
          />
          <View style={{ gap: 8 }}>
            {results.messages.map((m) => (
              <ResultRow
                key={m.id}
                icon={<MessageCircle color={colors.primary} size={16} />}
                iconBg={colors.primaryLight}
                onPress={() => router.push('/chat')}
              >
                <AppText variant="body" numberOfLines={1}>
                  {m.content}
                </AppText>
                <Muted variant="caption">{formatDate(m.createdAt)}</Muted>
              </ResultRow>
            ))}
          </View>
        </View>
      )}

      {/* Media */}
      {results.media.length > 0 && (
        <View style={{ gap: 10 }}>
          <GroupHeader
            icon={<ImageIcon color={colors.accent} size={16} />}
            label="Media"
            count={results.media.length}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {results.media.map((item) => (
              <Touchable
                key={item.id}
                onPress={() => router.push('/gallery')}
                style={{ width: '31%' }}
              >
                <View
                  style={{
                    borderRadius: radius.card,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceHover,
                  }}
                >
                  <Image
                    source={{ uri: resolveMediaUrl(item.cdnUrl) }}
                    style={{ width: '100%', aspectRatio: 1 }}
                    resizeMode="cover"
                  />
                  {item.caption ? (
                    <Muted
                      variant="caption"
                      numberOfLines={1}
                      style={{ paddingHorizontal: 6, paddingVertical: 5 }}
                    >
                      {item.caption}
                    </Muted>
                  ) : null}
                </View>
              </Touchable>
            ))}
          </View>
        </View>
      )}

      {/* Dates */}
      {results.dates.length > 0 && (
        <View style={{ gap: 10 }}>
          <GroupHeader
            icon={<Calendar color={colors.accent} size={16} />}
            label="Dates"
            count={results.dates.length}
          />
          <View style={{ gap: 8 }}>
            {results.dates.map((d) => (
              <ResultRow
                key={d.id}
                icon={<Calendar color={colors.secondary} size={16} />}
                iconBg={colors.primaryLight}
                onPress={() => router.push('/dashboard')}
              >
                <AppText variant="label" numberOfLines={1}>
                  {d.title}
                </AppText>
                <Muted variant="caption">{formatDate(d.date)}</Muted>
              </ResultRow>
            ))}
          </View>
        </View>
      )}

      {/* Emojis */}
      {results.emojis.length > 0 && (
        <View style={{ gap: 10 }}>
          <GroupHeader
            icon={<Smile color={colors.accent} size={16} />}
            label="Emojis"
            count={results.emojis.length}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {results.emojis.map((e) => (
              <Touchable
                key={e.id}
                onPress={() => router.push('/emojis')}
                style={{ width: '22%' }}
              >
                <Card padded={false} style={{ padding: 8, alignItems: 'center', gap: 6 }}>
                  <Image
                    source={{ uri: resolveMediaUrl(e.imageUrl) }}
                    style={{ width: 44, height: 44 }}
                    resizeMode="contain"
                  />
                  <Muted variant="caption" numberOfLines={1} style={{ width: '100%', textAlign: 'center' }}>
                    {e.name}
                  </Muted>
                </Card>
              </Touchable>
            ))}
          </View>
        </View>
      )}

      {/* Playlists */}
      {results.playlists.length > 0 && (
        <View style={{ gap: 10 }}>
          <GroupHeader
            icon={<Music color={colors.accent} size={16} />}
            label="Playlists"
            count={results.playlists.length}
          />
          <View style={{ gap: 8 }}>
            {results.playlists.map((p) => (
              <ResultRow
                key={p.id}
                icon={<Music color={colors.accent} size={16} />}
                iconBg={colors.primaryLight}
                onPress={() => router.push('/music')}
              >
                <AppText variant="label" numberOfLines={1}>
                  {p.name}
                </AppText>
              </ResultRow>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
