import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { docSearchIndex, type SearchEntry } from './docSearchIndex';

const HIGHLIGHT_CLASS = 'doc-search-highlight';

function scoreEntry(entry: SearchEntry, q: string): number {
  const query = q.toLowerCase();
  let score = 0;
  if (entry.title.toLowerCase().includes(query)) score += 10;
  if (entry.section.toLowerCase().includes(query)) score += 3;
  for (const k of entry.keywords) {
    if (k.toLowerCase().includes(query)) score += 5;
  }
  if (entry.snippet.toLowerCase().includes(query)) score += 2;
  return score;
}

export function DocSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return docSearchIndex
      .map((e) => ({ entry: e, score: scoreEntry(e, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((r) => r.entry);
  }, [query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: cmd/ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goTo = (id: string) => {
    setOpen(false);
    setQuery('');
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add(HIGHLIGHT_CLASS);
    setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 1800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) goTo(r.id);
    }
  };

  const askAi = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { prompt: query } }));
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Cerca nella guida... (⌘K)"
          className="pl-9 pr-9 h-11"
        />
        {query && (
          <button
            type="button"
            aria-label="Cancella ricerca"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-lg border bg-popover shadow-lg z-50 overflow-hidden">
          {results.length > 0 ? (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => goTo(r.id)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${
                      i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{r.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{r.section}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.snippet}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-sm">
              <p className="text-muted-foreground mb-3">Nessun risultato per "{query}"</p>
              <Button size="sm" variant="outline" onClick={askAi} className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Chiedi all'assistente AI
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
