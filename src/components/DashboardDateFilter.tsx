import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DashboardDateFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

type PresetPeriod = 'today' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'custom';

export const DashboardDateFilter = ({ dateRange, onDateRangeChange }: DashboardDateFilterProps) => {
  const [preset, setPreset] = useState<PresetPeriod>('thisMonth');
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetChange = (value: PresetPeriod) => {
    setPreset(value);
    const now = new Date();
    
    let newRange: DateRange;
    
    switch (value) {
      case 'today':
        newRange = { from: now, to: now };
        break;
      case 'last7days':
        newRange = { from: subDays(now, 7), to: now };
        break;
      case 'last30days':
        newRange = { from: subDays(now, 30), to: now };
        break;
      case 'thisMonth':
        newRange = { from: startOfMonth(now), to: endOfMonth(now) };
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        newRange = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        break;
      case 'thisQuarter':
        newRange = { from: startOfQuarter(now), to: endOfQuarter(now) };
        break;
      case 'thisYear':
        newRange = { from: startOfYear(now), to: endOfYear(now) };
        break;
      case 'custom':
        return;
      default:
        newRange = { from: startOfMonth(now), to: endOfMonth(now) };
    }
    
    onDateRangeChange(newRange);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Periodo:</span>
      </div>
      
      <Select value={preset} onValueChange={(v) => handlePresetChange(v as PresetPeriod)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Seleziona periodo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Oggi</SelectItem>
          <SelectItem value="last7days">Ultimi 7 giorni</SelectItem>
          <SelectItem value="last30days">Ultimi 30 giorni</SelectItem>
          <SelectItem value="thisMonth">Questo mese</SelectItem>
          <SelectItem value="lastMonth">Mese scorso</SelectItem>
          <SelectItem value="thisQuarter">Questo trimestre</SelectItem>
          <SelectItem value="thisYear">Quest'anno</SelectItem>
          <SelectItem value="custom">Personalizzato</SelectItem>
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange?.to ? (
                    <>
                      {format(dateRange.from, "dd MMM yyyy", { locale: it })} -{" "}
                      {format(dateRange.to, "dd MMM yyyy", { locale: it })}
                    </>
                  ) : (
                    format(dateRange.from, "dd MMM yyyy", { locale: it })
                  )
                ) : (
                  <span>Seleziona date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={{ from: dateRange?.from, to: dateRange?.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    onDateRangeChange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        {format(dateRange.from, "dd MMM yyyy", { locale: it })} - {format(dateRange.to, "dd MMM yyyy", { locale: it })}
      </div>
    </div>
  );
};
