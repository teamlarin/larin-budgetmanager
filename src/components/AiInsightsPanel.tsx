import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Calendar, Users, DollarSign, AlertTriangle, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Insight {
  category: 'planning' | 'resources' | 'budget' | 'risk';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
}

interface CachedInsights {
  insights: Insight[];
  generated_at: string;
}

const CACHE_KEY = 'ai-insights-cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 min

const categoryConfig = {
  planning: { icon: Calendar, label: 'Pianificazione', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  resources: { icon: Users, label: 'Risorse', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  budget: { icon: DollarSign, label: 'Budget', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  risk: { icon: AlertTriangle, label: 'Rischio', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

const priorityConfig = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-500',
};

function getCachedInsights(): CachedInsights | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedInsights;
    if (Date.now() - new Date(cached.generated_at).getTime() > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

export const AiInsightsPanel = () => {
  const [insights, setInsights] = useState<Insight[]>(() => getCachedInsights()?.insights || []);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(() => getCachedInsights()?.generated_at || null);
  const { toast } = useToast();

  const fetchInsights = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Errore', description: 'Devi effettuare il login', variant: 'destructive' });
        return;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({}),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        toast({ title: 'Errore', description: errData.error || `Errore ${resp.status}`, variant: 'destructive' });
        return;
      }

      const data = await resp.json();
      setInsights(data.insights || []);
      setLastGenerated(data.generated_at);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('AI insights error:', e);
      toast({ title: 'Errore', description: 'Impossibile generare insight AI', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const hasInsights = insights.length > 0;
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Insights
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`} />
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {lastGenerated && (
                <span className="text-xs text-muted-foreground">
                  {new Date(lastGenerated).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                size="sm"
                variant={hasInsights ? 'outline' : 'default'}
                onClick={fetchInsights}
                disabled={isLoading}
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Analisi...</>
                ) : hasInsights ? (
                  <><RefreshCw className="h-4 w-4 mr-1" /> Aggiorna</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Genera suggerimenti</>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {!hasInsights && !isLoading && (
              <div className="text-center py-6 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Clicca "Genera suggerimenti" per ricevere insight AI</p>
                <p className="text-xs mt-1">basati su scadenze, workload e budget dei tuoi progetti</p>
              </div>
            )}
            {isLoading && !hasInsights && (
              <div className="text-center py-6 text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Analisi dei dati in corso...</p>
              </div>
            )}
            {hasInsights && (
              <div className="space-y-3">
                {insights.map((insight, i) => {
                  const cat = categoryConfig[insight.category] || categoryConfig.planning;
                  const CatIcon = cat.icon;
                  return (
                    <div
                      key={i}
                      className={`border-l-4 ${priorityConfig[insight.priority]} rounded-lg bg-muted/30 p-3`}
                    >
                      <div className="flex items-start gap-2">
                        <CatIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm">{insight.title}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cat.color}`}>
                              {cat.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                          <p className="text-xs font-medium text-primary mt-1.5">→ {insight.action}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
