import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, ExternalLink, Server } from 'lucide-react';

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
  const { data: sites, isLoading, error } = useQuery({
    queryKey: ['kinsta-sites'],
    queryFn: fetchKinstaSites,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Siti Kinsta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Impossibile caricare i siti Kinsta.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Siti Kinsta
        </CardTitle>
        <CardDescription>Siti WordPress dal pannello aziendale</CardDescription>
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
          <div className="space-y-3">
            {sites.map((site) => {
              const liveEnv = site.environments?.find((e) => e.name === 'live');
              const domain = liveEnv?.primary_domain?.name;

              return (
                <div
                  key={site.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium truncate">{site.display_name}</p>
                    {domain && (
                      <a
                        href={`https://${domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{domain}</span>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={site.status === 'live' ? 'green' : 'gray'}>
                      {site.status === 'live' ? 'Attivo' : site.status}
                    </Badge>
                    <a
                      href={`https://my.kinsta.com/sites/details/${site.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
