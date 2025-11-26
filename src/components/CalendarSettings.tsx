import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';

export interface CalendarConfig {
  numberOfDays: number;
  showWeekends: boolean;
  timezone: string;
  weekStartsOn: number;
  workDayStart: string;
  workDayEnd: string;
  defaultSlotDuration: number;
}

const DEFAULT_CONFIG: CalendarConfig = {
  numberOfDays: 7,
  showWeekends: true,
  timezone: 'Europe/Rome',
  weekStartsOn: 1, // Monday
  workDayStart: '08:00',
  workDayEnd: '18:00',
  defaultSlotDuration: 60, // minutes
};

const TIMEZONES = [
  'Europe/Rome',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const WEEKDAYS = [
  { value: 0, label: 'Domenica' },
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
];

const SLOT_DURATIONS = [
  { value: 15, label: '15 minuti' },
  { value: 30, label: '30 minuti' },
  { value: 45, label: '45 minuti' },
  { value: 60, label: '1 ora' },
];

interface CalendarSettingsProps {
  config: CalendarConfig;
  onConfigChange: (config: CalendarConfig) => void;
}

export function CalendarSettings({ config, onConfigChange }: CalendarSettingsProps) {
  const [localConfig, setLocalConfig] = useState<CalendarConfig>(config);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onConfigChange(localConfig);
    localStorage.setItem('calendarConfig', JSON.stringify(localConfig));
    toast.success('Impostazioni salvate');
    setOpen(false);
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_CONFIG);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Impostazioni Calendario</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* View Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Opzioni di Visualizzazione</h3>
            
            {/* Number of Days */}
            <div className="space-y-2">
              <Label>Numero di giorni da visualizzare</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <Button
                    key={num}
                    variant={localConfig.numberOfDays === num ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLocalConfig({ ...localConfig, numberOfDays: num })}
                  >
                    {num === 7 ? 'W' : num}
                  </Button>
                ))}
                <Button
                  variant={localConfig.numberOfDays === 30 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocalConfig({ ...localConfig, numberOfDays: 30 })}
                >
                  M
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                W = Settimana, M = Mese
              </p>
            </div>

            {/* Show Weekends */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Visualizza fine settimana</Label>
                <p className="text-xs text-muted-foreground">
                  Mostra o nascondi sabato e domenica
                </p>
              </div>
              <Switch
                checked={localConfig.showWeekends}
                onCheckedChange={(checked) =>
                  setLocalConfig({ ...localConfig, showWeekends: checked })
                }
              />
            </div>
          </div>

          {/* Time Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Impostazioni Orario</h3>
            
            {/* Timezone */}
            <div className="space-y-2">
              <Label>Fuso orario</Label>
              <Select
                value={localConfig.timezone}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, timezone: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Week Starts On */}
            <div className="space-y-2">
              <Label>La settimana inizia di</Label>
              <Select
                value={localConfig.weekStartsOn.toString()}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, weekStartsOn: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {WEEKDAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Work Day Start */}
            <div className="space-y-2">
              <Label>Inizio giornata lavorativa</Label>
              <Select
                value={localConfig.workDayStart}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, workDayStart: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return (
                      <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                        {hour}:00
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Work Day End */}
            <div className="space-y-2">
              <Label>Fine giornata lavorativa</Label>
              <Select
                value={localConfig.workDayEnd}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, workDayEnd: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return (
                      <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                        {hour}:00
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Activity Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Impostazioni Attività</h3>
            
            {/* Default Slot Duration */}
            <div className="space-y-2">
              <Label>Dimensione slot predefinita</Label>
              <Select
                value={localConfig.defaultSlotDuration.toString()}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, defaultSlotDuration: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {SLOT_DURATIONS.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value.toString()}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Durata predefinita quando trascini un'attività nel calendario
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Ripristina predefinite
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              Salva
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function loadCalendarConfig(): CalendarConfig {
  try {
    const saved = localStorage.getItem('calendarConfig');
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('Error loading calendar config:', error);
  }
  return DEFAULT_CONFIG;
}
