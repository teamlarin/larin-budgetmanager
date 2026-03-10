import { ArrowRight, Clock, List, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WorkflowTemplate } from '@/types/workflow';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useState } from 'react';

interface TemplateManagementProps {
  templates: WorkflowTemplate[];
  onEdit: (template: WorkflowTemplate) => void;
  onDelete: (templateId: string) => void;
}

export const TemplateManagement = ({ templates, onEdit, onDelete }: TemplateManagementProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {templates.map((template) => {
        const isExpanded = expandedId === template.id;
        const sortedTasks = [...template.tasks].sort((a, b) => a.order - b.order);

        return (
          <Card key={template.id} variant="static">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="mt-1">{template.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <List className="h-3 w-3 mr-1" />
                    {template.tasks.length} task
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(template)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(template.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : template.id)}
                  >
                    {isExpanded ? 'Chiudi' : 'Dettagli'}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Aggiornato il {format(new Date(template.updatedAt), 'd MMM yyyy', { locale: it })}
                </span>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Dipende da</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTasks.map((task) => {
                      const depTask = task.dependsOn
                        ? template.tasks.find(t => t.id === task.dependsOn)
                        : null;
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.order}</TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium text-sm">{task.title}</span>
                              {task.description && (
                                <p className="text-xs text-muted-foreground">{task.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {depTask ? (
                              <Badge variant="outline" className="text-xs">
                                <ArrowRight className="h-2.5 w-2.5 mr-1" />
                                {depTask.title}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};
