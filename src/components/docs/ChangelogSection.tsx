import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Bug, Wrench, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const categoryConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  feature: { label: 'Novità', variant: 'default', icon: Sparkles },
  improvement: { label: 'Miglioramento', variant: 'secondary', icon: Zap },
  bugfix: { label: 'Correzione', variant: 'destructive', icon: Bug },
  maintenance: { label: 'Manutenzione', variant: 'outline', icon: Wrench },
};

export function ChangelogSection() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['changelog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('changelog')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

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

  if (!entries || entries.length === 0) {
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
      <div className="space-y-4">
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
                    <Badge variant={config.variant} className="text-xs">
                      {config.label}
                    </Badge>
                    {entry.version && (
                      <span className="text-xs text-muted-foreground font-mono">v{entry.version}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(entry.created_at), "d MMMM yyyy", { locale: it })}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
