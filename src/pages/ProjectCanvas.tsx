import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Canvas as FabricCanvas, Rect, Textbox, Circle, Line } from 'fabric';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Download, Plus, Type, Square, Circle as CircleIcon, Minus, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Project } from '@/types/project';
import { toast } from 'sonner';

type ProjectWithDetails = Project & {
  clients?: { name: string };
  profiles?: { first_name: string; last_name: string };
  account_profiles?: { first_name: string; last_name: string };
};

const ProjectCanvas = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'rectangle' | 'circle' | 'line'>('select');

  const { data: project, isLoading } = useQuery<ProjectWithDetails>({
    queryKey: ['project-canvas', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      // Fetch creator and account profiles
      const userIds = [data.user_id, data.account_user_id].filter(Boolean);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }]) || []
      );

      return {
        ...data,
        profiles: profilesMap.get(data.user_id) || null,
        account_profiles: data.account_user_id ? profilesMap.get(data.account_user_id) || null : null
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
    // Business Model Canvas template
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

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';
    initializeBusinessModelCanvas(fabricCanvas);
    toast.success('Canvas pulito');
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

      <Tabs defaultValue="canvas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="canvas">Business Model Canvas</TabsTrigger>
          <TabsTrigger value="report">Report & Analytics</TabsTrigger>
        </TabsList>

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

        <TabsContent value="report" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informazioni Progetto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{project.clients?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Project Leader</p>
                  <p className="font-medium">{creatorName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Account</p>
                  <p className="font-medium">{accountName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo Progetto</p>
                  <p className="font-medium">{project.project_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Area</p>
                  <p className="font-medium">{project.area || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disciplina</p>
                  <p className="font-medium">{project.discipline || 'N/A'}</p>
                </div>
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
                <div>
                  <p className="text-sm text-muted-foreground">Margine</p>
                  <p className="text-2xl font-bold">
                    {project.margin_percentage || 0}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sconto Applicato</p>
                  <p className="text-2xl font-bold">
                    {project.discount_percentage || 0}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progresso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Completamento</p>
                    <p className="text-sm font-medium">{project.progress || 0}%</p>
                  </div>
                  <Progress value={project.progress || 0} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stato Progetto</p>
                  <Badge className="mt-1">
                    {project.project_status === 'in_partenza' && 'In Partenza'}
                    {project.project_status === 'aperto' && 'Aperto'}
                    {project.project_status === 'da_fatturare' && 'Da Fatturare'}
                    {project.project_status === 'completato' && 'Completato'}
                    {!project.project_status && 'In Partenza'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data Fine Prevista</p>
                  <p className="font-medium">
                    {project.end_date ? new Date(project.end_date).toLocaleDateString('it-IT') : 'Non impostata'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Obiettivo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {project.objective || 'Nessun obiettivo definito'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectCanvas;
