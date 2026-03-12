import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, Search, ChevronDown, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { DraggableActivity } from './DraggableActivity';
import { Activity } from './calendarTypes';

interface CompletedActivityInfo extends Activity {
  completed_at: string | null;
}

interface CalendarSidebarProps {
  isReadOnly: boolean;
  isViewingOtherUser: boolean;
  activitySearchQuery: string;
  setActivitySearchQuery: (query: string) => void;
  selectedProject: string;
  setSelectedProject: (project: string) => void;
  projectFilterOpen: boolean;
  setProjectFilterOpen: (open: boolean) => void;
  projectFilterSearch: string;
  setProjectFilterSearch: (search: string) => void;
  uniqueProjects: { id: string; name: string }[];
  filteredActivities: Activity[];
  activeActivities: Activity[];
  completedActivitiesWithInfo: CompletedActivityInfo[];
  onCompleteActivity: (id: string) => void;
  onRestoreActivity: (id: string) => void;
}

export function CalendarSidebar({
  isReadOnly,
  isViewingOtherUser,
  activitySearchQuery,
  setActivitySearchQuery,
  selectedProject,
  setSelectedProject,
  projectFilterOpen,
  setProjectFilterOpen,
  projectFilterSearch,
  setProjectFilterSearch,
  uniqueProjects,
  filteredActivities,
  activeActivities,
  completedActivitiesWithInfo,
  onCompleteActivity,
  onRestoreActivity,
}: CalendarSidebarProps) {
  return (
    <Card className={`w-72 m-4 mt-0 flex-shrink-0 overflow-hidden flex flex-col ${isReadOnly ? 'opacity-60' : ''}`}>
      <CardHeader className="px-3 py-2">
        <CardTitle className="text-sm">
          Attività assegnate
          {isReadOnly && <Badge variant="secondary" className="ml-2 text-[10px]">Sola lettura</Badge>}
          {isViewingOtherUser && !isReadOnly && <Badge variant="default" className="ml-2 text-[10px]">Gestione</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto flex flex-col gap-2 px-3 pb-3 pt-0">
        {/* Ricerca e Filtri */}
        <div className="space-y-2 pb-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca attività..."
              value={activitySearchQuery}
              onChange={(e) => setActivitySearchQuery(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
          <div>
            <Popover open={projectFilterOpen} onOpenChange={setProjectFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectFilterOpen}
                  className="w-full justify-between font-normal h-8 text-xs"
                >
                  <span className="truncate">
                    {selectedProject === 'all'
                      ? 'Tutti i progetti'
                      : uniqueProjects.find(p => p.id === selectedProject)?.name || 'Seleziona progetto'}
                  </span>
                  <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Cerca progetto..."
                    value={projectFilterSearch}
                    onValueChange={setProjectFilterSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Nessun progetto trovato</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedProject('all');
                          setProjectFilterOpen(false);
                          setProjectFilterSearch('');
                        }}
                      >
                        <CheckCircle className={`mr-2 h-3.5 w-3.5 ${selectedProject === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                        Tutti i progetti
                      </CommandItem>
                      {uniqueProjects
                        .filter(p => !projectFilterSearch || p.name.toLowerCase().includes(projectFilterSearch.toLowerCase()))
                        .map(project => (
                          <CommandItem
                            key={project.id}
                            value={project.id}
                            onSelect={() => {
                              setSelectedProject(project.id);
                              setProjectFilterOpen(false);
                              setProjectFilterSearch('');
                            }}
                          >
                            <CheckCircle className={`mr-2 h-3.5 w-3.5 ${selectedProject === project.id ? 'opacity-100' : 'opacity-0'}`} />
                            <span className="truncate text-xs">{project.name}</span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {selectedProject !== 'all' && (
            <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setSelectedProject('all')}>
              Rimuovi filtro
            </Button>
          )}
        </div>

        {/* Lista attività */}
        {filteredActivities.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {activeActivities.length === 0 ? 'Nessuna attività assegnata' : 'Nessuna attività corrisponde ai filtri'}
          </p>
        ) : (
          <div>
            {filteredActivities.map(activity => (
              <DraggableActivity key={activity.id} activity={activity} onComplete={onCompleteActivity} />
            ))}
          </div>
        )}

        {/* Sezione attività completate */}
        {completedActivitiesWithInfo.length > 0 && (
          <Collapsible className="border-t pt-3">
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Attività completate ({completedActivitiesWithInfo.length})
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {completedActivitiesWithInfo.map(activity => (
                <div
                  key={activity.id}
                  className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate text-green-800 dark:text-green-200">
                        {activity.activity_name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => onRestoreActivity(activity.id)}
                        title="Ripristina attività"
                      >
                        <RotateCcw className="h-4 w-4 text-muted-foreground hover:text-orange-600" />
                      </Button>
                    </div>
                    <Badge variant="secondary" className="w-fit text-xs">
                      {activity.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{activity.project_name}</span>
                    {activity.completed_at && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Completata il {format(parseISO(activity.completed_at), 'd MMM yyyy, HH:mm', { locale: it })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
