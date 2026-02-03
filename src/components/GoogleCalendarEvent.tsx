import { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Clock, ExternalLink, Plus, EyeOff, Search } from 'lucide-react';
import { TimeSlotSelect } from '@/components/ui/time-slot-select';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const DEFAULT_HOUR_HEIGHT = 60;

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
  hourHeight?: number;
  projects: { id: string; name: string }[];
  activities: { id: string; activity_name: string; project_id: string; project_name: string; category: string; hours_worked: number }[];
  onConvertToActivity: (event: GoogleEvent, budgetItemId: string, customDate?: string, customStartTime?: string, customEndTime?: string) => void;
  onHideEvent?: (eventId: string) => void;
}

export function GoogleCalendarEvent({
  event,
  workDayStartHour,
  hourHeight = DEFAULT_HOUR_HEIGHT,
  projects,
  activities,
  onConvertToActivity,
  onHideEvent,
}: GoogleCalendarEventProps) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  
  // Editable date/time state
  const [editableDate, setEditableDate] = useState('');
  const [editableStartTime, setEditableStartTime] = useState('');
  const [editableEndTime, setEditableEndTime] = useState('');

  // Reset editable values when dialog opens
  useEffect(() => {
    if (convertDialogOpen) {
      const eventStart = parseISO(event.start);
      const eventEnd = parseISO(event.end);
      setEditableDate(format(eventStart, 'yyyy-MM-dd'));
      setEditableStartTime(event.allDay ? '09:00' : format(eventStart, 'HH:mm'));
      setEditableEndTime(event.allDay ? '10:00' : format(eventEnd, 'HH:mm'));
    }
  }, [convertDialogOpen, event]);

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
      top: (relativeStartMinutes / 60) * hourHeight,
      height: Math.max((duration / 60) * hourHeight, 30),
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm'),
    };
  }, [event, workDayStartHour, hourHeight]);

  // Filter activities by selected project
  const filteredActivities = useMemo(() => {
    if (!selectedProject) return [];
    return activities.filter(a => a.project_id === selectedProject);
  }, [activities, selectedProject]);

  const handleConvert = () => {
    if (!selectedActivity) return;
    onConvertToActivity(event, selectedActivity, editableDate, editableStartTime, editableEndTime);
    setConvertDialogOpen(false);
    setSelectedProject('');
    setSelectedActivity('');
  };

  if (event.allDay) {
    return (
      <>
        <div 
          className="mx-1 mb-1 px-2 py-1 rounded-[2px] text-xs bg-yellow-100 border-l-4 border-yellow-400 dark:bg-yellow-900/30 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
          onClick={() => setConvertDialogOpen(true)}
        >
          <div className="font-medium truncate">{event.title}</div>
          <Badge variant="outline" className="text-[10px] mt-0.5 bg-yellow-200/50 border-yellow-400">Google</Badge>
        </div>
        <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Collega a Progetto/Attività</DialogTitle>
            </DialogHeader>
            <ConvertDialogContent
              event={event}
              projects={projects}
              filteredActivities={filteredActivities}
              selectedProject={selectedProject}
              setSelectedProject={setSelectedProject}
              selectedActivity={selectedActivity}
              setSelectedActivity={setSelectedActivity}
              editableDate={editableDate}
              setEditableDate={setEditableDate}
              editableStartTime={editableStartTime}
              setEditableStartTime={setEditableStartTime}
              editableEndTime={editableEndTime}
              setEditableEndTime={setEditableEndTime}
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
            style={{ top: `${top}px`, height: `${Math.max(height, 30)}px`, transition: 'top 0.15s ease-out, height 0.15s ease-out' }}
            className="absolute left-[15%] right-1 rounded-[2px] shadow-sm border-l-4 overflow-hidden z-10 bg-yellow-100 border-yellow-400 dark:bg-yellow-900/30 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
            onClick={() => setConvertDialogOpen(true)}
          >
            <div className="flex flex-col h-full p-1.5">
              <div className="flex items-start justify-between gap-1">
                <div className="font-medium text-xs truncate flex-1">{event.title}</div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0 bg-yellow-200/50 border-yellow-400">
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
            Collega a progetto/attività
          </ContextMenuItem>
          {event.htmlLink && (
            <ContextMenuItem onClick={() => window.open(event.htmlLink, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Apri in Google Calendar
            </ContextMenuItem>
          )}
          {onHideEvent && (
            <ContextMenuItem onClick={() => onHideEvent(event.id)} className="text-destructive focus:text-destructive">
              <EyeOff className="h-4 w-4 mr-2" />
              Nascondi dal calendario
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collega a Progetto/Attività</DialogTitle>
          </DialogHeader>
          <ConvertDialogContent
            event={event}
            projects={projects}
            filteredActivities={filteredActivities}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            selectedActivity={selectedActivity}
            setSelectedActivity={setSelectedActivity}
            editableDate={editableDate}
            setEditableDate={setEditableDate}
            editableStartTime={editableStartTime}
            setEditableStartTime={setEditableStartTime}
            editableEndTime={editableEndTime}
            setEditableEndTime={setEditableEndTime}
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
  editableDate,
  setEditableDate,
  editableStartTime,
  setEditableStartTime,
  editableEndTime,
  setEditableEndTime,
  onConvert,
}: {
  event: GoogleEvent;
  projects: { id: string; name: string }[];
  filteredActivities: { id: string; activity_name: string; category: string }[];
  selectedProject: string;
  setSelectedProject: (value: string) => void;
  selectedActivity: string;
  setSelectedActivity: (value: string) => void;
  editableDate: string;
  setEditableDate: (value: string) => void;
  editableStartTime: string;
  setEditableStartTime: (value: string) => void;
  editableEndTime: string;
  setEditableEndTime: (value: string) => void;
  onConvert: () => void;
}) {
  const [projectSearch, setProjectSearch] = useState('');
  
  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projects;
    return projects.filter(p => 
      p.name.toLowerCase().includes(projectSearch.toLowerCase())
    );
  }, [projects, projectSearch]);

  return (
    <div className="space-y-4 py-4">
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="font-medium">{event.title}</div>
        {event.location && (
          <div className="text-sm text-muted-foreground">📍 {event.location}</div>
        )}
      </div>

      {/* Editable date and time */}
      <div>
        <Label>Data</Label>
        <Input 
          type="date" 
          value={editableDate} 
          onChange={(e) => setEditableDate(e.target.value)}
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Ora inizio</Label>
          <TimeSlotSelect
            value={editableStartTime}
            onChange={setEditableStartTime}
            startHour={6}
            endHour={22}
            stepMinutes={15}
            placeholder="Seleziona orario"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Ora fine</Label>
          <TimeSlotSelect
            value={editableEndTime}
            onChange={setEditableEndTime}
            startHour={6}
            endHour={22}
            stepMinutes={15}
            placeholder="Seleziona orario"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label>Seleziona progetto</Label>
        <Select value={selectedProject} onValueChange={(v) => {
          setSelectedProject(v);
          setSelectedActivity('');
          setProjectSearch('');
        }}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Seleziona un progetto" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca progetto..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="pl-8 h-8"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            {filteredProjects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
            {filteredProjects.length === 0 && (
              <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                Nessun progetto trovato
              </div>
            )}
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
          Collega attività
        </Button>
      </div>
    </div>
  );
}
