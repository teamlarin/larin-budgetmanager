import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Canvas as FabricCanvas, Rect, Textbox, Circle, Line } from 'fabric';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Download, Plus, Type, Square, Circle as CircleIcon, Minus, Save, Edit2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { toast } from 'sonner';
import { format } from 'date-fns';

type ProjectWithDetails = Project & {
  clients?: { name: string };
  profiles?: { first_name: string; last_name: string };
  account_profiles?: { first_name: string; last_name: string };
  quote_number?: string;
};

const ProjectCanvas = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'rectangle' | 'circle' | 'line'>('select');
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

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || fabricCanvas) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 1200,
      height: 800,
      backgroundColor: '#ffffff',
    });

    setFabricCanvas(canvas);
    initializeBusinessModelCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [canvasRef.current]);

  const initializeBusinessModelCanvas = (canvas: FabricCanvas) => {
    const sections = [
      { x: 50, y: 50, width: 200, height: 150, title: 'Key Partners', color: '#E3F2FD' },
      { x: 270, y: 50, width: 200, height: 150, title: 'Key Activities', color: '#F3E5F5' },
      { x: 490, y: 50, width: 200, height: 150, title: 'Value Propositions', color: '#FFF3E0' },
      { x: 710, y: 50, width: 200, height: 150, title: 'Customer Relationships', color: '#E8F5E9' },
      { x: 930, y: 50, width: 200, height: 150, title: 'Customer Segments', color: '#FCE4EC' },
      { x: 50, y: 220, width: 200, height: 150, title: 'Key Resources', color: '#F1F8E9' },
      { x: 710, y: 220, width: 420, height: 150, title: 'Channels', color: '#FFF9C4' },
      { x: 50, y: 390, width: 540, height: 150, title: 'Cost Structure', color: '#FFEBEE' },
      { x: 610, y: 390, width: 520, height: 150, title: 'Revenue Streams', color: '#E0F2F1' },
    ];

    sections.forEach(section => {
      const rect = new Rect({
        left: section.x,
        top: section.y,
        width: section.width,
        height: section.height,
        fill: section.color,
        stroke: '#333',
        strokeWidth: 2,
        selectable: false,
      });

      const text = new Textbox(section.title, {
        left: section.x + 10,
        top: section.y + 10,
        width: section.width - 20,
        fontSize: 14,
        fontWeight: 'bold',
        fill: '#333',
        selectable: false,
      });

      canvas.add(rect, text);
    });

    canvas.renderAll();
  };

  const handleToolClick = (tool: typeof activeTool) => {
    if (!fabricCanvas) return;
    
    setActiveTool(tool);
    fabricCanvas.isDrawingMode = false;

    if (tool === 'text') {
      const text = new Textbox('Doppio click per modificare', {
        left: 100,
        top: 100,
        width: 200,
        fontSize: 16,
        fill: '#333',
      });
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
    } else if (tool === 'rectangle') {
      const rect = new Rect({
        left: 100,
        top: 100,
        width: 100,
        height: 100,
        fill: 'rgba(0, 123, 255, 0.3)',
        stroke: '#007bff',
        strokeWidth: 2,
      });
      fabricCanvas.add(rect);
    } else if (tool === 'circle') {
      const circle = new Circle({
        left: 100,
        top: 100,
        radius: 50,
        fill: 'rgba(40, 167, 69, 0.3)',
        stroke: '#28a745',
        strokeWidth: 2,
      });
      fabricCanvas.add(circle);
    } else if (tool === 'line') {
      const line = new Line([50, 50, 200, 50], {
        stroke: '#333',
        strokeWidth: 2,
      });
      fabricCanvas.add(line);
    }
    
    fabricCanvas.renderAll();
  };

  const handleSave = () => {
    if (!fabricCanvas) return;
    const json = JSON.stringify(fabricCanvas.toJSON());
    localStorage.setItem(`canvas-${projectId}`, json);
    toast.success('Canvas salvato');
  };

  const handleExport = () => {
    if (!fabricCanvas) return;
    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
    const link = document.createElement('a');
    link.download = `canvas-${project?.name || 'project'}.png`;
    link.href = dataURL;
    link.click();
    toast.success('Canvas esportato');
  };

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
      const value = editValues[field];
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

  // Load saved canvas
  useEffect(() => {
    if (!fabricCanvas || !projectId) return;
    
    const saved = localStorage.getItem(`canvas-${projectId}`);
    if (saved) {
      fabricCanvas.loadFromJSON(JSON.parse(saved), () => {
        fabricCanvas.renderAll();
      });
    }
  }, [fabricCanvas, projectId]);

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
            <p className="font-medium">{value || 'N/A'}</p>
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
          <TabsTrigger value="canvas">Business Model Canvas</TabsTrigger>
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
                <EditableField label="Tipo Progetto" field="project_type" value={project.project_type} />
                <EditableField 
                  label="Disciplina" 
                  field="discipline" 
                  value={project.discipline}
                  type="select"
                  options={[
                    { value: 'content_creation_storytelling', label: 'Content Creation & Storytelling' },
                    { value: 'paid_advertising_media_buying', label: 'Paid Advertising & Media Buying' },
                    { value: 'website_landing_page_development', label: 'Website & Landing Page Development' },
                    { value: 'brand_identity_visual_design', label: 'Brand Identity & Visual Design' },
                    { value: 'social_media_management', label: 'Social Media Management' },
                    { value: 'email_marketing_automation', label: 'Email Marketing & Automation' },
                    { value: 'seo_content_optimization', label: 'SEO & Content Optimization' },
                    { value: 'crm_customer_data_platform', label: 'CRM & Customer Data Platform' },
                    { value: 'software_development_integration', label: 'Software Development & Integration' },
                    { value: 'ai_implementation_automation', label: 'AI Implementation & Automation' },
                    { value: 'strategic_consulting', label: 'Strategic Consulting' }
                  ]}
                />
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
                <EditableField label="Team di Progetto" field="description" value={project.description} type="textarea" />
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
                  value={project.start_date ? format(new Date(project.start_date), 'yyyy-MM-dd') : ''} 
                  type="date" 
                />
                <EditableField 
                  label="Data Fine Prevista" 
                  field="end_date" 
                  value={project.end_date ? format(new Date(project.end_date), 'yyyy-MM-dd') : ''} 
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
                <EditableField label="Margine (%)" field="margin_percentage" value={project.margin_percentage} type="number" />
                <EditableField label="Sconto Applicato (%)" field="discount_percentage" value={project.discount_percentage} type="number" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="canvas" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Business Model Canvas</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={activeTool === 'select' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setActiveTool('select')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={activeTool === 'text' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => handleToolClick('text')}
                  >
                    <Type className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={activeTool === 'rectangle' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => handleToolClick('rectangle')}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={activeTool === 'circle' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => handleToolClick('circle')}
                  >
                    <CircleIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={activeTool === 'line' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => handleToolClick('line')}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleSave}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleExport}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto bg-muted/30">
                <canvas ref={canvasRef} />
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Clicca e trascina per spostare elementi. Doppio click su testo per modificarlo.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectCanvas;
