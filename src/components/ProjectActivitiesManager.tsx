import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

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
    mutationFn: async ({ itemId, userIds, userNames }: { itemId: string; userIds: string[] | null; userNames: string[] | null }) => {
      const { error } = await supabase
        .from('budget_items')
        .update({
          assignee_id: userIds ? userIds.join(',') : null,
          assignee_name: userNames ? userNames.join(', ') : null,
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

  const handleAssigneeToggle = (itemId: string, userId: string, isChecked: boolean) => {
    const activity = activities.find(a => a.id === itemId);
    if (!activity) return;

    const currentIds = activity.assignee_id ? activity.assignee_id.split(',') : [];
    const currentNames = activity.assignee_name ? activity.assignee_name.split(', ') : [];

    let newIds: string[];
    let newNames: string[];

    if (isChecked) {
      // Add user
      const member = teamMembers.find(m => m.user_id === userId);
      if (member) {
        newIds = [...currentIds, userId];
        newNames = [...currentNames, `${member.first_name} ${member.last_name}`.trim()];
      } else {
        return;
      }
    } else {
      // Remove user
      const index = currentIds.indexOf(userId);
      if (index > -1) {
        newIds = currentIds.filter((_, i) => i !== index);
        newNames = currentNames.filter((_, i) => i !== index);
      } else {
        return;
      }
    }

    updateAssigneeMutation.mutate({ 
      itemId, 
      userIds: newIds.length > 0 ? newIds : null, 
      userNames: newNames.length > 0 ? newNames : null 
    });
  };

  const removeAssignee = (itemId: string, userId: string) => {
    handleAssigneeToggle(itemId, userId, false);
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
              {activities.map((activity) => {
                const assignedIds = activity.assignee_id ? activity.assignee_id.split(',') : [];
                const assignedNames = activity.assignee_name ? activity.assignee_name.split(', ') : [];
                
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {activity.activity_name}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {activity.category}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.hours_worked}h (€{activity.total_cost.toLocaleString('it-IT', { minimumFractionDigits: 2 })})
                      </div>
                      {assignedIds.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {assignedIds.map((id, index) => (
                            <Badge key={id} variant="secondary" className="gap-1">
                              {assignedNames[index]}
                              <X 
                                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                                onClick={() => removeAssignee(activity.id, id)}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-64">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            {assignedIds.length > 0 
                              ? `${assignedIds.length} assegnati` 
                              : "Assegna membri..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="end">
                          <div className="space-y-2">
                            {teamMembers.map((member) => {
                              const isChecked = assignedIds.includes(member.user_id);
                              return (
                                <div key={member.user_id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${activity.id}-${member.user_id}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => 
                                      handleAssigneeToggle(activity.id, member.user_id, checked as boolean)
                                    }
                                  />
                                  <label
                                    htmlFor={`${activity.id}-${member.user_id}`}
                                    className="text-sm cursor-pointer flex-1"
                                  >
                                    {member.first_name} {member.last_name}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
