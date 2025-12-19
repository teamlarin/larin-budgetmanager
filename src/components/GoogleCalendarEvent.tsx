import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Clock, ExternalLink, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const HOUR_HEIGHT = 60;

export interface GoogleEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string;
  location?: string;
}

interface GoogleCalendarEventProps {
  event: GoogleEvent;
  workDayStartHour: number;
  projects: { id: string; name: string }[];
  activities: { id: string; activity_name: string; project_id: string; project_name: string; category: string; hours_worked: number }[];
  onConvertToActivity: (event: GoogleEvent, budgetItemId: string) => void;
}

export function GoogleCalendarEvent({
  event,
  workDayStartHour,
  projects,
  activities,
  onConvertToActivity,
}: GoogleCalendarEventProps) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedActivity, setSelectedActivity] = useState<string>('');

  // Calculate position
  const { top, height, startTime, endTime } = useMemo(() => {
    if (event.allDay) {
      return { top: 0, height: 30, startTime: 'Tutto il giorno', endTime: '' };
    }

    const start = parseISO(event.start);
    const end = parseISO(event.end);
    
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const workDayStartMinutes = workDayStartHour * 60;
    
    const relativeStartMinutes = startMinutes - workDayStartMinutes;
    const duration = endMinutes - startMinutes;

    return {
      top: (relativeStartMinutes / 60) * HOUR_HEIGHT,
      height: Math.max((duration / 60) * HOUR_HEIGHT, 30),
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm'),
    };
  }, [event, workDayStartHour]);

  // Filter activities by selected project
  const filteredActivities = useMemo(() => {
    if (!selectedProject) return [];
    return activities.filter(a => a.project_id === selectedProject);
  }, [activities, selectedProject]);

  const handleConvert = () => {
    if (!selectedActivity) return;
    onConvertToActivity(event, selectedActivity);
    setConvertDialogOpen(false);
    setSelectedProject('');
    setSelectedActivity('');
  };

  if (event.allDay) {
    return (
      <>
        <div className="mx-1 mb-1 px-2 py-1 rounded text-xs bg-orange-100 border-l-4 border-orange-400 dark:bg-orange-900/30">
          <div className="font-medium truncate">{event.title}</div>
          <Badge variant="outline" className="text-[10px] mt-0.5">Google</Badge>
        </div>
        <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Converti in Attività</DialogTitle>
            </DialogHeader>
            <ConvertDialogContent
              event={event}
              projects={projects}
              filteredActivities={filteredActivities}
              selectedProject={selectedProject}
              setSelectedProject={setSelectedProject}
              selectedActivity={selectedActivity}
              setSelectedActivity={setSelectedActivity}
              onConvert={handleConvert}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            style={{ top: `${top}px`, height: `${Math.max(height, 30)}px` }}
            className="absolute left-1 right-1 rounded-md shadow-sm border-l-4 overflow-hidden z-5 bg-orange-100 border-orange-400 dark:bg-orange-900/30 cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
            onClick={() => setConvertDialogOpen(true)}
          >
            <div className="flex flex-col h-full p-1.5">
              <div className="flex items-start justify-between gap-1">
                <div className="font-medium text-xs truncate flex-1">{event.title}</div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0 bg-orange-200/50">
                  Google
                </Badge>
              </div>
              <div className="text-xs flex items-center gap-1 mt-0.5 text-muted-foreground">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>{startTime} - {endTime}</span>
              </div>
              {event.location && height > 50 && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  📍 {event.location}
                </div>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setConvertDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Converti in attività
          </ContextMenuItem>
          {event.htmlLink && (
            <ContextMenuItem onClick={() => window.open(event.htmlLink, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Apri in Google Calendar
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converti in Attività</DialogTitle>
          </DialogHeader>
          <ConvertDialogContent
            event={event}
            projects={projects}
            filteredActivities={filteredActivities}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            selectedActivity={selectedActivity}
            setSelectedActivity={setSelectedActivity}
            onConvert={handleConvert}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConvertDialogContent({
  event,
  projects,
  filteredActivities,
  selectedProject,
  setSelectedProject,
  selectedActivity,
  setSelectedActivity,
  onConvert,
}: {
  event: GoogleEvent;
  projects: { id: string; name: string }[];
  filteredActivities: { id: string; activity_name: string; category: string }[];
  selectedProject: string;
  setSelectedProject: (value: string) => void;
  selectedActivity: string;
  setSelectedActivity: (value: string) => void;
  onConvert: () => void;
}) {
  const eventDate = event.allDay 
    ? format(parseISO(event.start), 'dd/MM/yyyy', { locale: it })
    : format(parseISO(event.start), 'dd/MM/yyyy HH:mm', { locale: it });

  return (
    <div className="space-y-4 py-4">
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="font-medium">{event.title}</div>
        <div className="text-sm text-muted-foreground">{eventDate}</div>
        {event.location && (
          <div className="text-sm text-muted-foreground">📍 {event.location}</div>
        )}
      </div>

      <div>
        <Label>Seleziona progetto</Label>
        <Select value={selectedProject} onValueChange={(v) => {
          setSelectedProject(v);
          setSelectedActivity('');
        }}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Seleziona un progetto" />
          </SelectTrigger>
          <SelectContent>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProject && (
        <div>
          <Label>Seleziona attività</Label>
          <Select value={selectedActivity} onValueChange={setSelectedActivity}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Seleziona un'attività" />
            </SelectTrigger>
            <SelectContent>
              {filteredActivities.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">
                  Nessuna attività assegnata in questo progetto
                </div>
              ) : (
                filteredActivities.map(activity => (
                  <SelectItem key={activity.id} value={activity.id}>
                    <div className="flex items-center gap-2">
                      <span>{activity.activity_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {activity.category}
                      </Badge>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          onClick={onConvert}
          disabled={!selectedActivity}
        >
          <Plus className="h-4 w-4 mr-2" />
          Crea Attività
        </Button>
      </div>
    </div>
  );
}
