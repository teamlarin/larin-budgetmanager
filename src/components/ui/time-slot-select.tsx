import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TimeSlotSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  startHour?: number;
  endHour?: number;
  stepMinutes?: number;
  placeholder?: string;
}

// Generate time slots in 15-minute increments
function generateTimeSlots(
  startHour: number = 0,
  endHour: number = 24,
  stepMinutes: number = 15
): string[] {
  const slots: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  // Add the final time slot at endHour:00 if needed
  if (endHour <= 24) {
    slots.push(`${endHour.toString().padStart(2, '0')}:00`);
  }
  return slots;
}

export function TimeSlotSelect({
  value,
  onChange,
  className,
  id,
  startHour = 0,
  endHour = 24,
  stepMinutes = 15,
  placeholder = 'Seleziona orario',
}: TimeSlotSelectProps) {
  const timeSlots = React.useMemo(
    () => generateTimeSlots(startHour, endHour, stepMinutes),
    [startHour, endHour, stepMinutes]
  );

  // Normalize value to HH:mm format (in case it comes as HH:mm:ss)
  const normalizedValue = value ? value.substring(0, 5) : '';

  // Reference to scroll to selected item
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Scroll to selected item when dropdown opens
  const handleOpenChange = React.useCallback((open: boolean) => {
    if (open && normalizedValue && scrollRef.current) {
      // Find the index of the selected value
      const selectedIndex = timeSlots.indexOf(normalizedValue);
      if (selectedIndex >= 0) {
        // Delay to ensure the content is rendered
        setTimeout(() => {
          const itemHeight = 32; // Approximate height of each item
          const scrollPosition = Math.max(0, selectedIndex * itemHeight - 50);
          scrollRef.current?.scrollTo({ top: scrollPosition, behavior: 'auto' });
        }, 0);
      }
    }
  }, [normalizedValue, timeSlots]);

  return (
    <Select value={normalizedValue} onValueChange={onChange} onOpenChange={handleOpenChange}>
      <SelectTrigger id={id} className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <ScrollArea className="h-[280px]" ref={scrollRef}>
          {timeSlots.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </ScrollArea>
      </SelectContent>
    </Select>
  );
}
