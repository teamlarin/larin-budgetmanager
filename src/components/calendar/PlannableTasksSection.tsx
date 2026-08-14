import { useMemo, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { CalendarIcon, Check, ChevronDown, ListChecks, Search, X } from 'lucide-react';
import { format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { DraggableTask, type PlannableTask } from './DraggableTask';

interface Props {
  tasks: PlannableTask[];
  isReadOnly: boolean;
}

/**
 * Sezione "Task da pianificare" con ricerca libera, filtro per attività di budget
 * e filtro per intervallo di scadenza. I filtri sono locali alla sidebar.
 */
export function PlannableTasksSection({ tasks, isReadOnly }: Props) {
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const activityOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(task => map.set(task.budget_item_id, task.activity_name));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = dateRange?.from ? startOfDay(dateRange.from) : null;
    const to = dateRange?.to ? startOfDay(dateRange.to) : from;

    return tasks.filter(task => {
      if (activityFilter !== 'all' && task.budget_item_id !== activityFilter) return false;

      if (query) {
        const haystack = `${task.title} ${task.activity_name} ${task.project_name}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (from) {
        if (!task.due_date) return false;
        const due = startOfDay(parseISO(task.due_date));
        if (isBefore(due, from)) return false;
        if (to && isAfter(due, to)) return false;
      }

      return true;
    });
  }, [tasks, search, activityFilter, dateRange]);

  const selectedActivityName = activityOptions.find(a => a.id === activityFilter)?.name;
  const hasFilters = !!search || activityFilter !== 'all' || !!dateRange?.from;

  const resetFilters = () => {
    setSearch('');
    setActivityFilter('all');
    setDateRange(undefined);
  };

  const rangeLabel = dateRange?.from
    ? dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
      ? `${format(dateRange.from, 'd MMM', { locale: it })} - ${format(dateRange.to, 'd MMM', { locale: it })}`
      : format(dateRange.from, 'd MMM yyyy', { locale: it })
    : 'Scadenza';

  return (
    <Collapsible defaultOpen className="border-t pt-3">
      <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          Task da pianificare ({hasFilters ? `${filteredTasks.length}/${tasks.length}` : tasks.length})
        </span>
        <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca task..."
            className="h-8 pl-7 text-xs"
          />
        </div>

        <div className="flex gap-1.5">
          {/* Filtro attività */}
          <Popover open={activityPickerOpen} onOpenChange={setActivityPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 justify-between text-[11px] font-normal px-2 min-w-0"
              >
                <span className="truncate">{activityFilter === 'all' ? 'Tutte le attività' : selectedActivityName}</span>
                <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Cerca attività..." className="h-9 text-xs" />
                <CommandList>
                  <CommandEmpty>Nessuna attività</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="tutte le attività"
                      onSelect={() => {
                        setActivityFilter('all');
                        setActivityPickerOpen(false);
                      }}
                      className="text-xs"
                    >
                      <Check className={cn('mr-2 h-3.5 w-3.5', activityFilter === 'all' ? 'opacity-100' : 'opacity-0')} />
                      Tutte le attività
                    </CommandItem>
                    {activityOptions.map(option => (
                      <CommandItem
                        key={option.id}
                        value={option.name}
                        onSelect={() => {
                          setActivityFilter(option.id);
                          setActivityPickerOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn('mr-2 h-3.5 w-3.5', activityFilter === option.id ? 'opacity-100' : 'opacity-0')}
                        />
                        <span className="truncate">{option.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Filtro intervallo scadenza */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 justify-start text-[11px] font-normal px-2 flex-shrink-0',
                  !dateRange?.from && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-1 h-3 w-3" />
                <span className="truncate max-w-[92px]">{rangeLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                locale={it}
                weekStartsOn={1}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
              <div className="flex justify-between border-t p-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDateRange(undefined)}>
                  Azzera
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => setDatePickerOpen(false)}>
                  Applica
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-[10px]">
              {filteredTasks.length} task filtrate
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={resetFilters}>
              <X className="h-3 w-3 mr-1" />
              Azzera filtri
            </Button>
          </div>
        )}

        {!isReadOnly && filteredTasks.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Trascina una task su uno slot del calendario per pianificarla.
          </p>
        )}

        {filteredTasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-xs">
            {hasFilters ? 'Nessuna task corrisponde ai filtri' : 'Nessuna task da pianificare'}
          </p>
        ) : (
          <div>
            {filteredTasks.map(task => (
              <DraggableTask key={task.id} task={task} disabled={isReadOnly} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
