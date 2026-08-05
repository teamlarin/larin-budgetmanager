import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface LanguageEntry {
  language: string;
  level: string;
}

export const LANGUAGE_LEVELS = ['Native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'];

interface LanguagesEditorProps {
  value: LanguageEntry[];
  onChange: (next: LanguageEntry[]) => void;
}

export function LanguagesEditor({ value, onChange }: LanguagesEditorProps) {
  const [language, setLanguage] = useState('');
  const [level, setLevel] = useState('B1');

  const addLanguage = () => {
    const name = language.trim();
    if (!name) return;
    if (value.some((v) => v.language.toLowerCase() === name.toLowerCase())) {
      setLanguage('');
      return;
    }
    onChange([...value, { language: name, level }]);
    setLanguage('');
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && <p className="text-sm text-muted-foreground">Nessuna lingua inserita</p>}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((entry, index) => (
            <div key={`${entry.language}-${index}`} className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium">{entry.language}</span>
              <Select
                value={entry.level}
                onValueChange={(next) =>
                  onChange(value.map((v, i) => (i === index ? { ...v, level: next } : v)))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Rimuovi ${entry.language}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={language}
          placeholder="Lingua (es. Italiano)"
          onChange={(e) => setLanguage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addLanguage();
            }
          }}
        />
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={addLanguage} disabled={!language.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
