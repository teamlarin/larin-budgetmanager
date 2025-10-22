import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Euro, Clock, MoreVertical, Trash2, Edit, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onUpdate: () => void;
  isOwner?: boolean;
  showCreator?: boolean;
  creatorName?: string;
  accountName?: string;
}

export const ProjectCard = ({ project, onUpdate, isOwner = true, showCreator = false, creatorName, accountName }: ProjectCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Sei sicuro di voler eliminare questo budget? Questa azione non può essere annullata.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;

      toast({
        title: 'Budget eliminato',
        description: 'Il budget è stato eliminato con successo.',
      });
      onUpdate();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'eliminazione del budget.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={() => navigate(`/projects/${project.id}`)}>
            <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {project.description || 'Nessuna descrizione'}
            </CardDescription>
          </div>
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Apri budget
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <BudgetStatusBadge 
            status={project.status}
            statusChangedAt={project.status_changed_at}
          />
          <Badge variant="outline">{project.project_type}</Badge>
        </div>
      </CardHeader>
      <CardContent onClick={() => navigate(`/projects/${project.id}`)}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{project.total_budget.toFixed(2)} €</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{project.total_hours.toFixed(1)}h</span>
          </div>
        </div>
        <div className="space-y-2 mt-3">
          {project.clients?.name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>Cliente: <span className="font-medium">{project.clients.name}</span></span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              Creato il {new Date(project.created_at).toLocaleDateString('it-IT')}
            </span>
          </div>
          {showCreator && creatorName && (
            <div className="text-xs text-muted-foreground">
              Creato da: <span className="font-medium">{creatorName}</span>
            </div>
          )}
          {accountName && (
            <div className="text-xs text-muted-foreground">
              Account: <span className="font-medium">{accountName}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};