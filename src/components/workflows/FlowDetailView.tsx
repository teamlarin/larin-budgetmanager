import { useState } from 'react';
import { ArrowLeft, Lock, Check, Circle, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ActiveFlow, ActiveTask } from '@/types/workflow';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FlowDetailViewProps {
  flow: ActiveFlow;
  onBack: () => void;
  onToggleTask: (flowId: string, taskTemplateId: string) => void;
}

export const FlowDetailView = ({ flow, onBack, onToggleTask }: FlowDetailViewProps) => {
  const completedCount = flow.tasks.filter(t => t.isCompleted).length;
  const totalCount = flow.tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isFlowComplete = completedCount === totalCount;

  const isTaskBlocked = (task: ActiveTask): boolean => {
    if (!task.dependsOn) return false;
    const dependency = flow.tasks.find(t => t.taskTemplateId === task.dependsOn);
    return dependency ? !dependency.isCompleted : false;
  };

  const getDependencyName = (dependsOnId: string | null): string | null => {
    if (!dependsOnId) return null;
    const dep = flow.tasks.find(t => t.taskTemplateId === dependsOnId);
    return dep?.title || null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">{flow.templateName}</h2>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {flow.assignedTo}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Avviato il {format(new Date(flow.createdAt), 'd MMM yyyy', { locale: it })}
            </div>
            {isFlowComplete && (
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <Check className="h-3 w-3 mr-1" /> Completato
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <Card variant="static">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progresso</span>
            <span className="text-sm font-medium text-foreground">{completedCount}/{totalCount} completati ({progressPercent}%)</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      {/* Tasks List */}
      <div className="space-y-3">
        {flow.tasks
          .sort((a, b) => a.order - b.order)
          .map((task) => {
            const blocked = isTaskBlocked(task);
            const depName = getDependencyName(task.dependsOn);

            return (
              <Card
                key={task.taskTemplateId}
                variant="static"
                className={cn(
                  'transition-all duration-500 ease-out',
                  blocked && 'opacity-50 border-muted',
                  task.isCompleted && 'border-primary/30 bg-primary/5',
                  !blocked && !task.isCompleted && 'hover:border-primary/40'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox or Lock */}
                    {blocked ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="mt-0.5 h-4 w-4 rounded-sm border border-muted-foreground/30 flex items-center justify-center cursor-not-allowed">
                            <Lock className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bloccato: completa prima "{depName}"</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Checkbox
                        checked={task.isCompleted}
                        onCheckedChange={() => onToggleTask(flow.id, task.taskTemplateId)}
                        className="mt-0.5"
                      />
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm font-medium transition-all duration-300',
                          task.isCompleted && 'line-through text-muted-foreground',
                          blocked && 'text-muted-foreground'
                        )}>
                          {task.title}
                        </span>
                        {blocked && (
                          <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
                            <Lock className="h-2.5 w-2.5 mr-1" />
                            Bloccato
                          </Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className={cn(
                          'text-xs mt-1 transition-all duration-300',
                          blocked ? 'text-muted-foreground/50' : 'text-muted-foreground'
                        )}>
                          {task.description}
                        </p>
                      )}
                      {task.dependsOn && (
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Dipende da: {depName}
                        </p>
                      )}
                      {task.completedAt && (
                        <p className="text-xs text-primary mt-1">
                          Completato il {format(new Date(task.completedAt), 'd MMM yyyy HH:mm', { locale: it })}
                        </p>
                      )}
                    </div>

                    {/* Order badge */}
                    <Badge variant="outline" className="text-xs shrink-0">
                      #{task.order}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
};
