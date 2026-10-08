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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AREA_LABELS, AREA_COLORS } from '@/lib/areaColors';
import { getHealthMeta, ROADBLOCK_TYPE_LABELS, type RoadblockType } from '@/lib/projectRoadblocks';

interface ActiveRoadblock {
  id: string;
  project_id: string;
  description: string;
  blocker_type: RoadblockType;
  waiting_on_who: string | null;
  waiting_on_what: string | null;
  opened_at: string;
  _projectName: string;
  _projectArea: string | null;
  _clientName: string | null;
  _leaderId?: string | null;
}

type LevelArea = keyof typeof AREA_LABELS;

interface WeeklyUpdate {
  id: string;
  project_id: string;
  user_id: string;
  progress_value: number;
  update_text: string | null;
  roadblocks_text: string | null;
  health_status: string | null;
  created_at: string;
  _projectName: string;
  _projectArea: string | null;
  _clientName: string | null;
  _userName: string;
  _leaderId?: string | null;
}

const COLLAPSED_LIMIT = 5;

interface WeeklyUpdatesWidgetProps {
  filterAreas?: string[];
}

export const WeeklyUpdatesWidget = ({ filterAreas }: WeeklyUpdatesWidgetProps = {}) => {
  const navigate = useNavigate();
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedLeader, setSelectedLeader] = useState<string | null>(null);
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
          .select('id, name, area, project_leader_id, clients(name)')
          .in('id', projectIds),
        supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name')
          .in('id', userIds),
      ]);

      const projectMap: Record<string, { name: string; area: string | null; clientName: string | null; leaderId: string | null }> = {};
      (projectsRes.data || []).forEach((p: any) => {
        projectMap[p.id] = { name: p.name, area: p.area, clientName: p.clients?.name || null, leaderId: p.project_leader_id || null };
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
        _leaderId: projectMap[u.project_id]?.leaderId || null,
      })) as WeeklyUpdate[];
    },
  });

  const { data: roadblocks = [] } = useQuery({
    queryKey: ['dashboard-active-roadblocks'],
    queryFn: async () => {
      const { data: rbs, error } = await supabase
        .from('project_roadblocks')
        .select('id, project_id, description, blocker_type, waiting_on_who, waiting_on_what, opened_at')
        .is('resolved_at', null)
        .order('opened_at', { ascending: true });
      if (error) throw error;
      if (!rbs?.length) return [];
      const ids = [...new Set(rbs.map(r => r.project_id))];
      const { data: projs } = await supabase
        .from('projects')
        .select('id, name, area, project_status, project_leader_id, clients(name)')
        .in('id', ids);
      const map: Record<string, any> = {};
      (projs || []).forEach((p: any) => { map[p.id] = p; });
      return rbs
        .filter(r => map[r.project_id] && ['aperto', 'in_partenza', 'da_fatturare'].includes(map[r.project_id].project_status))
        .map(r => ({
          ...r,
          _projectName: map[r.project_id].name,
          _projectArea: map[r.project_id].area,
          _clientName: map[r.project_id].clients?.name || null,
          _leaderId: map[r.project_id].project_leader_id || null,
        })) as ActiveRoadblock[];
    },
  });

  // Fetch open projects without recent updates
  const { data: staleProjects = [] } = useQuery({
    queryKey: ['stale-projects-no-updates'],
    queryFn: async () => {
      // Get all open projects
      const { data: openProjects, error } = await supabase
        .from('projects')
        .select('id, name, area, billing_type, project_leader_id, clients(name)')
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
          leaderId: (p.project_leader_id as string) || null,
          lastUpdate: latestByProject[p.id] || null,
          daysSince: latestByProject[p.id] ? differenceInDays(now, new Date(latestByProject[p.id])) : null,
        }));
    },
  });

  // Nomi dei project leader presenti nei dati
  const leaderIds = useMemo(() => {
    const s = new Set<string>();
    updates.forEach(u => u._leaderId && s.add(u._leaderId));
    roadblocks.forEach(r => r._leaderId && s.add(r._leaderId));
    staleProjects.forEach(p => p.leaderId && s.add(p.leaderId));
    return [...s].sort();
  }, [updates, roadblocks, staleProjects]);

  const { data: leaderNames = {} } = useQuery({
    queryKey: ['weekly-updates-leaders', leaderIds],
    enabled: leaderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .in('id', leaderIds);
      const map: Record<string, { name: string; last: string }> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = {
          name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente',
          last: p.last_name || p.full_name || '',
        };
      });
      return map;
    },
  });

  const leaderOptions = useMemo(
    () => leaderIds
      .filter(id => leaderNames[id])
      .sort((a, b) => leaderNames[a].last.localeCompare(leaderNames[b].last)),
    [leaderIds, leaderNames],
  );

  const matchLeader = (id: string | null | undefined) => !selectedLeader || id === selectedLeader;

  // Pre-filter by filterAreas and leader
  const preFilteredUpdates = useMemo(() => {
    let list = updates.filter(u => matchLeader(u._leaderId));
    if (filterAreas?.length) list = list.filter(u => u._projectArea && filterAreas.includes(u._projectArea));
    return list;
  }, [updates, filterAreas, selectedLeader]);

  const preFilteredRoadblocks = useMemo(() => {
    let list = roadblocks.filter(r => matchLeader(r._leaderId));
    if (filterAreas?.length) list = list.filter(r => r._projectArea && filterAreas.includes(r._projectArea));
    return list;
  }, [roadblocks, filterAreas, selectedLeader]);

  const activeRoadblocks = useMemo(() => {
    if (!selectedArea) return preFilteredRoadblocks;
    return preFilteredRoadblocks.filter(r => r._projectArea === selectedArea);
  }, [preFilteredRoadblocks, selectedArea]);

  const normalUpdates = useMemo(() => {
    let filtered = preFilteredUpdates;
    if (selectedArea) filtered = filtered.filter(u => u._projectArea === selectedArea);
    return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [preFilteredUpdates, selectedArea]);

  const filteredStaleProjects = useMemo(() => {
    let filtered = staleProjects.filter(p => matchLeader(p.leaderId));
    if (filterAreas?.length) filtered = filtered.filter(p => p.area && filterAreas.includes(p.area));
    if (selectedArea) filtered = filtered.filter(p => p.area === selectedArea);
    return filtered;
  }, [staleProjects, selectedArea, filterAreas, selectedLeader]);

  const roadblockCount = preFilteredRoadblocks.length;
  const areas = (Object.keys(AREA_LABELS) as LevelArea[]).filter(a => {
    if (a === 'sales' || a === 'struttura') return false;
    if (filterAreas?.length) return filterAreas.includes(a);
    return true;
  });

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
          <h2 className="text-xl font-semibold">Aggiornamenti Settimanali</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} variant="static">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-16 w-full" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
            <p className="text-xs text-muted-foreground">aperti nel registro</p>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Update totali</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{preFilteredUpdates.length}</div>
            <p className="text-xs text-muted-foreground">ultimi 7 giorni</p>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Senza aggiornamenti</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold text-amber-600">{filteredStaleProjects.length}</div>
            <p className="text-xs text-muted-foreground">da oltre 7 giorni</p>
          </CardContent>
        </Card>
      </div>

      {/* Area + leader filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedLeader ?? '__none__'} onValueChange={(v) => setSelectedLeader(v === '__none__' ? null : v)}>
          <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Project leader" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Tutti i project leader</SelectItem>
            {leaderOptions.map(id => (
              <SelectItem key={id} value={id}>{leaderNames[id].name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      {activeRoadblocks.length > 0 && (
        <Card variant="static" className="border-destructive/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm font-medium">Roadblock attivi ({activeRoadblocks.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {activeRoadblocks.map(rb => (
                <RoadblockRow key={rb.id} rb={rb} navigate={navigate} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Normal updates - collapsed to 5 */}
      {normalUpdates.length === 0 ? (
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
  const health = getHealthMeta(update.health_status);
  return (
    <div className="p-3 rounded-md border border-border">
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
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${health.badge}`}>{health.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {update._userName} · {format(new Date(update.created_at), 'd MMM HH:mm', { locale: it })}
          </p>
          {update.update_text && (
            <p className="text-sm text-muted-foreground line-clamp-2">{update.update_text}</p>
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


const RoadblockRow = ({ rb, navigate }: { rb: ActiveRoadblock; navigate: (path: string) => void }) => {
  const days = differenceInDays(new Date(), new Date(rb.opened_at));
  const waiting = [rb.waiting_on_who, rb.waiting_on_what].filter(Boolean).join(' – ');
  return (
    <div
      className="p-3 rounded-md border border-destructive/50 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors"
      onClick={() => navigate(`/projects/${rb.project_id}/canvas`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{rb._projectName}</span>
            {rb._projectArea && AREA_LABELS[rb._projectArea as LevelArea] && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${AREA_COLORS[rb._projectArea as LevelArea] || ''}`}>
                {AREA_LABELS[rb._projectArea as LevelArea]}
              </Badge>
            )}
            {rb._clientName && <span className="text-xs text-muted-foreground">· {rb._clientName}</span>}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive">
              {ROADBLOCK_TYPE_LABELS[rb.blocker_type] || rb.blocker_type}
            </Badge>
          </div>
          <p className="text-sm text-destructive whitespace-pre-wrap line-clamp-3">{rb.description}</p>
          {waiting && <p className="text-xs text-muted-foreground">In attesa di: {waiting}</p>}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {days === 0 ? 'oggi' : `da ${days}gg`}
        </span>
      </div>
    </div>
  );
};
