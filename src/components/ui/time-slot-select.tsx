import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

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

  return (
    <Select value={normalizedValue} onValueChange={onChange}>
      <SelectTrigger id={id} className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[280px]">
        {timeSlots.map((time) => (
          <SelectItem key={time} value={time}>
            {time}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
