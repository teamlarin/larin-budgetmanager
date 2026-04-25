import { ArrowRight, Clock, Copy, List, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WorkflowTemplate } from '@/types/workflow';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { AREA_LABELS, AREA_COLORS } from '@/lib/areaColors';

interface TemplateManagementProps {
  templates: WorkflowTemplate[];
  onEdit: (template: WorkflowTemplate) => void;
  onDelete: (templateId: string) => void;
  onDuplicate: (template: WorkflowTemplate) => void;
}

export const TemplateManagement = ({ templates, onEdit, onDelete, onDuplicate }: TemplateManagementProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>('all');

  const areaCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length, none: 0 };
    templates.forEach(t => {
      const key = t.area || 'none';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (areaFilter === 'all') return templates;
    if (areaFilter === 'none') return templates.filter(t => !t.area);
    return templates.filter(t => t.area === areaFilter);
  }, [templates, areaFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filtra per area..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le aree ({areaCounts.all || 0})</SelectItem>
            {Object.entries(AREA_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label} ({areaCounts[key] || 0})</SelectItem>
            ))}
            <SelectItem value="none">Senza area ({areaCounts.none || 0})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nessun modello in questa area.
        </div>
      )}

      {filteredTemplates.map((template) => {
        const isExpanded = expandedId === template.id;
        const sortedTasks = [...template.tasks].sort((a, b) => a.order - b.order);
        const areaKey = template.area as keyof typeof AREA_LABELS | undefined;
        const areaLabel = areaKey ? AREA_LABELS[areaKey] : null;
        const areaColor = areaKey ? AREA_COLORS[areaKey] : null;

        return (
          <Card key={template.id} variant="static">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {areaLabel && areaColor && (
                      <Badge variant="outline" className={`text-xs ${areaColor}`}>{areaLabel}</Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">{template.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <List className="h-3 w-3 mr-1" />
                    {template.tasks.length} task
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : template.id)}
                  >
                    {isExpanded ? 'Chiudi' : 'Dettagli'}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(template)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicate(template)}>
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Duplica
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(template.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
