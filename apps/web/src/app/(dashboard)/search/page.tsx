'use client';

import { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { Input, Spinner } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
import api from '@/lib/api';
import {
  SearchResultsView,
  searchTotalCount,
  EMPTY_RESULTS,
  type SearchResults,
} from '@/components/search/search-results';
import {
  SearchFilters,
  type SearchType,
} from '@/components/search/search-filters';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<SearchType>('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the search input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce the query (~300ms).
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Run the search whenever the debounced query or the type filter changes.
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
        const { data } = await api.get('/search', {
          params: {
            q: debouncedQuery,
            ...(type ? { type } : {}),
            limit: 20,
          },
        });
        if (cancelled) return;
        const payload = data.data;
        const nextResults: SearchResults = {
          messages: payload?.results?.messages ?? [],
          media: payload?.results?.media ?? [],
          dates: payload?.results?.dates ?? [],
          emojis: payload?.results?.emojis ?? [],
          playlists: payload?.results?.playlists ?? [],
        };
        setResults(nextResults);
        setTotal(payload?.total ?? searchTotalCount(nextResults));
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
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Explore
        </p>
        <h1 className="font-display text-2xl font-bold text-text">Search</h1>
        <p className="text-text-muted">
          Find anything across your shared world
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages, photos, dates, emojis, playlists…"
          inputStyle="filled"
          size="lg"
          className="rounded-2xl pl-11 pr-11"
          aria-label="Search"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted transition-colors hover:bg-surface-active hover:text-text"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type filter chips */}
      <SearchFilters active={type} onChange={setType} />

      {/* Total count */}
      {showResults && (
        <p className="text-sm text-text-muted">
          <span className="font-mono">{totalCount}</span> result
          {totalCount !== 1 ? 's' : ''} for{' '}
          <span className="font-medium text-text">
            &ldquo;{debouncedQuery}&rdquo;
          </span>
        </p>
      )}

      {/* States */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {showResults && <SearchResultsView results={results} />}

      {showNoResults && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-active">
            <SearchIcon className="h-7 w-7 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text">No results</h2>
          <p className="max-w-sm text-sm text-text-muted">
            We couldn&apos;t find anything matching &ldquo;{debouncedQuery}&rdquo;.
            Try a different word or remove the filter.
          </p>
        </div>
      )}

      {showEmptyPrompt && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <LinkupMark size={56} className="opacity-90" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-text">
              Search your universe
            </h2>
            <p className="max-w-sm text-sm text-text-muted">
              Search across your messages, photos, dates and more.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
