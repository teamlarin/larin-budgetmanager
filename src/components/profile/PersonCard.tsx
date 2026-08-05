import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, Save, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TagListEditor } from '@/components/profile/TagListEditor';
import { LanguagesEditor, type LanguageEntry } from '@/components/profile/LanguagesEditor';

interface HrPublicData {
  data_nascita: string | null;
  indirizzo_residenza: string | null;
  data_inizio_collaborazione: string | null;
  data_inizio: string | null;
  sesso: string | null;
  job_title: string | null;
  team: string | null;
}

const fmtDate = (value: string | null) => {
  if (!value) return null;
  try {
    return format(parseISO(value), 'dd.MM.yyyy');
  } catch {
    return value;
  }
};

const parseLanguages = (raw: unknown): LanguageEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({ language: String(e.language ?? ''), level: String(e.level ?? '') }))
    .filter((e) => e.language);
};

export function PersonCard({ userId }: { userId: string | null }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [hr, setHr] = useState<HrPublicData | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [profileRes, hrRes] = await Promise.all([
        supabase.from('profiles').select('bio, skills, interests, languages').eq('id', userId).maybeSingle(),
        supabase.rpc('get_profiles_hr_public', { _user_ids: [userId] }),
      ]);

      if (cancelled) return;

      if (profileRes.error) {
        console.error('Error loading person card', profileRes.error);
      } else if (profileRes.data) {
        setBio(profileRes.data.bio || '');
        setSkills(profileRes.data.skills || []);
        setInterests(profileRes.data.interests || []);
        setLanguages(parseLanguages(profileRes.data.languages));
      }

      if (hrRes.error) {
        console.warn('get_profiles_hr_public failed', hrRes.error);
      } else {
        const row = (hrRes.data as HrPublicData[] | null)?.[0] || null;
        setHr(row);
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        bio: bio.trim() ? bio : null,
        skills,
        interests,
        languages: languages as unknown as never,
      })
      .eq('id', userId);
    setSaving(false);

    if (error) {
      console.error('Error saving person card', error);
      toast({ title: 'Errore', description: 'Impossibile salvare la scheda persona', variant: 'destructive' });
      return;
    }
    toast({ title: 'Scheda aggiornata', description: 'Le informazioni del profilo sono state salvate' });
  };

  const hrRows = [
    { label: 'Data di nascita', value: fmtDate(hr?.data_nascita ?? null) },
    { label: 'Indirizzo di residenza', value: hr?.indirizzo_residenza || null },
    {
      label: 'Inizio contratto',
      value: fmtDate(hr?.data_inizio_collaborazione ?? hr?.data_inizio ?? null),
    },
    { label: 'Ruolo', value: hr?.job_title || null },
    { label: 'Team', value: hr?.team || null },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheda persona</CardTitle>
        <CardDescription>
          Le informazioni visibili agli altri utenti di TimeTrap. I dati anagrafici e contrattuali arrivano dalla
          scheda HR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-20 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            {/* HR data (read-only) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Dati anagrafici e contratto</h3>
                <Badge variant="outline" className="gap-1">
                  <Building2 className="h-3 w-3" />
                  Da HR
                </Badge>
              </div>
              {hr ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {hrRows.map((row) => (
                    <div key={row.label} className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      <p className="text-sm font-medium">{row.value || '—'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  La tua scheda HR non è ancora collegata al tuo account TimeTrap: chiedi ad HR (Impostazioni → HR) di
                  associarla per vedere data di nascita, residenza e inizio contratto.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Questi campi sono in sola lettura: per correzioni scrivi ad HR.
              </p>
            </div>

            <Separator />

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio breve</Label>
              <Textarea
                id="bio"
                value={bio}
                rows={5}
                placeholder="Racconta in poche righe chi sei e di cosa ti occupi"
                onChange={(e) => setBio(e.target.value)}
                className="whitespace-pre-wrap"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Skills</Label>
                <TagListEditor
                  value={skills}
                  onChange={setSkills}
                  placeholder="Aggiungi una competenza"
                  emptyLabel="Nessuna competenza inserita"
                />
              </div>
              <div className="space-y-2">
                <Label>Interessi</Label>
                <TagListEditor
                  value={interests}
                  onChange={setInterests}
                  placeholder="Aggiungi un interesse"
                  emptyLabel="Nessun interesse inserito"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lingue</Label>
              <LanguagesEditor value={languages} onChange={setLanguages} />
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salva scheda
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
