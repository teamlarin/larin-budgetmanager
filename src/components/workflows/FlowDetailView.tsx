import { useState, Fragment } from 'react';
import { ArrowLeft, Lock, Check, Clock, User, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ActiveFlow, ActiveTask, UserProfile } from '@/types/workflow';
import { getProfileDisplayName } from '@/types/workflow';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

const RichText = ({ text, className }: { text: string; className?: string }) => {
  const parts = text.split(URL_REGEX);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
};

interface FlowDetailViewProps {
  flow: ActiveFlow;
  profiles: UserProfile[];
  onBack: () => void;
  onToggleTask: (flowId: string, taskId: string) => void;
  onUpdateFlowName: (flowId: string, newName: string) => void;
  onUpdateTaskAssignee: (flowId: string, taskId: string, assigneeId: string | null) => void;
}

export const FlowDetailView = ({ flow, profiles, onBack, onToggleTask, onUpdateFlowName, onUpdateTaskAssignee }: FlowDetailViewProps) => {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(flow.customName);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const completedCount = flow.tasks.filter(t => t.isCompleted).length;
  const totalCount = flow.tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isFlowComplete = completedCount === totalCount;

  const isTaskBlocked = (task: ActiveTask): boolean => {
    if (!task.dependsOn) return false;
    const dependency = flow.tasks.find(t => t.id === task.dependsOn);
    return dependency ? !dependency.isCompleted : false;
  };

  const getDependencyName = (dependsOnId: string | null): string | null => {
    if (!dependsOnId) return null;
    return flow.tasks.find(t => t.id === dependsOnId)?.title || null;
  };

  const handleSaveName = () => {
    if (nameValue.trim()) {
      onUpdateFlowName(flow.id, nameValue.trim());
    } else {
      setNameValue(flow.customName);
    }
    setEditingName(false);
  };

  const getTaskAssigneeDisplay = (task: ActiveTask) => task.assigneeName || flow.ownerName;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="text-xl font-bold h-9 max-w-md"
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setEditingName(true)}>
              <h2 className="text-2xl font-bold text-foreground">{flow.customName}</h2>
              <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">Modello: {flow.templateName}</p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              Owner: <span className="font-medium text-foreground">{flow.ownerName}</span>
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
            const displayAssignee = getTaskAssigneeDisplay(task);
            const isCustomAssignee = !!task.assigneeName;

            return (
              <Card
                key={task.id}
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
                        onCheckedChange={() => onToggleTask(flow.id, task.id)}
                        className="mt-0.5"
                      />
                    )}

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
                          <RichText text={task.description} />
                        </p>
                      )}

                      {/* Assignee row */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {editingTaskId === task.id ? (
                            <Select
                              value={task.assigneeId || 'owner'}
                              onValueChange={(val) => {
                                onUpdateTaskAssignee(flow.id, task.id, val === 'owner' ? null : val);
                                setEditingTaskId(null);
                              }}
                            >
                              <SelectTrigger className="h-6 text-xs w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">
                                  {flow.ownerName} (owner)
                                </SelectItem>
                                {profiles.filter(p => p.id !== flow.ownerId).map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {getProfileDisplayName(p)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span
                              className="cursor-pointer hover:text-foreground transition-colors group/assignee"
                              onClick={() => setEditingTaskId(task.id)}
                            >
                              {displayAssignee}
                              {!isCustomAssignee && <span className="text-muted-foreground/50 ml-1">(owner)</span>}
                              <Pencil className="h-2.5 w-2.5 inline ml-1 opacity-0 group-hover/assignee:opacity-100 transition-opacity" />
                            </span>
                          )}
                        </div>
                      </div>

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
