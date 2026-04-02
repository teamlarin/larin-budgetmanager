import { useState, useMemo } from 'react';
import { calculateSafeHours, calculateTemporalProgress } from '@/lib/timeUtils';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectDriveFolderSelector } from '@/components/ProjectDriveFolderSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Edit2, Check, X, AlertTriangle, TrendingUp, Clock, Euro, CalendarDays, ChevronDown, Users, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { toast } from 'sonner';
import { format, differenceInCalendarDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProjectTeamSelector } from '@/components/ProjectTeamSelector';
import { ProjectActivitiesManager } from '@/components/ProjectActivitiesManager';
import { ClientContactSelector } from '@/components/ClientContactSelector';
import { ProjectBudgetStats } from '@/components/ProjectBudgetStats';
import { ProjectTimesheet } from '@/components/ProjectTimesheet';
import { ActivityGanttChart } from '@/components/ActivityGanttChart';
import { ProjectAdditionalCosts } from '@/components/ProjectAdditionalCosts';
import { ProjectProgressUpdates } from '@/components/ProjectProgressUpdates';
import { ProgressUpdateDialog } from '@/components/ProgressUpdateDialog';
type ProjectWithDetails = Project & {
  clients?: {
    name: string;
    drive_folder_id?: string | null;
    drive_folder_name?: string | null;
  };
  client_contacts?: {
    id: string;
    first_name: string;
    last_name: string;
    role: string | null;
  };
  project_leader?: {
    first_name: string;
    last_name: string;
  } | null;
  profiles?: {
    first_name: string;
    last_name: string;
  };
  account_profiles?: {
    first_name: string;
    last_name: string;
  };
  quote_number?: string;
  manual_quote_number?: string;
};
const disciplineLabels: Record<string, string> = {
  content_creation_storytelling: 'Content Creation & Storytelling',
  paid_advertising_media_buying: 'Paid Advertising & Media Buying',
  website_landing_page_development: 'Website & Landing Page Development',
  brand_identity_visual_design: 'Brand Identity & Visual Design',
  social_media_management: 'Social Media Management',
  email_marketing_automation: 'Email Marketing & Automation',
  seo_content_optimization: 'SEO & Content Optimization',
  crm_customer_data_platform: 'CRM & Customer Data Platform',
  software_development_integration: 'Software Development & Integration',
  ai_implementation_automation: 'AI Implementation & Automation',
  strategic_consulting: 'Strategic Consulting'
};
const ProjectCanvas = () => {
  const {
    projectId
  } = useParams();
  const navigate = useNavigate();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [showProgressDialog, setShowProgressDialog] = useState(false);

  // Check if current user is a member (read-only access)
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user-role-and-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { role: null, id: null };
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      return { role: data?.role || 'member', id: user.id };
    }
  });

  const userRole = currentUserData?.role;
  const currentUserId = currentUserData?.id;
  const isMember = userRole === 'member';
  const isCoordinator = userRole === 'coordinator';
  const isAccount = userRole === 'account';
  const isAdmin = userRole === 'admin';
  const isExternal = userRole === 'external';

  // Fetch global settings for default thresholds
  const {
    data: globalSettings
  } = useQuery({
    queryKey: ['app-settings', 'projection_thresholds'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('app_settings').select('*').eq('setting_key', 'projection_thresholds').maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Get global threshold defaults
  const globalThresholds = globalSettings?.setting_value as unknown as {
    warning: number;
    critical: number;
  } | null;
  const defaultWarningThreshold = globalThresholds?.warning ?? 10;
  const defaultCriticalThreshold = globalThresholds?.critical ?? 25;

  // Fetch clients for dropdown
  const {
    data: clients = []
  } = useQuery({
    queryKey: ['clients-dropdown'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch users for dropdown (Project Leader)
  const {
    data: users = []
  } = useQuery({
    queryKey: ['users-dropdown'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('profiles').select('id, first_name, last_name').eq('approved', true).order('first_name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch account users filtered by admin/account roles
  const {
    data: accountUsers = []
  } = useQuery({
    queryKey: ['account-users-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_roles!inner(role)')
        .eq('approved', true)
        .is('deleted_at', null)
        .in('user_roles.role', ['admin', 'account'])
        .order('first_name');
      if (error) throw error;
      return data || [];
    }
  });

  const {
    data: project,
    isLoading,
    refetch
  } = useQuery<ProjectWithDetails>({
    queryKey: ['project-canvas', projectId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('projects').select('*, clients(name, drive_folder_id, drive_folder_name), client_contacts(id, first_name, last_name, role)').eq('id', projectId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Project not found');

      // Fetch project leader, creator and account profiles
      const userIds = [data.project_leader_id, data.user_id, data.account_user_id].filter(Boolean);
      const {
        data: profilesData
      } = await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds);
      const profilesMap = new Map(profilesData?.map(p => [p.id, {
        first_name: p.first_name,
        last_name: p.last_name
      }]) || []);

      // If manual_quote_number is set, use it. Otherwise fetch from quotes table for backward compatibility
      let quoteNumber = (data as any).manual_quote_number;
      if (!quoteNumber) {
        const {
          data: quoteData
        } = await supabase.from('quotes').select('quote_number').eq('project_id', projectId).order('created_at', {
          ascending: false
        }).limit(1).maybeSingle();
        quoteNumber = quoteData?.quote_number;
      }
      return {
        ...data,
        project_leader: data.project_leader_id ? profilesMap.get(data.project_leader_id) || null : null,
        profiles: profilesMap.get(data.user_id) || null,
        account_profiles: data.account_user_id ? profilesMap.get(data.account_user_id) || null : null,
        quote_number: quoteNumber
      };
    },
    enabled: !!projectId
  });

  // Fetch client contacts for dropdown based on selected client
  const {
    data: clientContacts = []
  } = useQuery({
    queryKey: ['client-contacts-dropdown', project?.client_id],
    queryFn: async () => {
      if (!project?.client_id) return [];
      const { data: assignments, error: assignError } = await (supabase as any)
        .from('client_contact_clients')
        .select('contact_id, is_primary')
        .eq('client_id', project.client_id);
      if (assignError || !assignments || assignments.length === 0) return [];
      const contactIds = assignments.map((a: any) => a.contact_id);
      const primaryMap = new Map(assignments.map((a: any) => [a.contact_id, a.is_primary]));
      const { data, error } = await supabase
        .from('client_contacts')
        .select('id, first_name, last_name, role')
        .in('id', contactIds)
        .order('first_name');
      if (error) throw error;
      return (data || []).sort((a, b) => {
        const aPrimary = primaryMap.get(a.id) ? 1 : 0;
        const bPrimary = primaryMap.get(b.id) ? 1 : 0;
        return bPrimary - aPrimary;
      });
    },
    enabled: !!project?.client_id
  });

  // === Fetch data for residual margin KPI ===
  const { data: overheadsData } = useQuery({
    queryKey: ['overheads-setting'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('setting_value').eq('setting_key', 'overheads').maybeSingle();
      if (data?.setting_value && typeof data.setting_value === 'object' && 'amount' in data.setting_value) {
        return Number((data.setting_value as { amount: number }).amount) || 0;
      }
      return 0;
    }
  });

  const { data: kpiBudgetItems } = useQuery({
    queryKey: ['budget-items-stats', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('budget_items').select('*').eq('project_id', projectId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  const { data: kpiTimeTracking } = useQuery({
    queryKey: ['time-tracking-stats', projectId],
    queryFn: async () => {
      const { data: items } = await supabase.from('budget_items').select('id').eq('project_id', projectId);
      if (!items || items.length === 0) return [];
      const { data, error } = await supabase.from('activity_time_tracking').select('*').in('budget_item_id', items.map(i => i.id));
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  const { data: kpiUserProfiles } = useQuery({
    queryKey: ['user-profiles-rates', projectId],
    queryFn: async () => {
      const userIds = [...new Set(kpiTimeTracking?.map(t => t.user_id) || [])];
      if (userIds.length === 0) return [];
      const { data, error } = await supabase.from('profiles').select('id, hourly_rate').in('id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!kpiTimeTracking && kpiTimeTracking.length > 0
  });

  const { data: kpiAdditionalCosts } = useQuery({
    queryKey: ['project-additional-costs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_additional_costs').select('amount').eq('project_id', projectId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  const marginData = useMemo(() => {
    const overheads = overheadsData || 0;
    const activitiesBudget = (project as any)?.manual_activities_budget != null
      ? Number((project as any).manual_activities_budget)
      : (kpiBudgetItems?.filter(i => !i.is_product).reduce((s, i) => s + Number(i.total_cost || 0), 0) || 0);
    const marginPct = Number(project?.margin_percentage || 0);
    const targetBudget = activitiesBudget * (1 - marginPct / 100);

    const userRates = new Map(kpiUserProfiles?.map(p => [p.id, Number(p.hourly_rate || 0)]) || []);
    const confirmedCosts = kpiTimeTracking?.reduce((sum, t) => {
      if (t.actual_start_time && t.actual_end_time) {
        const hours = calculateSafeHours(t.actual_start_time, t.actual_end_time);
        return sum + hours * ((userRates.get(t.user_id) || 0) + overheads);
      }
      return sum;
    }, 0) || 0;
    const externalCosts = kpiAdditionalCosts?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0;
    const totalSpent = confirmedCosts + externalCosts;
    const residualPct = activitiesBudget > 0 ? ((activitiesBudget - totalSpent) / activitiesBudget) * 100 : 100;
    const remainingToTarget = targetBudget - totalSpent;
    return { residualPct, remainingToTarget, targetBudget, marginPct, activitiesBudget, totalSpent };
  }, [project, kpiBudgetItems, kpiTimeTracking, kpiUserProfiles, kpiAdditionalCosts, overheadsData]);


  const startEditing = (field: string, currentValue: any) => {
    setEditingField(field);
    setEditValues({
      [field]: currentValue || ''
    });
  };
  const cancelEditing = () => {
    setEditingField(null);
    setEditValues({});
  };
  const saveField = async (field: string) => {
    if (!project) return;
    try {
      let value = editValues[field];

      // Handle boolean conversion for is_billable field
      if (field === 'is_billable') {
        value = value === 'true';
      }

      // Handle 'none' or empty value for nullable fields (convert to null)
      if ((field === 'account_user_id' || field === 'client_contact_id' || field === 'secondary_objective') && (value === 'none' || value === '')) {
        value = null;
      }

      // Prevent removing required fields
      if (field === 'project_leader_id' && !value) {
        toast.error('Il Project Leader è obbligatorio');
        return;
      }
      if (field === 'client_id' && !value) {
        toast.error('Il Cliente è obbligatorio');
        return;
      }
      const updateData: any = {
        [field]: value
      };
      const {
        error
      } = await supabase.from('projects').update(updateData).eq('id', project.id);
      if (error) throw error;

      // If project_status changed to 'completato', auto-complete activities + trigger webhook & Slack
      if (field === 'project_status' && value === 'completato') {
        // Auto-complete all activities for this project in users' calendars
        try {
          const { data: budgetItems } = await supabase
            .from('budget_items')
            .select('id, assignee_id')
            .eq('project_id', project.id)
            .not('assignee_id', 'is', null);

          if (budgetItems && budgetItems.length > 0) {
            const completions = budgetItems.map(item => ({
              user_id: item.assignee_id!,
              budget_item_id: item.id,
              completed_at: new Date().toISOString(),
            }));
            await supabase
              .from('user_activity_completions')
              .upsert(completions, { onConflict: 'user_id,budget_item_id' });
          }
        } catch (autoCompleteError) {
          console.error('Error auto-completing activities:', autoCompleteError);
        }

        try {
          await supabase.functions.invoke('project-completed-webhook', {
            body: { project_id: project.id },
          });
        } catch (webhookError) {
          console.error('Error triggering project completed webhook:', webhookError);
        }

        // Fetch residual margin for Slack notification
        let residualMargin: number | undefined;
        try {
          const { data: marginsResponse } = await supabase.functions.invoke('calculate-project-margins', {
            body: { project_ids: [project.id] }
          });
          if (marginsResponse?.[project.id]) {
            residualMargin = marginsResponse[project.id].residualMargin;
          }
        } catch (e) {
          console.error('Error fetching margins for Slack:', e);
        }

        const leaderName = project.project_leader
          ? `${project.project_leader.first_name || ''} ${project.project_leader.last_name || ''}`.trim()
          : undefined;
        const accName = project.account_profiles
          ? `${project.account_profiles.first_name || ''} ${project.account_profiles.last_name || ''}`.trim()
          : undefined;
        const quoteNum = (project as any).manual_quote_number || project.quote_number;

        supabase.functions.invoke('send-slack-notification', {
          body: {
            type: 'project_completed',
            project_name: project.name,
            client_name: project.clients?.name,
            project_leader_name: leaderName || undefined,
            account_name: accName || undefined,
            quote_number: quoteNum || undefined,
            residual_margin: residualMargin,
          },
        }).then(({ error: slackErr }) => {
          if (slackErr) console.error('Slack notification error:', slackErr);
        });
      }

      // If project_status changed to 'aperto', send Slack notification to new project channel
      if (field === 'project_status' && value === 'aperto') {
        const leaderName = project.project_leader
          ? `${project.project_leader.first_name || ''} ${project.project_leader.last_name || ''}`.trim()
          : undefined;
        const accName = project.account_profiles
          ? `${project.account_profiles.first_name || ''} ${project.account_profiles.last_name || ''}`.trim()
          : undefined;
        const quoteNum = (project as any).manual_quote_number || project.quote_number;

        // Fetch team members for Slack notification
        const { data: teamData } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', project.id);
        let teamNames: string[] = [];
        if (teamData && teamData.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .in('id', teamData.map(m => m.user_id));
          teamNames = (profiles || []).map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim()).filter(Boolean);
        }

        supabase.functions.invoke('send-slack-notification', {
          body: {
            type: 'project_opened',
            project_name: project.name,
            client_name: project.clients?.name,
            project_leader_name: leaderName || undefined,
            account_name: accName || undefined,
            quote_number: quoteNum || undefined,
            discipline: project.discipline ? (disciplineLabels[project.discipline] || project.discipline) : undefined,
            start_date: project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy') : undefined,
            end_date: project.end_date ? format(new Date(project.end_date), 'dd/MM/yyyy') : undefined,
            team_members: teamNames.length > 0 ? teamNames : undefined,
          },
        }).then(({ error: slackErr }) => {
          if (slackErr) console.error('Slack notification error:', slackErr);
        });
      }

      toast.success('Campo aggiornato con successo');
      refetch();
      cancelEditing();
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Errore durante l\'aggiornamento');
    }
  };
  if (isLoading) {
    return <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>;
  }
  if (!project) {
    return <div className="container mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">Progetto non trovato</p>
          </CardContent>
        </Card>
      </div>;
  }
  const creatorName = project.profiles ? `${project.profiles.first_name} ${project.profiles.last_name}`.trim() : 'N/A';
  const accountName = project.account_profiles ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim() : 'N/A';
  const isProjectLeader = currentUserId && project.project_leader_id === currentUserId;
  const EditableField = ({
    label,
    field,
    value,
    type = 'text',
    options,
    required = false,
    allowEdit = false
  }: {
    label: string;
    field: string;
    value: any;
    type?: 'text' | 'textarea' | 'select' | 'date' | 'number';
    options?: {
      value: string;
      label: string;
    }[];
    required?: boolean;
    allowEdit?: boolean;
  }) => {
    const isEditing = editingField === field;

    // Get display value - for select fields, show the label instead of the raw value
    const getDisplayValue = () => {
      if (type === 'select' && options && value) {
        const option = options.find(opt => opt.value === value);
        return option?.label || value;
      }
      return value;
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveField(field);
      } else if (e.key === 'Escape') {
        cancelEditing();
      }
    };

    // Members, coordinators, accounts and external users can only view, not edit (unless allowEdit is true)
    if ((isMember || isCoordinator || isAccount || isExternal) && !allowEdit) {
      return <div>
          <p className="text-sm text-muted-foreground mb-1">
            {label}{required && <span className="text-destructive ml-1">*</span>}
          </p>
          <div className="p-2 rounded">
            <p className="font-medium">{getDisplayValue() || 'N/A'}</p>
          </div>
        </div>;
    }

    return <div>
        <p className="text-sm text-muted-foreground mb-1">
          {label}{required && <span className="text-destructive ml-1">*</span>}
        </p>
        {isEditing ? <div className="flex items-center gap-2">
            {type === 'textarea' ? <Textarea 
              value={editValues[field] || ''} 
              onChange={e => setEditValues({
                ...editValues,
                [field]: e.target.value
              })} 
              onKeyDown={handleKeyDown}
              className="flex-1" 
              rows={3} 
              autoFocus
            /> : type === 'select' && options ? <Select value={editValues[field] || ''} onValueChange={val => setEditValues({
          ...editValues,
          [field]: val
        })}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select> : <Input 
                type={type} 
                value={editValues[field] || ''} 
                onChange={e => setEditValues({
                  ...editValues,
                  [field]: e.target.value
                })} 
                onKeyDown={handleKeyDown}
                className="flex-1" 
                autoFocus
              />}
            <Button size="icon" variant="ghost" onClick={() => saveField(field)}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={cancelEditing}>
              <X className="h-4 w-4" />
            </Button>
          </div> : <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer" onClick={() => startEditing(field, value)}>
            <p className="font-medium">{getDisplayValue() || 'N/A'}</p>
            <Edit2 className="h-4 w-4 text-muted-foreground" />
          </div>}
      </div>;
  };
  return <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/approved-projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            {isAdmin && editingField === 'name' ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editValues.name || ''}
                  onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveField('name');
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  className="text-2xl font-bold h-10"
                  autoFocus
                />
                <Button size="icon" variant="ghost" onClick={() => saveField('name')}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={cancelEditing}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="page-title">{project.name}</h1>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => startEditing('name', project.name)}
                  >
                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            )}
            <p className="page-subtitle">Canvas & Report Strategico</p>
          </div>
        </div>
        {/* Show Drive folder selector for non-members/accounts OR for project leaders */}
        {(!isMember && !isAccount) || (currentUserId && project.project_leader_id === currentUserId) ? (
          <ProjectDriveFolderSelector
            projectId={project.id}
            currentFolderId={(project as any).drive_folder_id}
            currentFolderName={(project as any).drive_folder_name}
            clientFolderId={project.clients?.drive_folder_id}
            onFolderLinked={refetch}
          />
        ) : null}
      </div>

      <Tabs defaultValue={isExternal ? "canvas" : "report"} className="space-y-6">
        <TabsList>
          {!isExternal && <TabsTrigger value="report">Report & Analytics</TabsTrigger>}
          <TabsTrigger value="canvas">Canvas e Attività</TabsTrigger>
          {!isExternal && <TabsTrigger value="timesheet">Timesheet</TabsTrigger>}
          {!isExternal && <TabsTrigger value="external-costs">Costi esterni</TabsTrigger>}
          {!isExternal && <TabsTrigger value="updates">Update</TabsTrigger>}
        </TabsList>

        <TabsContent value="report" className="space-y-6">
          {/* === KPI Summary Bar === */}
          {(() => {
            // Recalculate progress for recurring/pack like in Progresso & Timeline
            let progress = project.progress || 0;
            const billingType = project.billing_type;
            if (billingType === 'recurring' && project.start_date && project.end_date) {
              const today = new Date();
              const start = new Date(project.start_date);
              const end = new Date(project.end_date);
              const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
              const daysElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
              progress = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));
            }
            const marginTarget = project.margin_percentage || 0;
            const totalBudget = Number(project.total_budget || 0);
            const isNoBudgetType = project.billing_type === 'interno' || project.billing_type === 'pre_sales' || project.billing_type === 'consumptive';
            
            // Days remaining
            const daysRemaining = project.end_date 
              ? differenceInCalendarDays(new Date(project.end_date), new Date()) 
              : null;
            const deadlineUrgent = daysRemaining !== null && daysRemaining <= 7;
            const deadlineWarning = daysRemaining !== null && daysRemaining > 7 && daysRemaining <= 14;

            return (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {/* Progress */}
                <Card variant="stats">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Progresso</p>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold">{progress}%</p>
                      {progress >= 85 && <Badge variant="yellow" className="text-[10px] px-1.5 py-0">In chiusura</Badge>}
                    </div>
                    <Progress value={progress} className="mt-2 h-2" />
                  </CardContent>
                </Card>

                {/* Residual Margin */}
                <Card variant="stats">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Margine residuo</p>
                      <TrendingUp className={`h-4 w-4 ${!isNoBudgetType && marginData.residualPct < marginData.marginPct ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </div>
                    {isNoBudgetType ? (
                      <p className="text-sm text-muted-foreground italic mt-1">N/A per {project.billing_type}</p>
                    ) : (
                      <>
                        <p className={`text-2xl font-bold ${marginData.residualPct < marginData.marginPct ? 'text-destructive' : marginData.residualPct >= marginData.marginPct ? 'text-green-600' : ''}`}>
                          {marginData.residualPct.toFixed(1)}%
                        </p>
                        <p className={`text-xs mt-1 ${marginData.remainingToTarget < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          €{Math.round(marginData.remainingToTarget).toLocaleString('it-IT')} rimanente al target
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          obiettivo: {marginData.marginPct}%
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Deadline */}
                <Card variant="stats">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Scadenza</p>
                      <CalendarDays className={`h-4 w-4 ${deadlineUrgent ? 'text-destructive' : deadlineWarning ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                    </div>
                    {daysRemaining !== null ? (
                      <>
                        <p className={`text-2xl font-bold ${deadlineUrgent ? 'text-destructive' : deadlineWarning ? 'text-yellow-600' : ''}`}>
                          {daysRemaining > 0 ? `${daysRemaining} gg` : daysRemaining === 0 ? 'Oggi' : `${Math.abs(daysRemaining)} gg fa`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(project.end_date!), 'dd/MM/yyyy')}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground italic mt-1">Non impostata</p>
                    )}
                  </CardContent>
                </Card>

                {/* Budget */}
                <Card variant="stats">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Budget totale</p>
                      <Euro className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold">
                      €{totalBudget.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Number(project.total_hours || 0)} ore previste
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* === Sezione A: Dati operativi === */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Progresso & Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Progresso & Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logica progresso per tipologia progetto */}
                {(() => {
                  const billingType = project.billing_type;
                  const isInterno = billingType === 'interno';
                  const isConsumptive = billingType === 'consumptive';
                  const isRecurring = billingType === 'recurring';
                  const isPack = billingType === 'pack';
                  
                  if (isInterno || isConsumptive) {
                    return (
                      <div className="text-sm text-muted-foreground italic">
                        La % di completamento non è applicabile per progetti {isInterno ? 'interni' : 'consumptive'}
                      </div>
                    );
                  }
                  
                  let calculatedProgress = project.progress || 0;
                  let progressDescription = '';
                  
                  if (isRecurring && project.start_date && project.end_date) {
                    const today = new Date();
                    const start = new Date(project.start_date);
                    const end = new Date(project.end_date);
                    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                    const daysElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    calculatedProgress = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));
                    progressDescription = "Calcolato automaticamente dall'avanzamento temporale";
                  } else if (isPack) {
                    progressDescription = "Calcolato automaticamente: ore contabili / ore previste attività";
                  }
                  
                  if (isRecurring || isPack) {
                    const isOvertime = isPack && calculatedProgress > 100;
                    return (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Completamento (%)</p>
                          <div className="flex items-center gap-2">
                            <p 
                              className={`text-lg font-medium cursor-pointer hover:underline ${isOvertime ? 'text-destructive' : ''}`}
                              onClick={() => setShowProgressDialog(true)}
                            >
                              {calculatedProgress}%
                            </p>
                            {isOvertime && (
                              <div className="flex items-center gap-1 text-destructive text-xs">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Superamento ore</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{progressDescription}</p>
                        </div>
                        <div className="mt-2">
                          <Progress 
                            value={Math.min(calculatedProgress, 100)} 
                            className={isOvertime ? '[&>div]:bg-destructive' : ''}
                          />
                        </div>
                      </>
                    );
                  }
                  
                  return (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Completamento (%)</p>
                        <p 
                          className="text-lg font-medium cursor-pointer hover:underline"
                          onClick={() => setShowProgressDialog(true)}
                        >
                          {project.progress || 0}%
                        </p>
                      </div>
                      <div className="mt-2">
                        <Progress value={project.progress || 0} />
                      </div>
                    </>
                  );
                })()}
                
                {/* Date e stato */}
                {isCoordinator ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Data Inizio</p>
                      <div className="p-2 rounded">
                        <p className="font-medium">{project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy') : 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Data Fine Prevista</p>
                      <div className="p-2 rounded">
                        <p className="font-medium">{project.end_date ? format(new Date(project.end_date), 'dd/MM/yyyy') : 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Stato</p>
                      <div className="p-2 rounded">
                        <p className="font-medium">{project.project_status === 'in_partenza' ? 'In Partenza' : project.project_status === 'aperto' ? 'Aperto' : project.project_status === 'da_fatturare' ? 'Da Fatturare' : project.project_status === 'completato' ? 'Completato' : 'In Partenza'}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <EditableField label="Data Inizio" field="start_date" value={project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy') : ''} type="date" />
                    <EditableField label="Data Fine Prevista" field="end_date" value={project.end_date ? format(new Date(project.end_date), 'dd/MM/yyyy') : ''} type="date" />
                    <EditableField label="Stato" field="project_status" value={project.project_status === 'in_partenza' ? 'In Partenza' : project.project_status === 'aperto' ? 'Aperto' : project.project_status === 'da_fatturare' ? 'Da Fatturare' : project.project_status === 'completato' ? 'Completato' : 'In Partenza'} type="select" options={[{
                      value: 'in_partenza',
                      label: 'In Partenza'
                    }, {
                      value: 'aperto',
                      label: 'Aperto'
                    }, {
                      value: 'da_fatturare',
                      label: 'Da Fatturare'
                    }, {
                      value: 'completato',
                      label: 'Completato'
                    }]} />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Metriche finanziarie */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Euro className="h-5 w-5" /> Metriche finanziarie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Budget totale</p>
                  <p className="text-2xl font-bold">
                    €{Number(project.total_budget || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {isCoordinator ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Marginalità obiettivo (%)</p>
                      <div className="p-2 rounded">
                        <p className="font-medium">{project.margin_percentage ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Fatturabile</p>
                      <div className="p-2 rounded">
                        <p className="font-medium">{project.is_billable !== false ? 'Sì' : 'No'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Tipologia Progetto</p>
                      <div className="p-2 rounded">
                        <p className="font-medium">{project.billing_type === 'one_shot' ? 'One-Shot' : project.billing_type === 'recurring' ? 'Recurring' : project.billing_type === 'consumptive' ? 'Consumptive' : project.billing_type === 'pack' ? 'Pack' : project.billing_type === 'pre_sales' ? 'Pre Sales' : project.billing_type === 'interno' ? 'Interno' : 'N/A'}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <EditableField label="Marginalità obiettivo (%)" field="margin_percentage" value={project.margin_percentage} type="number" />
                    <EditableField label="Fatturabile" field="is_billable" value={project.is_billable !== undefined ? String(project.is_billable) : 'true'} type="select" options={[{
                      value: 'true',
                      label: 'Sì'
                    }, {
                      value: 'false',
                      label: 'No'
                    }]} />
                    <EditableField label="Tipologia Progetto" field="billing_type" value={project.billing_type} type="select" options={[{
                      value: 'one_shot',
                      label: 'One-Shot'
                    }, {
                      value: 'recurring',
                      label: 'Recurring'
                    }, {
                      value: 'consumptive',
                      label: 'Consumptive'
                    }, {
                      value: 'pack',
                      label: 'Pack'
                    }, {
                      value: 'pre_sales',
                      label: 'Pre Sales'
                    }, {
                      value: 'interno',
                      label: 'Interno'
                    }]} />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* === Sezione B: Dati di contesto (collapsible) === */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="h-5 w-5" /> Progetto & Team
                  </CardTitle>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid gap-6 md:grid-cols-2 pt-0">
                  {/* Info Progetto */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Informazioni Progetto</h4>
                    <EditableField label="Cliente" field="client_id" value={project.client_id} type="select" options={clients.map(c => ({
                      value: c.id,
                      label: c.name
                    }))} required />
                    {project.client_id && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Contatto di riferimento<span className="text-destructive ml-1">*</span>
                        </p>
                        {(isMember || isCoordinator || isAccount) ? (
                          <div className="p-2 rounded">
                            <p className="font-medium">
                              {project.client_contacts 
                                ? `${project.client_contacts.first_name} ${project.client_contacts.last_name}${project.client_contacts.role ? ` - ${project.client_contacts.role}` : ''}`
                                : 'N/A'}
                            </p>
                          </div>
                        ) : (
                          <ClientContactSelector
                            clientId={project.client_id}
                            value={(project as any).client_contact_id || ''}
                            onValueChange={async (contactId) => {
                              const { error } = await supabase
                                .from('projects')
                                .update({ client_contact_id: contactId })
                                .eq('id', project.id);
                              if (error) {
                                toast.error('Errore durante l\'aggiornamento del contatto');
                              } else {
                                toast.success('Contatto aggiornato');
                                refetch();
                              }
                            }}
                            contacts={clientContacts}
                            onContactCreated={refetch}
                            triggerClassName="w-full"
                          />
                        )}
                      </div>
                    )}
                    <EditableField 
                      label="Numero preventivo" 
                      field="manual_quote_number" 
                      value={(project as any).manual_quote_number || project.quote_number} 
                      type="text" 
                    />
                    <EditableField label="Disciplina" field="discipline" value={project.discipline} type="select" options={Object.entries(disciplineLabels).map(([value, label]) => ({
                      value,
                      label
                    }))} allowEdit={!!isProjectLeader} />
                    <EditableField label="Obiettivo" field="objective" value={project.objective} type="select" options={[{
                      value: 'Brand positioning & Awareness',
                      label: 'Brand positioning & Awareness'
                    }, {
                      value: 'Lead generation & Acquisition',
                      label: 'Lead generation & Acquisition'
                    }, {
                      value: 'Customer experience & Digital Transformation',
                      label: 'Customer experience & Digital Transformation'
                    }, {
                      value: 'Customer retention & Loyalty',
                      label: 'Customer retention & Loyalty'
                    }, {
                      value: 'Sales enablement & Conversion',
                      label: 'Sales enablement & Conversion'
                    }, {
                      value: 'Operational efficiency & AI Adoption',
                      label: 'Operational efficiency & AI Adoption'
                    }]} allowEdit={!!isProjectLeader} />
                    <EditableField label="Obiettivo secondario" field="secondary_objective" value={(project as any).secondary_objective || 'none'} type="select" options={[{
                      value: 'none',
                      label: 'Nessuno'
                    }, {
                      value: 'Brand positioning & Awareness',
                      label: 'Brand positioning & Awareness'
                    }, {
                      value: 'Lead generation & Acquisition',
                      label: 'Lead generation & Acquisition'
                    }, {
                      value: 'Customer experience & Digital Transformation',
                      label: 'Customer experience & Digital Transformation'
                    }, {
                      value: 'Customer retention & Loyalty',
                      label: 'Customer retention & Loyalty'
                    }, {
                      value: 'Sales enablement & Conversion',
                      label: 'Sales enablement & Conversion'
                    }, {
                      value: 'Operational efficiency & AI Adoption',
                      label: 'Operational efficiency & AI Adoption'
                    }]} />
                  </div>

                  {/* Team */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Users className="h-4 w-4" /> Team</h4>
                    {isCoordinator ? (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Project Leader<span className="text-destructive ml-1">*</span></p>
                          <div className="p-2 rounded">
                            <p className="font-medium">{project.project_leader ? `${project.project_leader.first_name} ${project.project_leader.last_name}` : 'N/A'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Account</p>
                          <div className="p-2 rounded">
                            <p className="font-medium">{accountName !== 'N/A' ? accountName : 'Nessuno'}</p>
                          </div>
                        </div>
                        <ProjectTeamSelector projectId={project.id} projectLeaderId={project.project_leader_id} onUpdate={refetch} readOnly={true} />
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Area</p>
                          <div className="p-2 rounded">
                            <p className="font-medium">{project.area === 'marketing' ? 'Marketing' : project.area === 'tech' ? 'Tech' : project.area === 'branding' ? 'Branding' : project.area === 'sales' ? 'Sales' : project.area === 'struttura' ? 'Struttura' : project.area === 'ai' ? 'Jarvis' : project.area || 'N/A'}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <EditableField label="Project Leader" field="project_leader_id" value={project.project_leader_id} type="select" options={users.map(u => ({
                          value: u.id,
                          label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Utente'
                        }))} required />
                        <EditableField label="Account" field="account_user_id" value={project.account_user_id || 'none'} type="select" options={[{
                          value: 'none',
                          label: 'Nessuno'
                        }, ...users.filter(u => u.id).map(u => ({
                          value: u.id,
                          label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Utente'
                        }))]} />
                        <ProjectTeamSelector projectId={project.id} projectLeaderId={project.project_leader_id} onUpdate={refetch} readOnly={isMember} />
                        <EditableField label="Area" field="area" value={project.area} type="select" options={[{
                          value: 'marketing',
                          label: 'Marketing'
                        }, {
                          value: 'tech',
                          label: 'Tech'
                        }, {
                          value: 'branding',
                          label: 'Branding'
                        }, {
                          value: 'sales',
                          label: 'Sales'
                        }, {
                          value: 'struttura',
                          label: 'Struttura'
                        }, {
                          value: 'ai',
                          label: 'Jarvis'
                        }, {
                          value: 'interno',
                          label: 'Interno'
                        }]} />
                      </>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Budget Statistics */}
          <ProjectBudgetStats projectId={project.id} totalBudget={Number(project.total_budget || 0)} totalHours={Number(project.total_hours || 0)} marginPercentage={Number(project.margin_percentage || 0)} startDate={project.start_date} endDate={project.end_date} projectionWarningThreshold={Number((project as any).projection_warning_threshold ?? defaultWarningThreshold)} projectionCriticalThreshold={Number((project as any).projection_critical_threshold ?? defaultCriticalThreshold)} manualActivitiesBudget={(project as any).manual_activities_budget != null ? Number((project as any).manual_activities_budget) : null} onBudgetUpdate={() => refetch()} readOnly={isMember || isCoordinator} />
        </TabsContent>

        <TabsContent value="canvas" className="space-y-4">
          <ProjectActivitiesManager projectId={projectId!} briefLink={project.brief_link} objective={project.objective} secondaryObjective={(project as any).secondary_objective} description={project.description} onBriefLinkUpdate={() => refetch()} onDescriptionUpdate={() => refetch()} clientDriveFolderId={project.clients?.drive_folder_id} />
          <ActivityGanttChart projectId={projectId!} projectStartDate={project.start_date} projectEndDate={project.end_date} projectName={project.name} />
        </TabsContent>

        <TabsContent value="timesheet" className="space-y-4">
          <ProjectTimesheet projectId={projectId!} />
        </TabsContent>

        <TabsContent value="external-costs" className="space-y-4">
          <ProjectAdditionalCosts projectId={projectId!} />
        </TabsContent>

        <TabsContent value="updates" className="space-y-4">
          <ProjectProgressUpdates
            projectId={projectId!}
            projectName={project.name}
            currentProgress={project.billing_type === 'recurring' ? calculateTemporalProgress(project.start_date, project.end_date) : (project.billing_type === 'interno' || project.billing_type === 'consumptive') ? 0 : (project.progress || 0)}
            clientName={project.clients?.name}
            projectLeaderId={project.project_leader_id}
            accountUserId={project.account_user_id}
            projectBillingType={project.billing_type}
          />
        </TabsContent>
      </Tabs>

      <ProgressUpdateDialog
        open={showProgressDialog}
        onOpenChange={setShowProgressDialog}
        projectId={projectId!}
        projectName={project.name}
        currentProgress={project.billing_type === 'recurring' ? calculateTemporalProgress(project.start_date, project.end_date) : (project.billing_type === 'interno' || project.billing_type === 'consumptive') ? 0 : (project.progress || 0)}
        onSaved={(newProgress) => {
          refetch();
        }}
        clientName={project.clients?.name}
        projectLeaderId={project.project_leader_id}
        accountUserId={project.account_user_id}
        projectBillingType={project.billing_type}
      />
    </div>;
};
export default ProjectCanvas;