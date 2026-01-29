import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExternalLink, X, Users, UserCheck, UserX, Plus, Trash2, Calendar, CornerDownRight, Folder, Pencil, Clock, ChevronDown, ChevronRight, FileDown } from 'lucide-react';
import { formatHours } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useMemo } from 'react';
import { categoryColorsBadge, getCategoryBadgeColor, ACTIVITY_CATEGORIES } from '@/lib/categoryColors';
import { DriveFilePicker } from './DriveFilePicker';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ImportActivitiesFromTemplateDialog } from './ImportActivitiesFromTemplateDialog';
interface ProjectActivitiesManagerProps {
  projectId: string;
  briefLink?: string | null;
  objective?: string | null;
  onBriefLinkUpdate?: () => void;
  clientDriveFolderId?: string | null;
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
  is_custom_activity?: boolean;
  duration_days?: number | null;
  parent_id?: string | null;
}
interface TeamMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}
interface ActivityAssignment {
  activity_id: string;
  assigned_users: string[];
}
export const ProjectActivitiesManager = ({
  projectId,
  briefLink,
  objective,
  onBriefLinkUpdate,
  clientDriveFolderId
}: ProjectActivitiesManagerProps) => {
  const queryClient = useQueryClient();
  const [batchMode, setBatchMode] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityCategory, setNewActivityCategory] = useState('Management');
  const [newActivityHours, setNewActivityHours] = useState(1);
  const [newActivityDuration, setNewActivityDuration] = useState<number | null>(null);
  const [addingSubActivityFor, setAddingSubActivityFor] = useState<string | null>(null);
  const [subActivityName, setSubActivityName] = useState('');
  const [subActivityCategory, setSubActivityCategory] = useState('Management');
  const [subActivityHours, setSubActivityHours] = useState(1);
  const [subActivityDuration, setSubActivityDuration] = useState<number | null>(null);
  const [canEditHours, setCanEditHours] = useState(false);
  const [canAssignActivities, setCanAssignActivities] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // Edit activity state
  const [editingActivity, setEditingActivity] = useState<BudgetItem | null>(null);
  const [editActivityName, setEditActivityName] = useState('');
  const [editActivityCategory, setEditActivityCategory] = useState('');

  // Check if current user can assign activities (admin, team_leader, coordinator, or project leader)
  useEffect(() => {
    const checkUserPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const userRoles = roles?.map(r => r.role) || [];
      setCanEditHours(userRoles.includes('admin') || userRoles.includes('team_leader') || userRoles.includes('coordinator'));
      
      // Check if user is admin, team_leader, or coordinator
      const hasAssignRole = userRoles.includes('admin') || 
                           userRoles.includes('team_leader') || 
                           userRoles.includes('coordinator');
      
      if (hasAssignRole) {
        setCanAssignActivities(true);
        return;
      }
      
      // Check if user is the project leader for this project
      const { data: project } = await supabase
        .from('projects')
        .select('project_leader_id')
        .eq('id', projectId)
        .single();
      
      if (project?.project_leader_id === user.id) {
        setCanAssignActivities(true);
      }
    };
    checkUserPermissions();
  }, [projectId]);

  // Fetch project billing_type
  const { data: projectData } = useQuery({
    queryKey: ['project-billing-type', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('billing_type')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Fetch activity categories from database
  const { data: dbCategories = [] } = useQuery<{id: string; name: string}[]>({
    queryKey: ['activity-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_categories')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Filter categories based on billing type - "Off" category only visible for "interno" projects
  const filteredCategories = useMemo(() => {
    // If no DB categories, fall back to ACTIVITY_CATEGORIES
    const baseCategories = dbCategories.length > 0 
      ? dbCategories.map(c => c.name) 
      : ACTIVITY_CATEGORIES;
    
    return baseCategories.filter(categoryName => {
      const categoryNameLower = categoryName.toLowerCase();
      // If category is "off", only show it for "interno" billing type
      if (categoryNameLower === 'off') {
        return projectData?.billing_type === 'interno';
      }
      return true;
    });
  }, [dbCategories, projectData?.billing_type]);

  const {
    data: activities = [],
    isLoading: activitiesLoading
  } = useQuery<BudgetItem[]>({
    queryKey: ['budget-items', projectId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('budget_items').select('*').eq('project_id', projectId).eq('is_product', false).order('display_order', {
        ascending: true
      });
      if (error) throw error;
      // Mostra tutte le attività tranne quelle create dal calendario
      return (data || []).filter(item => {
        const createdFrom = (item as any).created_from;
        return createdFrom !== 'calendar';
      });
    }
  });
  const {
    data: teamMembers = [],
    isLoading: membersLoading
  } = useQuery<TeamMember[]>({
    queryKey: ['project-team-members', projectId],
    queryFn: async () => {
      const {
        data: memberIds,
        error: memberError
      } = await supabase.from('project_members').select('user_id').eq('project_id', projectId);
      if (memberError) throw memberError;
      if (!memberIds || memberIds.length === 0) return [];
      const userIds = memberIds.map(m => m.user_id);
      const {
        data: profiles,
        error: profileError
      } = await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds);
      if (profileError) throw profileError;
      return profiles?.map(p => ({
        id: p.id,
        user_id: p.id,
        first_name: p.first_name || '',
        last_name: p.last_name || ''
      })) || [];
    }
  });
  const {
    data: assignments = []
  } = useQuery<ActivityAssignment[]>({
    queryKey: ['activity-assignments', projectId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('activity_time_tracking').select('budget_item_id, user_id').in('budget_item_id', activities.map(a => a.id));
      if (error) throw error;

      // Group by activity
      const grouped = (data || []).reduce((acc, item) => {
        const existing = acc.find(a => a.activity_id === item.budget_item_id);
        if (existing) {
          if (!existing.assigned_users.includes(item.user_id)) {
            existing.assigned_users.push(item.user_id);
          }
        } else {
          acc.push({
            activity_id: item.budget_item_id,
            assigned_users: [item.user_id]
          });
        }
        return acc;
      }, [] as ActivityAssignment[]);
      return grouped;
    },
    enabled: activities.length > 0
  });
  const assignUserMutation = useMutation({
    mutationFn: async ({
      activityId,
      userId
    }: {
      activityId: string;
      userId: string;
    }) => {
      const {
        error
      } = await supabase.from('activity_time_tracking').insert({
        budget_item_id: activityId,
        user_id: userId
      });
      if (error) throw error;

      // Check workload threshold (40 hours)
      const WORKLOAD_THRESHOLD = 40;
      const userActivities = activities.filter(activity => {
        const assignedUsers = getAssignedUsers(activity.id);
        return assignedUsers.includes(userId) || activity.id === activityId;
      });
      const totalHours = userActivities.reduce((sum, activity) => sum + activity.hours_worked, 0);
      if (totalHours > WORKLOAD_THRESHOLD) {
        const member = teamMembers.find(m => m.user_id === userId);
        const memberName = member ? `${member.first_name} ${member.last_name}` : 'Utente';

        // Create notification for workload exceeded
        await supabase.from('notifications').insert({
          user_id: userId,
          project_id: projectId,
          type: 'workload_alert',
          title: 'Carico di lavoro elevato',
          message: `${memberName} ha superato la soglia di ${WORKLOAD_THRESHOLD} ore con un totale di ${totalHours.toFixed(1)} ore assegnate.`,
          read: false
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['activity-assignments', projectId]
      });
      toast.success('Utente assegnato con successo');
    },
    onError: error => {
      console.error('Error assigning user:', error);
      toast.error('Errore durante l\'assegnazione dell\'utente');
    }
  });
  const unassignUserMutation = useMutation({
    mutationFn: async ({
      activityId,
      userId
    }: {
      activityId: string;
      userId: string;
    }) => {
      const {
        error
      } = await supabase.from('activity_time_tracking').delete().eq('budget_item_id', activityId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['activity-assignments', projectId]
      });
      toast.success('Utente rimosso con successo');
    },
    onError: error => {
      console.error('Error unassigning user:', error);
      toast.error('Errore durante la rimozione dell\'utente');
    }
  });
  const handleAssigneeToggle = (activityId: string, userId: string, isChecked: boolean) => {
    if (isChecked) {
      assignUserMutation.mutate({
        activityId,
        userId
      });
    } else {
      unassignUserMutation.mutate({
        activityId,
        userId
      });
    }
  };
  const removeAssignee = (activityId: string, userId: string) => {
    unassignUserMutation.mutate({
      activityId,
      userId
    });
  };
  const getAssignedUsers = (activityId: string): string[] => {
    const assignment = assignments.find(a => a.activity_id === activityId);
    return assignment?.assigned_users || [];
  };
  const handleBatchToggle = (activityId: string) => {
    setSelectedActivities(prev => prev.includes(activityId) ? prev.filter(id => id !== activityId) : [...prev, activityId]);
  };
  const handleBatchAssign = () => {
    if (selectedActivities.length === 0) {
      toast.error('Seleziona almeno un\'attività');
      return;
    }
    setShowBatchDialog(true);
  };
  const batchAssignUserMutation = useMutation({
    mutationFn: async ({
      userIds
    }: {
      userIds: string[];
    }) => {
      const promises = selectedActivities.flatMap(activityId => userIds.map(userId => supabase.from('activity_time_tracking').insert({
        budget_item_id: activityId,
        user_id: userId
      })));
      await Promise.all(promises);

      // Check workload threshold for all assigned users
      const WORKLOAD_THRESHOLD = 40;
      const notifications = [];
      for (const userId of userIds) {
        const userActivities = activities.filter(activity => {
          const assignedUsers = getAssignedUsers(activity.id);
          return assignedUsers.includes(userId) || selectedActivities.includes(activity.id);
        });
        const totalHours = userActivities.reduce((sum, activity) => sum + activity.hours_worked, 0);
        if (totalHours > WORKLOAD_THRESHOLD) {
          const member = teamMembers.find(m => m.user_id === userId);
          const memberName = member ? `${member.first_name} ${member.last_name}` : 'Utente';
          notifications.push({
            user_id: userId,
            project_id: projectId,
            type: 'workload_alert',
            title: 'Carico di lavoro elevato',
            message: `${memberName} ha superato la soglia di ${WORKLOAD_THRESHOLD} ore con un totale di ${totalHours.toFixed(1)} ore assegnate.`,
            read: false
          });
        }
      }
      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['activity-assignments', projectId]
      });
      toast.success('Utenti assegnati con successo');
      setShowBatchDialog(false);
      setSelectedActivities([]);
      setBatchMode(false);
    },
    onError: () => {
      toast.error('Errore durante l\'assegnazione batch');
    }
  });
  const handleBatchSubmit = (userIds: string[]) => {
    batchAssignUserMutation.mutate({
      userIds
    });
  };

  // Update activity duration mutation
  const updateDurationMutation = useMutation({
    mutationFn: async ({
      activityId,
      durationDays
    }: {
      activityId: string;
      durationDays: number | null;
    }) => {
      const {
        error
      } = await supabase.from('budget_items').update({
        duration_days: durationDays
      }).eq('id', activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budget-items', projectId]
      });
      toast.success('Durata aggiornata');
    },
    onError: () => {
      toast.error('Errore nell\'aggiornamento della durata');
    }
  });

  // Update activity hours mutation
  const updateHoursMutation = useMutation({
    mutationFn: async ({
      activityId,
      hours
    }: {
      activityId: string;
      hours: number;
    }) => {
      const activity = activities.find(a => a.id === activityId);
      const hourlyRate = activity?.hourly_rate || 0;
      const totalCost = hours * hourlyRate;
      
      const { error } = await supabase.from('budget_items').update({
        hours_worked: hours,
        total_cost: totalCost
      }).eq('id', activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budget-items', projectId]
      });
      toast.success('Ore aggiornate');
    },
    onError: () => {
      toast.error('Errore nell\'aggiornamento delle ore');
    }
  });

  // Create new activity mutation
  const createActivityMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      category: string;
      hours: number;
      durationDays: number | null;
    }) => {
      const {
        data: maxOrderData
      } = await supabase.from('budget_items').select('display_order').eq('project_id', projectId).order('display_order', {
        ascending: false
      }).limit(1).maybeSingle();
      const nextOrder = (maxOrderData?.display_order || 0) + 1;
      const {
        error
      } = await supabase.from('budget_items').insert({
        project_id: projectId,
        activity_name: data.name,
        category: data.category,
        hours_worked: data.hours,
        hourly_rate: 0,
        total_cost: 0,
        display_order: nextOrder,
        is_custom_activity: true,
        is_product: false,
        duration_days: data.durationDays,
        created_from: 'project'
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budget-items', projectId]
      });
      toast.success('Attività creata con successo');
      setShowCreateDialog(false);
      setNewActivityName('');
      setNewActivityCategory('Management');
      setNewActivityHours(1);
      setNewActivityDuration(null);
    },
    onError: () => {
      toast.error('Errore nella creazione dell\'attività');
    }
  });

  // Delete activity mutation (only for custom activities)
  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      // First delete related time tracking entries
      await supabase.from('activity_time_tracking').delete().eq('budget_item_id', activityId);

      // Then delete the activity
      const {
        error
      } = await supabase.from('budget_items').delete().eq('id', activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budget-items', projectId]
      });
      queryClient.invalidateQueries({
        queryKey: ['activity-assignments', projectId]
      });
      toast.success('Attività eliminata');
    },
    onError: () => {
      toast.error('Errore nell\'eliminazione dell\'attività');
    }
  });
  const handleCreateActivity = () => {
    if (!newActivityName.trim()) return;
    createActivityMutation.mutate({
      name: newActivityName.trim(),
      category: newActivityCategory,
      hours: newActivityHours,
      durationDays: newActivityDuration
    });
  };

  // Update activity mutation (name and category)
  const updateActivityMutation = useMutation({
    mutationFn: async (data: {
      activityId: string;
      name: string;
      category: string;
    }) => {
      const { error } = await supabase
        .from('budget_items')
        .update({
          activity_name: data.name,
          category: data.category
        })
        .eq('id', data.activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budget-items', projectId]
      });
      toast.success('Attività aggiornata');
      setEditingActivity(null);
      setEditActivityName('');
      setEditActivityCategory('');
    },
    onError: () => {
      toast.error('Errore nell\'aggiornamento dell\'attività');
    }
  });

  const handleEditActivity = (activity: BudgetItem) => {
    setEditingActivity(activity);
    setEditActivityName(activity.activity_name);
    setEditActivityCategory(activity.category);
  };

  const handleSaveEditActivity = () => {
    if (!editingActivity || !editActivityName.trim()) return;
    updateActivityMutation.mutate({
      activityId: editingActivity.id,
      name: editActivityName.trim(),
      category: editActivityCategory
    });
  };

  // Create sub-activity mutation
  const createSubActivityMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      category: string;
      hours: number;
      durationDays: number | null;
      parentId: string;
    }) => {
      const {
        data: maxOrderData
      } = await supabase.from('budget_items').select('display_order').eq('project_id', projectId).order('display_order', {
        ascending: false
      }).limit(1).maybeSingle();
      const nextOrder = (maxOrderData?.display_order || 0) + 1;
      const {
        error
      } = await supabase.from('budget_items').insert({
        project_id: projectId,
        activity_name: data.name,
        category: data.category,
        hours_worked: data.hours,
        hourly_rate: 0,
        total_cost: 0,
        display_order: nextOrder,
        is_custom_activity: true,
        is_product: false,
        duration_days: data.durationDays,
        parent_id: data.parentId,
        created_from: 'project'
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budget-items', projectId]
      });
      toast.success('Sotto-attività creata con successo');
      setAddingSubActivityFor(null);
      setSubActivityName('');
      setSubActivityCategory('Management');
      setSubActivityHours(1);
      setSubActivityDuration(null);
    },
    onError: () => {
      toast.error('Errore nella creazione della sotto-attività');
    }
  });

  const handleCreateSubActivity = () => {
    if (!subActivityName.trim() || !addingSubActivityFor) return;
    createSubActivityMutation.mutate({
      name: subActivityName.trim(),
      category: subActivityCategory,
      hours: subActivityHours,
      durationDays: subActivityDuration,
      parentId: addingSubActivityFor
    });
  };

  // Group activities: parent activities with their sub-activities
  const groupedActivities = activities.reduce((acc, activity) => {
    if (!activity.parent_id) {
      // Parent activity
      acc.push({
        ...activity,
        subActivities: activities.filter(a => a.parent_id === activity.id)
      });
    }
    return acc;
  }, [] as (BudgetItem & { subActivities: BudgetItem[] })[]);
  const isLoading = activitiesLoading || membersLoading;
  if (isLoading) {
    return <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>;
  }
  return <div className="space-y-6">

      {/* Brief and Objective Section */}
      <Card>
        <CardHeader>
          <CardTitle>Informazioni progetto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Link brief</p>
            <div className="flex items-center gap-2">
              {briefLink ? (
                <>
                  <Button variant="outline" className="flex-1 justify-start" asChild>
                    <a href={briefLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Apri Brief
                    </a>
                  </Button>
                  <DriveFilePicker 
                    initialFolderId={clientDriveFolderId}
                    onSelect={async (file) => {
                      try {
                        const { error } = await supabase
                          .from("projects")
                          .update({ brief_link: file.url })
                          .eq("id", projectId);
                        if (error) throw error;
                        toast.success("Link brief aggiornato");
                        onBriefLinkUpdate?.();
                      } catch (err) {
                        console.error(err);
                        toast.error("Errore nell'aggiornamento del link brief");
                      }
                    }}
                    trigger={
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                </>
              ) : (
                <DriveFilePicker 
                  initialFolderId={clientDriveFolderId}
                  onSelect={async (file) => {
                    try {
                      const { error } = await supabase
                        .from("projects")
                        .update({ brief_link: file.url })
                        .eq("id", projectId);
                      if (error) throw error;
                      toast.success("Link brief aggiunto");
                      onBriefLinkUpdate?.();
                    } catch (err) {
                      console.error(err);
                      toast.error("Errore nell'aggiunta del link brief");
                    }
                  }}
                  trigger={
                    <Button variant="outline" className="gap-2">
                      <Folder className="h-4 w-4" />
                      Seleziona da Drive
                    </Button>
                  }
                />
              )}
            </div>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Attività previste</CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => setShowImportDialog(true)} variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-1" />
              Importa da modello
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Crea Attività
            </Button>
            {batchMode && canAssignActivities && <Button onClick={handleBatchAssign} disabled={selectedActivities.length === 0} size="sm">
                Assegna Selezionate ({selectedActivities.length})
              </Button>}
            {activities.length > 0 && canAssignActivities && <Button onClick={() => {
            setBatchMode(!batchMode);
            setSelectedActivities([]);
          }} variant={batchMode ? "default" : "outline"} size="sm">
              {batchMode ? 'Annulla' : 'Assegnazione multipla'}
              </Button>}
          </div>
        </CardHeader>
        <CardContent>
          {!canAssignActivities && activities.length > 0 && (
            <div className="mb-4 p-3 bg-muted/50 border border-border rounded-lg flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span>Solo il project leader, gli admin, i team leader e i coordinator possono assegnare le attività al team.</span>
            </div>
          )}
          {activities.length === 0 ? <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Nessuna attività presente. Crea la prima attività per questo progetto.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Crea Prima Attività
              </Button>
            </div> : <div className="space-y-4">
              {groupedActivities.map(activity => {
            const categoryColor = getCategoryBadgeColor(activity.category);
            const assignedUserIds = getAssignedUsers(activity.id);
            const assignedMembers = teamMembers.filter(m => assignedUserIds.includes(m.user_id));
            const hasAssignments = assignedUserIds.length > 0;
            const isSelected = selectedActivities.includes(activity.id);
            return <div key={activity.id} className="space-y-2">
                    <div className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                    {batchMode && <Checkbox checked={isSelected} onCheckedChange={() => handleBatchToggle(activity.id)} />}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {hasAssignments ? <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" /> : <UserX className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium text-foreground">
                          {activity.activity_name}
                        </span>
                        <Badge className={categoryColor}>
                          {activity.category}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditActivity(activity);
                          }}
                          title="Modifica attività"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {activity.subActivities.length > 0 && (
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedActivities(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(activity.id)) {
                                  newSet.delete(activity.id);
                                } else {
                                  newSet.add(activity.id);
                                }
                                return newSet;
                              });
                            }}
                          >
                            {expandedActivities.has(activity.id) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            <Badge variant="outline" className="text-xs">
                              {activity.subActivities.length} sotto-attività
                            </Badge>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {canEditHours ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <Input 
                              type="number" 
                              min={0} 
                              step={0.5}
                              value={activity.hours_worked} 
                              onChange={e => {
                                const value = parseFloat(e.target.value) || 0;
                                updateHoursMutation.mutate({
                                  activityId: activity.id,
                                  hours: value
                                });
                              }} 
                              className="w-16 h-7 text-xs" 
                            />
                            <span className="text-xs">ore</span>
                          </div>
                        ) : (
                          <span>{formatHours(activity.hours_worked)}</span>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <Input type="number" min={1} value={activity.duration_days || ''} onChange={e => {
                      const value = e.target.value ? parseInt(e.target.value) : null;
                      updateDurationMutation.mutate({
                        activityId: activity.id,
                        durationDays: value
                      });
                    }} placeholder="gg" className="w-20 h-7 text-xs" />
                          <span className="text-xs">giorni</span>
                        </div>
                      </div>
                      {activity.assignee_name && <div className="text-sm text-muted-foreground">
                          Figura prevista: <span className="font-medium text-foreground">{activity.assignee_name}</span>
                        </div>}
                      {assignedMembers.length > 0 && <div className="flex flex-wrap gap-2">
                          {assignedMembers.map(member => <Badge key={member.user_id} variant="secondary" className={canAssignActivities ? "gap-1 pr-1" : ""}>
                              {member.first_name} {member.last_name}
                              {canAssignActivities && <button
                                type="button"
                                className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeAssignee(activity.id, member.user_id);
                                }}
                                title="Rimuovi assegnatario"
                              >
                                <X className="h-3 w-3" />
                              </button>}
                            </Badge>)}
                        </div>}
                    </div>
                    {!batchMode && <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setAddingSubActivityFor(activity.id)}>
                          <CornerDownRight className="h-4 w-4 mr-1" />
                          Sotto-attività
                        </Button>
                        {canAssignActivities && <div className="w-44">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start" size="sm">
                                {assignedMembers.length > 0 ? `${assignedMembers.length} assegnati` : "Assegna..."}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2" align="end">
                              <div className="space-y-2">
                                {teamMembers.map(member => {
                          const isChecked = assignedUserIds.includes(member.user_id);
                          return <div key={member.user_id} className="flex items-center gap-2">
                                      <Checkbox id={`${activity.id}-${member.user_id}`} checked={isChecked} onCheckedChange={checked => handleAssigneeToggle(activity.id, member.user_id, checked as boolean)} />
                                      <label htmlFor={`${activity.id}-${member.user_id}`} className="text-sm cursor-pointer flex-1">
                                        {member.first_name} {member.last_name}
                                      </label>
                                    </div>;
                        })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>}
                        {activity.is_custom_activity && <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => {
                  if (window.confirm('Sei sicuro di voler eliminare questa attività?')) {
                    deleteActivityMutation.mutate(activity.id);
                  }
                }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>}
                      </div>}
                  </div>
                  
                  {/* Sub-activities */}
                  {expandedActivities.has(activity.id) && activity.subActivities.map(subActivity => {
                    const subCategoryColor = getCategoryBadgeColor(subActivity.category);
                    const subAssignedUserIds = getAssignedUsers(subActivity.id);
                    const subAssignedMembers = teamMembers.filter(m => subAssignedUserIds.includes(m.user_id));
                    const subHasAssignments = subAssignedUserIds.length > 0;
                    const subIsSelected = selectedActivities.includes(subActivity.id);
                    
                    return (
                      <div key={subActivity.id} className={`flex items-center gap-4 p-3 ml-8 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors ${subIsSelected ? 'ring-2 ring-primary' : ''}`}>
                        {batchMode && <Checkbox checked={subIsSelected} onCheckedChange={() => handleBatchToggle(subActivity.id)} />}
                        <CornerDownRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {subHasAssignments ? <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" /> : <UserX className="h-4 w-4 text-muted-foreground" />}
                            <span className="font-medium text-foreground text-sm">
                              {subActivity.activity_name}
                            </span>
                            <Badge className={subCategoryColor} variant="outline">
                              {subActivity.category}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditActivity(subActivity);
                              }}
                              title="Modifica sotto-attività"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {canEditHours ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <Input 
                                  type="number" 
                                  min={0} 
                                  step={0.5}
                                  value={subActivity.hours_worked} 
                                  onChange={e => {
                                    const value = parseFloat(e.target.value) || 0;
                                    updateHoursMutation.mutate({
                                      activityId: subActivity.id,
                                      hours: value
                                    });
                                  }} 
                                  className="w-14 h-6 text-xs" 
                                />
                                <span className="text-xs">ore</span>
                              </div>
                            ) : (
                              <span>{formatHours(subActivity.hours_worked)}</span>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <Input type="number" min={1} value={subActivity.duration_days || ''} onChange={e => {
                                const value = e.target.value ? parseInt(e.target.value) : null;
                                updateDurationMutation.mutate({
                                  activityId: subActivity.id,
                                  durationDays: value
                                });
                              }} placeholder="gg" className="w-16 h-6 text-xs" />
                              <span className="text-xs">gg</span>
                            </div>
                          </div>
                          {subAssignedMembers.length > 0 && <div className="flex flex-wrap gap-1">
                              {subAssignedMembers.map(member => <Badge key={member.user_id} variant="secondary" className={canAssignActivities ? "gap-1 text-xs pr-1" : "text-xs"}>
                                  {member.first_name} {member.last_name}
                                  {canAssignActivities && <button
                                    type="button"
                                    className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeAssignee(subActivity.id, member.user_id);
                                    }}
                                    title="Rimuovi assegnatario"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>}
                                </Badge>)}
                            </div>}
                        </div>
                        {!batchMode && <div className="flex items-center gap-2">
                            {canAssignActivities && <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm">
                                  {subAssignedMembers.length > 0 ? `${subAssignedMembers.length}` : "Assegna"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2" align="end">
                                <div className="space-y-2">
                                  {teamMembers.map(member => {
                                    const isChecked = subAssignedUserIds.includes(member.user_id);
                                    return <div key={member.user_id} className="flex items-center gap-2">
                                        <Checkbox id={`${subActivity.id}-${member.user_id}`} checked={isChecked} onCheckedChange={checked => handleAssigneeToggle(subActivity.id, member.user_id, checked as boolean)} />
                                        <label htmlFor={`${subActivity.id}-${member.user_id}`} className="text-sm cursor-pointer flex-1">
                                          {member.first_name} {member.last_name}
                                        </label>
                                      </div>;
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => {
                              if (window.confirm('Sei sicuro di voler eliminare questa sotto-attività?')) {
                                deleteActivityMutation.mutate(subActivity.id);
                              }
                            }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>}
                      </div>
                    );
                  })}
                </div>;
          })}
            </div>}
        </CardContent>
      </Card>

      {/* Batch Assignment Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna Utenti alle Attività Selezionate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Seleziona gli utenti da assegnare a {selectedActivities.length} attività
            </p>
            <div className="space-y-2">
              {teamMembers.map(member => <div key={member.user_id} className="flex items-center gap-2">
                  <Checkbox id={`batch-${member.user_id}`} onCheckedChange={checked => {
                const tempUserIds = Array.from(document.querySelectorAll<HTMLInputElement>('input[id^="batch-"]:checked')).map(el => el.id.replace('batch-', ''));
                if (checked) {
                  handleBatchSubmit([...tempUserIds, member.user_id]);
                }
              }} />
                  <label htmlFor={`batch-${member.user_id}`} className="text-sm cursor-pointer flex-1">
                    {member.first_name} {member.last_name}
                  </label>
                </div>)}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
              setShowBatchDialog(false);
              setSelectedActivities([]);
              setBatchMode(false);
            }}>
                Annulla
              </Button>
              <Button onClick={() => {
              const selectedUserIds = Array.from(document.querySelectorAll<HTMLInputElement>('input[id^="batch-"]:checked')).map(el => el.id.replace('batch-', ''));
              handleBatchSubmit(selectedUserIds);
            }}>
                Assegna
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Activity Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crea Nuova Attività</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome attività *</Label>
              <Input value={newActivityName} onChange={e => setNewActivityName(e.target.value)} placeholder="Es. Riunione settimanale" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={newActivityCategory} onValueChange={setNewActivityCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ore previste</Label>
                <Input type="number" value={newActivityHours} onChange={e => setNewActivityHours(parseFloat(e.target.value) || 0)} min={0.5} step={0.5} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Durata (giorni)</Label>
              <Input type="number" value={newActivityDuration || ''} onChange={e => setNewActivityDuration(e.target.value ? parseInt(e.target.value) : null)} min={1} placeholder="Opzionale" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateActivity} disabled={!newActivityName.trim() || createActivityMutation.isPending}>
              {createActivityMutation.isPending ? 'Creazione...' : 'Crea Attività'}
            </Button>
      </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Sub-Activity Dialog */}
      <Dialog open={!!addingSubActivityFor} onOpenChange={(open) => !open && setAddingSubActivityFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova Sotto-attività</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome sotto-attività *</Label>
              <Input value={subActivityName} onChange={e => setSubActivityName(e.target.value)} placeholder="Es. Revisione documento" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={subActivityCategory} onValueChange={setSubActivityCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ore previste</Label>
                <Input type="number" value={subActivityHours} onChange={e => setSubActivityHours(parseFloat(e.target.value) || 0)} min={0.5} step={0.5} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Durata (giorni)</Label>
              <Input type="number" value={subActivityDuration || ''} onChange={e => setSubActivityDuration(e.target.value ? parseInt(e.target.value) : null)} min={1} placeholder="Opzionale" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingSubActivityFor(null)}>
              Annulla
            </Button>
            <Button onClick={handleCreateSubActivity} disabled={!subActivityName.trim() || createSubActivityMutation.isPending}>
              {createSubActivityMutation.isPending ? 'Creazione...' : 'Crea Sotto-attività'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Activity Dialog */}
      <Dialog open={!!editingActivity} onOpenChange={(open) => !open && setEditingActivity(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica Attività</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome attività *</Label>
              <Input 
                value={editActivityName} 
                onChange={e => setEditActivityName(e.target.value)} 
                placeholder="Nome attività" 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={editActivityCategory} onValueChange={setEditActivityCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingActivity(null)}>
              Annulla
            </Button>
            <Button 
              onClick={handleSaveEditActivity} 
              disabled={!editActivityName.trim() || updateActivityMutation.isPending}
            >
              {updateActivityMutation.isPending ? 'Salvataggio...' : 'Salva Modifiche'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from Template Dialog */}
      <ImportActivitiesFromTemplateDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        projectId={projectId}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] });
        }}
      />
    </div>;
};