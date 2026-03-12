import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarSettings, CalendarConfig } from '@/components/CalendarSettings';
import { ChevronLeft, ChevronRight, CheckCircle, Users, LayoutGrid, PanelLeftClose, PanelLeft, ZoomIn, ZoomOut, CalendarDays, Calendar as CalendarIcon } from 'lucide-react';
import { format, addDays, addWeeks, subWeeks, subDays, getDay, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatHours } from '@/lib/utils';
import { getDynamicCategorySolidColor } from '@/lib/categoryColors';
import { DEFAULT_HOUR_HEIGHT, ZOOM_LEVELS, TimeTracking } from './calendarTypes';

interface CalendarHeaderProps {
  config: CalendarConfig;
  saveConfig: (config: CalendarConfig) => Promise<CalendarConfig>;
  handleConfigChange: (config: CalendarConfig) => Promise<void>;
  viewMode: 'week' | 'day';
  setViewMode: (mode: 'week' | 'day') => void;
  selectedDayDate: Date;
  setSelectedDayDate: (fn: Date | ((prev: Date) => Date)) => void;
  currentWeekStart: Date;
  setCurrentWeekStart: (fn: Date | ((prev: Date) => Date)) => void;
  weeklyTotals: { planned: number; confirmed: number };
  weeklyContractHours: number;
  confirmableTrackings: TimeTracking[];
  batchConfirmMutation: { mutate: (trackings: TimeTracking[]) => void; isPending: boolean };
  canViewOtherUsers: boolean;
  allUsers: { id: string; first_name: string; last_name: string; avatar_url: string | null }[];
  currentUserId: string | undefined;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  isViewingOtherUser: boolean;
  setShowMultiUserView: (show: boolean) => void;
  isSidebarVisible: boolean;
  setIsSidebarVisible: (visible: boolean) => void;
  setIsGoogleConnected: (connected: boolean) => void;
  setHiddenGoogleEvents: (events: string[]) => void;
  activityCategories: { id: string; name: string }[];
}

export function CalendarHeader({
  config,
  saveConfig,
  handleConfigChange,
  viewMode,
  setViewMode,
  selectedDayDate,
  setSelectedDayDate,
  currentWeekStart,
  setCurrentWeekStart,
  weeklyTotals,
  weeklyContractHours,
  confirmableTrackings,
  batchConfirmMutation,
  canViewOtherUsers,
  allUsers,
  currentUserId,
  selectedUserId,
  setSelectedUserId,
  isViewingOtherUser,
  setShowMultiUserView,
  isSidebarVisible,
  setIsSidebarVisible,
  setIsGoogleConnected,
  setHiddenGoogleEvents,
  activityCategories,
}: CalendarHeaderProps) {
  return (
    <div className="container mx-auto px-3 pt-7 pb-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* User selector */}
          {canViewOtherUsers && allUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedUserId || currentUserId || ''}
                onValueChange={(value) => setSelectedUserId(value === currentUserId ? null : value)}
              >
                <SelectTrigger className="w-[160px] h-8 overflow-hidden">
                  <SelectValue placeholder="Seleziona utente" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {(user.first_name?.charAt(0) || '') + (user.last_name?.charAt(0) || '')}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          {user.first_name} {user.last_name}
                          {user.id === currentUserId && ' (tu)'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isViewingOtherUser && (
                <Button variant="outline" size="sm" onClick={() => setSelectedUserId(null)}>
                  Torna al mio
                </Button>
              )}
            </div>
          )}

          {/* Compare calendars button */}
          {canViewOtherUsers && (
            <Button variant="outline" size="sm" onClick={() => setShowMultiUserView(true)} className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Confronta
            </Button>
          )}

          {/* Weekly Summary */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1 border">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">Pianificate</div>
              <div className="text-sm font-bold">{formatHours(weeklyTotals.planned)}</div>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-center">
                <CheckCircle className="h-2.5 w-2.5 text-green-600" />
                Confermate
              </div>
              <div className="text-sm font-bold text-green-600">{formatHours(weeklyTotals.confirmed)}</div>
            </div>
            {weeklyTotals.planned > 0 && (
              <>
                <div className="w-px h-6 bg-border" />
                <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
                  <div className="text-[10px] text-muted-foreground">Completamento</div>
                  <Progress value={weeklyTotals.confirmed / weeklyTotals.planned * 100} className="h-1.5 w-full" />
                  <div className="text-xs font-bold">
                    {(weeklyTotals.confirmed / weeklyTotals.planned * 100).toFixed(0)}%
                  </div>
                </div>
              </>
            )}
            {weeklyContractHours > 0 && (
              <>
                <div className="w-px h-6 bg-border" />
                <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
                  <div className="text-[10px] text-muted-foreground">vs Contratto</div>
                  <Progress value={Math.min((weeklyTotals.confirmed / weeklyContractHours) * 100, 100)} className="h-1.5 w-full" />
                  <div className="text-xs font-bold">
                    {Math.round((weeklyTotals.confirmed / weeklyContractHours) * 100)}%
                  </div>
                </div>
              </>
            )}
            {/* Batch confirm button */}
            {confirmableTrackings.length > 0 && (
              <>
                <div className="w-px h-6 bg-border" />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/30"
                  onClick={() => batchConfirmMutation.mutate(confirmableTrackings)}
                  disabled={batchConfirmMutation.isPending}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Conferma tutte
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
                    {confirmableTrackings.length}
                  </Badge>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date navigation */}
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
              if (viewMode === 'day') {
                setSelectedDayDate(prev => {
                  let newDate = subDays(prev, 1);
                  if (!config.showWeekends) {
                    while (getDay(newDate) === 0 || getDay(newDate) === 6) newDate = subDays(newDate, 1);
                  }
                  return newDate;
                });
              } else {
                setCurrentWeekStart(prev => subWeeks(prev, 1));
              }
            }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-xs font-medium min-w-[140px] text-center">
              {viewMode === 'day'
                ? format(selectedDayDate, 'EEEE d MMMM yyyy', { locale: it })
                : `${format(currentWeekStart, 'd MMM', { locale: it })} - ${format(addDays(currentWeekStart, config.numberOfDays - 1), 'd MMM yyyy', { locale: it })}`
              }
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
              if (viewMode === 'day') {
                setSelectedDayDate(prev => {
                  let newDate = addDays(prev, 1);
                  if (!config.showWeekends) {
                    while (getDay(newDate) === 0 || getDay(newDate) === 6) newDate = addDays(newDate, 1);
                  }
                  return newDate;
                });
              } else {
                setCurrentWeekStart(prev => addWeeks(prev, 1));
              }
            }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => {
              if (viewMode === 'day') {
                setSelectedDayDate(new Date());
              }
              setCurrentWeekStart(startOfWeek(new Date(), {
                weekStartsOn: config.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6
              }));
            }}>
              Oggi
            </Button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center border rounded-md px-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={async () => {
                      const currentIndex = ZOOM_LEVELS.indexOf(config.zoomLevel || DEFAULT_HOUR_HEIGHT);
                      if (currentIndex > 0) {
                        const newConfig = { ...config, zoomLevel: ZOOM_LEVELS[currentIndex - 1] };
                        await saveConfig(newConfig);
                      }
                    }}
                    disabled={ZOOM_LEVELS.indexOf(config.zoomLevel || DEFAULT_HOUR_HEIGHT) === 0}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Riduci zoom</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-[10px] text-muted-foreground w-9 text-center">
              {Math.round(((config.zoomLevel || DEFAULT_HOUR_HEIGHT) / 60) * 100)}%
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={async () => {
                      const currentIndex = ZOOM_LEVELS.indexOf(config.zoomLevel || DEFAULT_HOUR_HEIGHT);
                      if (currentIndex < ZOOM_LEVELS.length - 1) {
                        const newConfig = { ...config, zoomLevel: ZOOM_LEVELS[currentIndex + 1] };
                        await saveConfig(newConfig);
                      }
                    }}
                    disabled={ZOOM_LEVELS.indexOf(config.zoomLevel || DEFAULT_HOUR_HEIGHT) === ZOOM_LEVELS.length - 1}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ingrandisci zoom</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Sidebar toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                >
                  {isSidebarVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isSidebarVisible ? 'Nascondi attività assegnate' : 'Mostra attività assegnate'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Settings */}
          <CalendarSettings
            config={config}
            onConfigChange={handleConfigChange}
            onGoogleConnectionChange={setIsGoogleConnected}
            onRestoreHiddenEvents={() => setHiddenGoogleEvents([])}
          />
        </div>
      </div>

      {/* Row 3: Category Legend */}
      <div className="flex items-center gap-2 mt-1 mb-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Categorie:</span>
        {activityCategories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${getDynamicCategorySolidColor(cat.name)}`}></div>
            <span className="text-xs text-muted-foreground">{cat.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
