import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Globe, Server, Search } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface KinstaEnvironment {
  id: string;
  name: string;
  display_name: string;
  primary_domain?: { name: string };
}

interface KinstaSite {
  id: string;
  name: string;
  display_name: string;
  status: string;
  site_labels?: { id: string; name: string }[];
  environments?: KinstaEnvironment[];
}

const fetchKinstaSites = async (): Promise<KinstaSite[]> => {
  const { data, error } = await supabase.functions.invoke('kinsta-sites');
  if (error) throw error;
  return data?.company?.sites || [];
};

export const KinstaSitesWidget = () => {
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: sites, isLoading, error } = useQuery({
    queryKey: ['kinsta-sites'],
    queryFn: fetchKinstaSites,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const uniqueLabels = useMemo(() => {
    if (!sites) return [];
    const labels = new Set<string>();
    sites.forEach((site) => site.site_labels?.forEach((l) => labels.add(l.name)));
    return Array.from(labels).sort();
  }, [sites]);

  const filteredSites = useMemo(() => {
    if (!sites) return [];
    const sorted = [...sites].sort((a, b) => a.display_name.localeCompare(b.display_name));
    if (labelFilter === 'all') return sorted;
    return sorted.filter((site) => site.site_labels?.some((l) => l.name === labelFilter));
  }, [sites, labelFilter]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Siti WpZen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Impossibile caricare i siti.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Siti WpZen
        </CardTitle>
        <CardDescription>Siti WordPress gestiti</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : !sites || sites.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun sito trovato</p>
        ) : (
          <div className="space-y-4">
            {uniqueLabels.length > 0 && (
              <Select value={labelFilter} onValueChange={setLabelFilter}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filtra per etichetta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le etichette</SelectItem>
                  {uniqueLabels.map((label) => (
                    <SelectItem key={label} value={label}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="space-y-3">
              {filteredSites.map((site) => {
                const liveEnv = site.environments?.find((e) => e.name === 'live');
                const stagingEnv = site.environments?.find((e) => e.name === 'staging');
                const env = liveEnv || stagingEnv || site.environments?.[0];
                const domain = env?.primary_domain?.name;

                return (
                  <div
                    key={site.id}
                    className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors gap-2"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-medium truncate">{site.display_name}</p>
                      {domain && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{domain}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      {site.site_labels?.map((label) => (
                        <Badge key={label.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {label.name}
                        </Badge>
                      ))}
                      <Badge variant={site.status === 'live' ? 'green' : 'gray'}>
                        {site.status === 'live' ? 'Attivo' : site.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {filteredSites.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nessun sito per questa etichetta</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
