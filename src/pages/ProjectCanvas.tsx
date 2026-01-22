import { useState } from 'react';
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
import { ArrowLeft, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ProjectTeamSelector } from '@/components/ProjectTeamSelector';
import { ProjectActivitiesManager } from '@/components/ProjectActivitiesManager';
import { ProjectBudgetStats } from '@/components/ProjectBudgetStats';
import { ProjectTimesheet } from '@/components/ProjectTimesheet';
import { ActivityGanttChart } from '@/components/ActivityGanttChart';
import { ProjectAdditionalCosts } from '@/components/ProjectAdditionalCosts';
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

  // Check if current user is a member (read-only access)
  const { data: userRole } = useQuery({
    queryKey: ['current-user-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.role || 'member';
    }
  });

  const isMember = userRole === 'member';

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

  // Fetch users for dropdown (Project Leader and Account)
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

      // Fetch creator and account profiles
      const userIds = [data.user_id, data.account_user_id].filter(Boolean);
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
      const {
        data,
        error
      } = await supabase.from('client_contacts').select('id, first_name, last_name, role').eq('client_id', project.client_id).order('is_primary', { ascending: false }).order('first_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!project?.client_id
  });
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
      if (field === 'user_id' && !value) {
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
  const EditableField = ({
    label,
    field,
    value,
    type = 'text',
    options,
    required = false
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

    // Members can only view, not edit
    if (isMember) {
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
            <h1 className="page-title">{project.name}</h1>
            <p className="page-subtitle">Canvas & Report Strategico</p>
          </div>
        </div>
        {!isMember && (
          <ProjectDriveFolderSelector
            projectId={project.id}
            currentFolderId={(project as any).drive_folder_id}
            currentFolderName={(project as any).drive_folder_name}
            clientFolderId={project.clients?.drive_folder_id}
            onFolderLinked={refetch}
          />
        )}
      </div>

      <Tabs defaultValue="report" className="space-y-6">
        <TabsList>
          <TabsTrigger value="report">Report & Analytics</TabsTrigger>
          <TabsTrigger value="canvas">Canvas e Attività</TabsTrigger>
          <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
          <TabsTrigger value="external-costs">Costi esterni</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informazioni Progetto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EditableField label="Cliente" field="client_id" value={project.client_id} type="select" options={clients.map(c => ({
                value: c.id,
                label: c.name
              }))} required />
                {clientContacts.length > 0 && (
                  <EditableField 
                    label="Contatto di riferimento" 
                    field="client_contact_id" 
                    value={(project as any).client_contact_id || 'none'} 
                    type="select" 
                    options={[
                      { value: 'none', label: 'Nessuno' },
                      ...clientContacts.map(c => ({
                        value: c.id,
                        label: `${c.first_name} ${c.last_name}${c.role ? ` - ${c.role}` : ''}`
                      }))
                    ]} 
                  />
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
              }))} />
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
              }]} />
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EditableField label="Project Leader" field="user_id" value={project.user_id} type="select" options={users.map(u => ({
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
                <ProjectTeamSelector projectId={project.id} projectLeaderId={project.user_id} onUpdate={refetch} readOnly={isMember} />
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
              }]} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progresso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logica progresso per tipologia progetto */}
                {(() => {
                  const billingType = project.billing_type;
                  const isInterno = billingType === 'interno';
                  const isConsumptive = billingType === 'consumptive';
                  const isRecurring = billingType === 'recurring';
                  const isPack = billingType === 'pack';
                  
                  // Non mostrare progress per interno e consumptive
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
                    // Per i pack, il progresso è calcolato dal trigger DB (ore contabili / ore previste)
                    progressDescription = "Calcolato automaticamente: ore contabili / ore previste attività";
                  }
                  
                  // Pack e Recurring mostrano progresso auto-calcolato
                  if (isRecurring || isPack) {
                    const isOvertime = isPack && calculatedProgress > 100;
                    return (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">Completamento (%)</p>
                          <div className="flex items-center gap-2">
                            <p className={`text-lg font-medium ${isOvertime ? 'text-destructive' : ''}`}>
                              {calculatedProgress}%
                            </p>
                            {isOvertime && (
                              <div className="flex items-center gap-1 text-destructive bg-destructive/10 px-2 py-0.5 rounded-full text-xs font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                Sforamento ore
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
                  
                  // One-shot, pre_sales e altri: editabile manualmente
                  return (
                    <>
                      <EditableField label="Completamento (%)" field="progress" value={project.progress} type="number" />
                      <div className="mt-2">
                        <Progress value={project.progress || 0} />
                      </div>
                    </>
                  );
                })()}
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Metriche finanziarie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Budget totale</p>
                  <p className="text-2xl font-bold">
                    €{Number(project.total_budget || 0).toLocaleString('it-IT', {
                    minimumFractionDigits: 2
                  })}
                  </p>
                </div>
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
              </CardContent>
            </Card>

          </div>

          {/* Budget Statistics */}
          <ProjectBudgetStats projectId={project.id} totalBudget={Number(project.total_budget || 0)} totalHours={Number(project.total_hours || 0)} marginPercentage={Number(project.margin_percentage || 0)} startDate={project.start_date} endDate={project.end_date} projectionWarningThreshold={Number((project as any).projection_warning_threshold ?? defaultWarningThreshold)} projectionCriticalThreshold={Number((project as any).projection_critical_threshold ?? defaultCriticalThreshold)} manualActivitiesBudget={(project as any).manual_activities_budget != null ? Number((project as any).manual_activities_budget) : null} onBudgetUpdate={() => refetch()} readOnly={isMember} />
        </TabsContent>

        <TabsContent value="canvas" className="space-y-4">
          <ProjectActivitiesManager projectId={projectId!} briefLink={project.brief_link} objective={project.objective} onBriefLinkUpdate={() => refetch()} clientDriveFolderId={project.clients?.drive_folder_id} />
          <ActivityGanttChart projectId={projectId!} projectStartDate={project.start_date} projectEndDate={project.end_date} />
        </TabsContent>

        <TabsContent value="timesheet" className="space-y-4">
          <ProjectTimesheet projectId={projectId!} />
        </TabsContent>

        <TabsContent value="external-costs" className="space-y-4">
          <ProjectAdditionalCosts projectId={projectId!} />
        </TabsContent>
      </Tabs>
    </div>;
};
export default ProjectCanvas;