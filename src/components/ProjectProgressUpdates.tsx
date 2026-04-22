import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MessageSquare, AlertTriangle, TrendingUp, Plus, Filter } from 'lucide-react';
import { ProgressUpdateDialog } from '@/components/ProgressUpdateDialog';
import { ProgressUpdateDraftBanner } from '@/components/ProgressUpdateDraftBanner';

interface ProjectProgressUpdatesProps {
  projectId: string;
  projectName?: string;
  currentProgress?: number;
  clientName?: string;
  projectLeaderId?: string | null;
  accountUserId?: string | null;
  projectBillingType?: string | null;
  slackChannelName?: string | null;
}

export const ProjectProgressUpdates = ({ projectId, projectName, currentProgress = 0, clientName, projectLeaderId, accountUserId, projectBillingType, slackChannelName }: ProjectProgressUpdatesProps) => {
  // currentProgress should already be calculated by the parent for recurring projects
  const [showDialog, setShowDialog] = useState(false);
  const [onlyRoadblocks, setOnlyRoadblocks] = useState(false);

  const { data: updates, isLoading, refetch } = useQuery({
    queryKey: ['project-progress-updates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_progress_updates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const userIds = [...new Set(data?.map(d => d.user_id) || [])];
      const profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name')
          .in('id', userIds);
        profiles?.forEach(p => {
          profilesMap[p.id] = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente';
        });
      }
      
      return (data || []).map(d => ({ ...d, _userName: profilesMap[d.user_id] || 'Utente' }));
    },
  });

  const filteredUpdates = useMemo(() => {
    if (!updates) return [];
    if (onlyRoadblocks) return updates.filter(u => u.roadblocks_text);
    return updates;
  }, [updates, onlyRoadblocks]);

  // Timeline data (chronological order, max last 8)
  const timelineSteps = useMemo(() => {
    if (!updates || updates.length === 0) return [];
    const chronological = [...updates].reverse();
    const last = chronological.slice(-8);
    return last.map((u, i) => {
      const prev = i > 0 ? last[i - 1] : null;
      const delta = prev ? u.progress_value - prev.progress_value : u.progress_value;
      let color: 'green' | 'yellow' | 'red' = 'green';
      if (u.roadblocks_text) color = 'red';
      else if (delta === 0) color = 'yellow';
      return { progress: u.progress_value, date: u.created_at, color, hasRoadblock: !!u.roadblocks_text };
    });
  }, [updates]);

  // Active roadblock alert
  const activeRoadblock = useMemo(() => {
    if (!updates || updates.length === 0) return null;
    const latest = updates[0];
    if (latest.roadblocks_text) return latest;
    return null;
  }, [updates]);

  const getUserName = (update: any) => update._userName || 'Utente';

  const colorMap = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-destructive',
  };

  const lineColorMap = {
    green: 'bg-green-300',
    yellow: 'bg-yellow-300',
    red: 'bg-destructive/40',
  };

  const renderTimeline = () => {
    if (timelineSteps.length < 2) return null;
    return (
      <div className="mb-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-0 py-2">
          {timelineSteps.map((step, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center min-w-[48px]">
                <div className={`w-7 h-7 rounded-full ${colorMap[step.color]} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}>
                  {step.progress}%
                </div>
                <span className="text-[9px] text-muted-foreground mt-1 whitespace-nowrap">
                  {format(new Date(step.date), 'd MMM', { locale: it })}
                </span>
              </div>
              {i < timelineSteps.length - 1 && (
                <div className={`h-0.5 w-6 ${lineColorMap[timelineSteps[i + 1].color]} flex-shrink-0`} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNewButton = () => projectName ? (
    <Button size="sm" variant="outline" onClick={() => setShowDialog(true)}>
      <Plus className="h-4 w-4 mr-1" />
      Nuovo aggiornamento
    </Button>
  ) : null;

  const renderDialog = () => projectName ? (
    <ProgressUpdateDialog
      open={showDialog}
      onOpenChange={setShowDialog}
      projectId={projectId}
      projectName={projectName}
      currentProgress={currentProgress}
      onSaved={() => { refetch(); }}
      clientName={clientName}
      projectLeaderId={projectLeaderId}
      accountUserId={accountUserId}
      projectBillingType={projectBillingType}
    />
  ) : null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Caricamento...
        </CardContent>
      </Card>
    );
  }

  const draftBanner = projectName ? (
    <ProgressUpdateDraftBanner
      projectId={projectId}
      projectName={projectName}
      slackChannelName={slackChannelName}
      currentProgress={currentProgress}
      clientName={clientName}
      projectLeaderId={projectLeaderId}
      accountUserId={accountUserId}
      projectBillingType={projectBillingType}
      onPublished={() => refetch()}
    />
  ) : null;

  if (!updates || updates.length === 0) {
    return (
      <>
        {draftBanner}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Aggiornamenti Progetto
            </CardTitle>
            {renderNewButton()}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Nessun aggiornamento registrato
            </p>
          </CardContent>
        </Card>
        {renderDialog()}
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Aggiornamenti Progetto ({updates.length})
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="roadblock-filter" checked={onlyRoadblocks} onCheckedChange={setOnlyRoadblocks} />
              <Label htmlFor="roadblock-filter" className="text-xs flex items-center gap-1 cursor-pointer">
                <Filter className="h-3 w-3" />
                Solo roadblocks
              </Label>
            </div>
            {renderNewButton()}
          </div>
        </CardHeader>
        <CardContent>
          {renderTimeline()}

          {activeRoadblock && !onlyRoadblocks && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Roadblock attivo</strong> segnalato il {format(new Date(activeRoadblock.created_at), "d MMM yyyy", { locale: it })}:
                {' '}{activeRoadblock.roadblocks_text}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {filteredUpdates.map((update) => (
              <div key={update.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{getUserName(update)}</span>
                    <Badge variant="outline" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {update.progress_value}%
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(update.created_at), "d MMM yyyy 'alle' HH:mm", { locale: it })}
                  </span>
                </div>

                {update.update_text && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Update</p>
                    <p className="text-sm whitespace-pre-wrap">{update.update_text}</p>
                  </div>
                )}

                {update.roadblocks_text && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-destructive uppercase tracking-wide flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Roadblocks
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-destructive/80">{update.roadblocks_text}</p>
                  </div>
                )}

                {!update.update_text && !update.roadblocks_text && (
                  <p className="text-xs text-muted-foreground italic">Solo aggiornamento percentuale</p>
                )}
              </div>
            ))}
            {onlyRoadblocks && filteredUpdates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun roadblock segnalato</p>
            )}
          </div>
        </CardContent>
      </Card>
      {renderDialog()}
    </>
  );
};
