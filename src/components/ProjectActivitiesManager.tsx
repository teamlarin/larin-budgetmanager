import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectActivitiesManagerProps {
  projectId: string;
  briefLink?: string | null;
  objective?: string | null;
}

interface BudgetItem {
  id: string;
  activity_name: string;
  category: string;
  hourly_rate: number;
  hours_worked: number;
  total_cost: number;
  assignee_id: string | null;
  assignee_name: string | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

export const ProjectActivitiesManager = ({ projectId, briefLink, objective }: ProjectActivitiesManagerProps) => {
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<BudgetItem[]>({
    queryKey: ['budget-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_product', false)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: teamMembers = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['project-team-members', projectId],
    queryFn: async () => {
      const { data: memberIds, error: memberError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId);

      if (memberError) throw memberError;
      if (!memberIds || memberIds.length === 0) return [];

      const userIds = memberIds.map(m => m.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);

      if (profileError) throw profileError;

      return profiles?.map(p => ({
        id: p.id,
        user_id: p.id,
        first_name: p.first_name || '',
        last_name: p.last_name || '',
      })) || [];
    },
  });

  const updateAssigneeMutation = useMutation({
    mutationFn: async ({ itemId, userId, userName }: { itemId: string; userId: string | null; userName: string | null }) => {
      const { error } = await supabase
        .from('budget_items')
        .update({
          assignee_id: userId,
          assignee_name: userName,
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] });
      toast.success('Assegnazione aggiornata con successo');
    },
    onError: (error) => {
      console.error('Error updating assignee:', error);
      toast.error('Errore durante l\'aggiornamento dell\'assegnazione');
    },
  });

  const handleAssigneeChange = (itemId: string, userId: string) => {
    if (userId === 'none') {
      updateAssigneeMutation.mutate({ itemId, userId: null, userName: null });
      return;
    }

    const member = teamMembers.find(m => m.user_id === userId);
    if (member) {
      const userName = `${member.first_name} ${member.last_name}`.trim();
      updateAssigneeMutation.mutate({ itemId, userId, userName });
    }
  };

  const isLoading = activitiesLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brief and Objective Section */}
      <Card>
        <CardHeader>
          <CardTitle>Informazioni Progetto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Link Brief</p>
            {briefLink ? (
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <a href={briefLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Apri Brief
                </a>
              </Button>
            ) : (
              <p className="text-muted-foreground italic">Nessun brief disponibile</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Obiettivo</p>
            <p className="text-foreground whitespace-pre-wrap">
              {objective || 'Nessun obiettivo definito'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Activities Section */}
      <Card>
        <CardHeader>
          <CardTitle>Attività Previste</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nessuna attività presente nel budget
            </p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {activity.activity_name}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {activity.category}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {activity.hours_worked}h × €{activity.hourly_rate}/h = €{activity.total_cost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="w-64">
                    <Select
                      value={activity.assignee_id || 'none'}
                      onValueChange={(value) => handleAssigneeChange(activity.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Assegna a..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background border">
                        <SelectItem value="none">Non assegnato</SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.first_name} {member.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
