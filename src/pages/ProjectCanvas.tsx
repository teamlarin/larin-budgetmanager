import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Edit2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ProjectTeamSelector } from '@/components/ProjectTeamSelector';
import { ProjectActivitiesManager } from '@/components/ProjectActivitiesManager';
import { ProjectBudgetStats } from '@/components/ProjectBudgetStats';

type ProjectWithDetails = Project & {
  clients?: { name: string };
  profiles?: { first_name: string; last_name: string };
  account_profiles?: { first_name: string; last_name: string };
  quote_number?: string;
};

const ProjectCanvas = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const { data: project, isLoading, refetch } = useQuery<ProjectWithDetails>({
    queryKey: ['project-canvas', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('id', projectId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Project not found');

      // Fetch creator and account profiles
      const userIds = [data.user_id, data.account_user_id].filter(Boolean);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }]) || []
      );

      // Fetch quote number
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('quote_number')
        .eq('project_id', projectId)
        .eq('status', 'approved')
        .maybeSingle();

      return {
        ...data,
        profiles: profilesMap.get(data.user_id) || null,
        account_profiles: data.account_user_id ? profilesMap.get(data.account_user_id) || null : null,
        quote_number: quoteData?.quote_number
      };
    },
    enabled: !!projectId,
  });


  const startEditing = (field: string, currentValue: any) => {
    setEditingField(field);
    setEditValues({ [field]: currentValue || '' });
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
      
      const updateData: any = { [field]: value };

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', project.id);

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
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">Progetto non trovato</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const creatorName = project.profiles
    ? `${project.profiles.first_name} ${project.profiles.last_name}`.trim()
    : 'N/A';

  const accountName = project.account_profiles
    ? `${project.account_profiles.first_name} ${project.account_profiles.last_name}`.trim()
    : 'N/A';

  const EditableField = ({ 
    label, 
    field, 
    value, 
    type = 'text',
    options 
  }: { 
    label: string; 
    field: string; 
    value: any; 
    type?: 'text' | 'textarea' | 'select' | 'date' | 'number';
    options?: { value: string; label: string }[];
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

    return (
      <div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            {type === 'textarea' ? (
              <Textarea
                value={editValues[field] || ''}
                onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
                className="flex-1"
                rows={3}
              />
            ) : type === 'select' && options ? (
              <Select 
                value={editValues[field] || ''} 
                onValueChange={(val) => setEditValues({ ...editValues, [field]: val })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {options.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={type}
                value={editValues[field] || ''}
                onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
                className="flex-1"
              />
            )}
            <Button size="icon" variant="ghost" onClick={() => saveField(field)}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={cancelEditing}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div 
            className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
            onClick={() => startEditing(field, value)}
          >
            <p className="font-medium">{getDisplayValue() || 'N/A'}</p>
            <Edit2 className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/approved-projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
            <p className="text-muted-foreground">Canvas & Report Strategico</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="report" className="space-y-6">
        <TabsList>
          <TabsTrigger value="report">Report & Analytics</TabsTrigger>
          <TabsTrigger value="canvas">Canvas e Attività</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informazioni Progetto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EditableField label="Cliente" field="client_id" value={project.clients?.name} />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Preventivo di Riferimento</p>
                  <p className="font-medium">{project.quote_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Disciplina</p>
                  <p className="font-medium">{project.discipline || 'N/A'}</p>
                </div>
                <EditableField label="Obiettivo" field="objective" value={project.objective} type="textarea" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EditableField label="Project Leader" field="user_id" value={creatorName} />
                <EditableField label="Account" field="account_user_id" value={accountName} />
                <ProjectTeamSelector projectId={project.id} onUpdate={refetch} />
                <EditableField 
                  label="Area" 
                  field="area" 
                  value={project.area} 
                  type="select"
                  options={[
                    { value: 'marketing', label: 'Marketing' },
                    { value: 'tech', label: 'Tech' },
                    { value: 'branding', label: 'Branding' },
                    { value: 'sales', label: 'Sales' }
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progresso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EditableField label="Completamento (%)" field="progress" value={project.progress} type="number" />
                <div className="mt-2">
                  <Progress value={project.progress || 0} />
                </div>
                <EditableField 
                  label="Data Inizio" 
                  field="start_date" 
                  value={project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy') : ''} 
                  type="date" 
                />
                <EditableField 
                  label="Data Fine Prevista" 
                  field="end_date" 
                  value={project.end_date ? format(new Date(project.end_date), 'dd/MM/yyyy') : ''} 
                  type="date" 
                />
                <EditableField 
                  label="Stato" 
                  field="project_status" 
                  value={project.project_status === 'in_partenza' ? 'In Partenza' : project.project_status === 'aperto' ? 'Aperto' : project.project_status === 'da_fatturare' ? 'Da Fatturare' : project.project_status === 'completato' ? 'Completato' : 'In Partenza'}
                  type="select"
                  options={[
                    { value: 'in_partenza', label: 'In Partenza' },
                    { value: 'aperto', label: 'Aperto' },
                    { value: 'da_fatturare', label: 'Da Fatturare' },
                    { value: 'completato', label: 'Completato' }
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Metriche Finanziarie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Budget Totale</p>
                  <p className="text-2xl font-bold">
                    €{Number(project.total_budget || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ore Totali</p>
                  <p className="text-2xl font-bold">
                    {Number(project.total_hours || 0).toLocaleString('it-IT', { minimumFractionDigits: 1 })}h
                  </p>
                </div>
                <EditableField label="Marginalità obiettivo (%)" field="margin_percentage" value={project.margin_percentage} type="number" />
                <EditableField 
                  label="Fatturabile" 
                  field="is_billable" 
                  value={project.is_billable !== undefined ? String(project.is_billable) : 'true'} 
                  type="select"
                  options={[
                    { value: 'true', label: 'Sì' },
                    { value: 'false', label: 'No' }
                  ]}
                />
                <EditableField 
                  label="Tipologia Progetto" 
                  field="billing_type" 
                  value={project.billing_type} 
                  type="select"
                  options={[
                    { value: 'one_shot', label: 'One-Shot' },
                    { value: 'recurring', label: 'Recurring' },
                    { value: 'consumptive', label: 'Consumptive' },
                    { value: 'pack', label: 'Pack' },
                    { value: 'pre_sales', label: 'Pre Sales' },
                    { value: 'interno', label: 'Interno' }
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          {/* Budget Statistics */}
          <ProjectBudgetStats
            projectId={project.id}
            totalBudget={Number(project.total_budget || 0)}
            totalHours={Number(project.total_hours || 0)}
            marginPercentage={Number(project.margin_percentage || 0)}
            startDate={project.start_date}
            endDate={project.end_date}
          />
        </TabsContent>

        <TabsContent value="canvas" className="space-y-4">
          <ProjectActivitiesManager 
            projectId={projectId!} 
            briefLink={project.brief_link}
            objective={project.objective}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectCanvas;
