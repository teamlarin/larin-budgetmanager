import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Bug, Wrench, Zap, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { markChangelogAsSeen } from '@/hooks/useUnreadChangelog';

const categoryConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  feature: { label: 'Novità', variant: 'default', icon: Sparkles },
  improvement: { label: 'Miglioramento', variant: 'secondary', icon: Zap },
  bugfix: { label: 'Correzione', variant: 'destructive', icon: Bug },
  maintenance: { label: 'Manutenzione', variant: 'outline', icon: Wrench },
};

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  version: string | null;
  created_at: string;
}

function MonthGroup({ month, entries, defaultOpen }: { month: string; entries: ChangelogEntry[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const monthLabel = format(new Date(month + '-01'), 'MMMM yyyy', { locale: it });
  const labelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full group flex items-center justify-between gap-3 px-4 py-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="font-semibold text-base">{labelCapitalized}</span>
          <Badge variant="outline" className="text-xs">{entries.length}</Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 pt-3 pl-2">
          {entries.map((entry) => {
            const config = categoryConfig[entry.category] || categoryConfig.feature;
            const Icon = config.icon;
            return (
              <Card key={entry.id} variant="static" className="transition-colors hover:bg-muted/30">
                <CardContent className="py-4 flex gap-4 items-start">
                  <div className="mt-0.5 rounded-full bg-primary/10 p-2 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-sm">{entry.title}</h3>
                      <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
                      {entry.version && (
                        <span className="text-xs text-muted-foreground font-mono">v{entry.version}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(entry.created_at), 'd MMMM yyyy', { locale: it })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ChangelogSection() {
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useQuery({
    queryKey: ['changelog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('changelog')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as ChangelogEntry[];
    },
  });

  // Marca le novità come lette quando la sezione è stata caricata
  useEffect(() => {
    if (entries && entries.length > 0) {
      markChangelogAsSeen(entries[0].created_at);
      queryClient.invalidateQueries({ queryKey: ['changelog-unread-count'] });
    }
  }, [entries, queryClient]);

  const grouped = useMemo(() => {
    if (!entries) return [];
    const map = new Map<string, ChangelogEntry[]>();
    for (const e of entries) {
      const key = format(new Date(e.created_at), 'yyyy-MM');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  if (isLoading) {
    return (
      <section id="novita" className="scroll-mt-24 mb-12">
        <h2 className="text-2xl font-bold mb-6">🆕 Novità</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-20 bg-muted rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (!grouped.length) {
    return (
      <section id="novita" className="scroll-mt-24 mb-12">
        <h2 className="text-2xl font-bold mb-6">🆕 Novità</h2>
        <Card variant="static">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessuna novità al momento. Torna presto per aggiornamenti!
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section id="novita" className="scroll-mt-24 mb-12">
      <h2 className="text-2xl font-bold mb-6">🆕 Novità</h2>
      <div className="space-y-3">
        {grouped.map(([month, monthEntries], idx) => (
          <MonthGroup key={month} month={month} entries={monthEntries} defaultOpen={idx === 0} />
        ))}
      </div>
    </section>
  );
}
