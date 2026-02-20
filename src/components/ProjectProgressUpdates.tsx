import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MessageSquare, AlertTriangle, TrendingUp, Plus } from 'lucide-react';
import { ProgressUpdateDialog } from '@/components/ProgressUpdateDialog';

interface ProjectProgressUpdatesProps {
  projectId: string;
  projectName?: string;
  currentProgress?: number;
  clientName?: string;
  projectLeaderId?: string | null;
  accountUserId?: string | null;
}

export const ProjectProgressUpdates = ({ projectId, projectName, currentProgress = 0, clientName, projectLeaderId, accountUserId }: ProjectProgressUpdatesProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const { data: updates, isLoading, refetch } = useQuery({
    queryKey: ['project-progress-updates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_progress_updates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Fetch profile names for all unique user_ids
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

  const getUserName = (update: any) => {
    return update._userName || 'Utente';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Caricamento...
        </CardContent>
      </Card>
    );
  }

  if (!updates || updates.length === 0) {
    return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Aggiornamenti Progetto
          </CardTitle>
          {projectName && (
            <Button size="sm" variant="outline" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nuovo aggiornamento
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun aggiornamento registrato
          </p>
        </CardContent>
      </Card>
      {projectName && (
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
        />
      )}
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
        {projectName && (
          <Button size="sm" variant="outline" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuovo aggiornamento
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {updates.map((update) => (
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
        </div>
      </CardContent>
    </Card>
    {projectName && (
      <ProgressUpdateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        projectId={projectId}
        projectName={projectName}
        currentProgress={currentProgress}
        onSaved={() => {
          refetch();
        }}
        clientName={clientName}
        projectLeaderId={projectLeaderId}
        accountUserId={accountUserId}
      />
    )}
    </>
  );
};
