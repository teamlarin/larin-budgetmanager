import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { AlertTriangle, MessageSquare, TrendingUp, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { AREA_LABELS, AREA_COLORS } from '@/lib/areaColors';

type LevelArea = keyof typeof AREA_LABELS;

interface WeeklyUpdate {
  id: string;
  project_id: string;
  user_id: string;
  progress_value: number;
  update_text: string | null;
  roadblocks_text: string | null;
  created_at: string;
  _projectName: string;
  _projectArea: string | null;
  _clientName: string | null;
  _userName: string;
}

const COLLAPSED_LIMIT = 5;

interface WeeklyUpdatesWidgetProps {
  filterAreas?: string[];
}

export const WeeklyUpdatesWidget = ({ filterAreas }: WeeklyUpdatesWidgetProps = {}) => {
  const navigate = useNavigate();
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const [showAllStale, setShowAllStale] = useState(false);

  const { data: updates = [], isLoading } = useQuery({
    queryKey: ['weekly-progress-updates'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      const { data: rawUpdates, error } = await supabase
        .from('project_progress_updates')
        .select('*')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!rawUpdates?.length) return [];

      // Get unique project & user IDs
      const projectIds = [...new Set(rawUpdates.map(u => u.project_id))];
      const userIds = [...new Set(rawUpdates.map(u => u.user_id))];

      // Fetch projects and profiles in parallel
      const [projectsRes, profilesRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, area, clients(name)')
          .in('id', projectIds),
        supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name')
          .in('id', userIds),
      ]);

      const projectMap: Record<string, { name: string; area: string | null; clientName: string | null }> = {};
      (projectsRes.data || []).forEach((p: any) => {
        projectMap[p.id] = { name: p.name, area: p.area, clientName: p.clients?.name || null };
      });

      const profileMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => {
        profileMap[p.id] = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente';
      });

      return rawUpdates.map(u => ({
        ...u,
        _projectName: projectMap[u.project_id]?.name || 'Progetto',
        _projectArea: projectMap[u.project_id]?.area || null,
        _clientName: projectMap[u.project_id]?.clientName || null,
        _userName: profileMap[u.user_id] || 'Utente',
      })) as WeeklyUpdate[];
    },
  });

  // Fetch open projects without recent updates
  const { data: staleProjects = [] } = useQuery({
    queryKey: ['stale-projects-no-updates'],
    queryFn: async () => {
      // Get all open projects
      const { data: openProjects, error } = await supabase
        .from('projects')
        .select('id, name, area, billing_type, clients(name)')
        .eq('status', 'approvato')
        .eq('project_status', 'aperto');
      if (error) throw error;
      if (!openProjects?.length) return [];

      const projectIds = openProjects.map(p => p.id);

      // Get latest update per project
      const { data: latestUpdates } = await supabase
        .from('project_progress_updates')
        .select('project_id, created_at')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

      const latestByProject: Record<string, string> = {};
      (latestUpdates || []).forEach(u => {
        if (!latestByProject[u.project_id]) {
          latestByProject[u.project_id] = u.created_at;
        }
      });

      const now = new Date();
      const excludedBillingTypes = ['recurring', 'pack', 'interno', 'consumptive'];
      return openProjects
        .filter(p => !excludedBillingTypes.includes((p as any).billing_type))
        .filter(p => {
          const lastUpdate = latestByProject[p.id];
          if (!lastUpdate) return true;
          return differenceInDays(now, new Date(lastUpdate)) > 7;
        })
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          area: p.area as string | null,
          clientName: (p.clients?.name as string) || null,
          lastUpdate: latestByProject[p.id] || null,
          daysSince: latestByProject[p.id] ? differenceInDays(now, new Date(latestByProject[p.id])) : null,
        }));
    },
  });

  // Split into roadblock updates and normal updates
  const roadblockUpdates = useMemo(() => {
    let filtered = updates.filter(u => u.roadblocks_text);
    if (selectedArea) filtered = filtered.filter(u => u._projectArea === selectedArea);
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [updates, selectedArea]);

  const normalUpdates = useMemo(() => {
    let filtered = updates.filter(u => !u.roadblocks_text);
    if (selectedArea) filtered = filtered.filter(u => u._projectArea === selectedArea);
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [updates, selectedArea]);

  const filteredStaleProjects = useMemo(() => {
    if (!selectedArea) return staleProjects;
    return staleProjects.filter(p => p.area === selectedArea);
  }, [staleProjects, selectedArea]);

  const roadblockCount = updates.filter(u => u.roadblocks_text).length;
  const areas = (Object.keys(AREA_LABELS) as LevelArea[]).filter(a => a !== 'sales' && a !== 'struttura');

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
          <h2 className="text-xl font-semibold">Aggiornamenti Settimanali</h2>
        </div>
        <Card variant="static"><CardContent className="p-6 text-sm text-muted-foreground">Caricamento...</CardContent></Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
        <h2 className="text-xl font-semibold">Aggiornamenti Settimanali</h2>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Roadblock attivi</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold text-destructive">{roadblockCount}</div>
            <p className="text-xs text-muted-foreground">questa settimana</p>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Update totali</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{updates.length}</div>
            <p className="text-xs text-muted-foreground">ultimi 7 giorni</p>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Senza aggiornamenti</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold text-amber-600">{staleProjects.length}</div>
            <p className="text-xs text-muted-foreground">da oltre 7 giorni</p>
          </CardContent>
        </Card>
      </div>

      {/* Area filter */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={selectedArea === null ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setSelectedArea(null)}
        >
          Tutte
        </Badge>
        {areas.map(area => (
          <Badge
            key={area}
            variant="outline"
            className={`cursor-pointer ${selectedArea === area ? AREA_COLORS[area] : ''}`}
            onClick={() => setSelectedArea(selectedArea === area ? null : area)}
          >
            {AREA_LABELS[area]}
          </Badge>
        ))}
      </div>

      {/* Roadblocks - always shown in full */}
      {roadblockUpdates.length > 0 && (
        <Card variant="static" className="border-destructive/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm font-medium">Roadblock attivi ({roadblockUpdates.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {roadblockUpdates.map(update => (
                <UpdateRow key={update.id} update={update} navigate={navigate} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Normal updates - collapsed to 5 */}
      {normalUpdates.length === 0 && roadblockUpdates.length === 0 ? (
        <Card variant="static">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nessun aggiornamento questa settimana
          </CardContent>
        </Card>
      ) : normalUpdates.length > 0 && (
        <Card variant="static">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Aggiornamenti ({normalUpdates.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {normalUpdates.slice(0, showAllUpdates ? normalUpdates.length : COLLAPSED_LIMIT).map(update => (
                <UpdateRow key={update.id} update={update} navigate={navigate} />
              ))}
            </div>
            {normalUpdates.length > COLLAPSED_LIMIT && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowAllUpdates(v => !v)}
              >
                {showAllUpdates ? (
                  <><ChevronUp className="h-3.5 w-3.5 mr-1" />Mostra meno</>
                ) : (
                  <><ChevronDown className="h-3.5 w-3.5 mr-1" />Mostra tutti ({normalUpdates.length})</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stale projects - collapsed to 5 */}
      {filteredStaleProjects.length > 0 && (
        <Card variant="static" className="border-amber-500/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium">Progetti senza aggiornamenti recenti ({filteredStaleProjects.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y">
              {filteredStaleProjects.slice(0, showAllStale ? filteredStaleProjects.length : COLLAPSED_LIMIT).map(project => (
                <div
                  key={project.id}
                  className="flex items-center justify-between py-2 px-1 cursor-pointer hover:bg-muted/50 rounded transition-colors"
                  onClick={() => navigate(`/projects/${project.id}/canvas`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{project.name}</span>
                      {project.area && AREA_LABELS[project.area as LevelArea] && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${AREA_COLORS[project.area as LevelArea] || ''}`}>
                          {AREA_LABELS[project.area as LevelArea]}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {project.clientName ? `${project.clientName} · ` : ''}
                      {project.lastUpdate
                        ? `Ultimo update ${format(new Date(project.lastUpdate), 'd MMM', { locale: it })} (${project.daysSince}gg fa)`
                        : 'Mai aggiornato'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {filteredStaleProjects.length > COLLAPSED_LIMIT && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowAllStale(v => !v)}
              >
                {showAllStale ? (
                  <><ChevronUp className="h-3.5 w-3.5 mr-1" />Mostra meno</>
                ) : (
                  <><ChevronDown className="h-3.5 w-3.5 mr-1" />Mostra tutti ({filteredStaleProjects.length})</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
};

// Extracted row component for update items
const UpdateRow = ({ update, navigate }: { update: WeeklyUpdate; navigate: (path: string) => void }) => {
  const hasRoadblock = !!update.roadblocks_text;
  return (
    <div className={`p-3 rounded-md border ${hasRoadblock ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-sm font-semibold cursor-pointer hover:underline truncate"
              onClick={() => navigate(`/projects/${update.project_id}/canvas`)}
            >
              {update._projectName}
            </span>
            {update._projectArea && AREA_LABELS[update._projectArea as LevelArea] && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${AREA_COLORS[update._projectArea as LevelArea] || ''}`}>
                {AREA_LABELS[update._projectArea as LevelArea]}
              </Badge>
            )}
            {update._clientName && (
              <span className="text-xs text-muted-foreground">· {update._clientName}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {update._userName} · {format(new Date(update.created_at), 'd MMM HH:mm', { locale: it })}
          </p>
          {update.update_text && (
            <p className="text-sm text-muted-foreground line-clamp-2">{update.update_text}</p>
          )}
          {hasRoadblock && (
            <div className="flex items-start gap-1.5 mt-1 p-2 rounded-md bg-destructive/10">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive line-clamp-2">{update.roadblocks_text}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{update.progress_value}%</span>
        </div>
      </div>
    </div>
  );
};
