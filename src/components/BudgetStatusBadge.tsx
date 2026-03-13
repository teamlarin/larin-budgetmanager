import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BudgetStatusBadgeProps {
  status: 'bozza' | 'in_attesa' | 'in_revisione' | 'approvato' | 'rifiutato';
  statusChangedAt?: string;
}

export const BudgetStatusBadge = ({ status, statusChangedAt }: BudgetStatusBadgeProps) => {
  const statusConfig = {
    bozza: {
      label: 'Bozza',
      variant: 'outline' as const,
      className: 'border-muted-foreground/40 text-muted-foreground',
    },
    in_attesa: {
      label: 'In Attesa',
      variant: 'secondary' as const,
      className: '',
    },
    in_revisione: {
      label: 'In Revisione',
      variant: 'default' as const,
      className: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    approvato: {
      label: 'Approvato',
      variant: 'default' as const,
      className: 'bg-green-600 hover:bg-green-700 text-white',
    },
    rifiutato: {
      label: 'Rifiutato',
      variant: 'destructive' as const,
      className: '',
    },
  };

  const config = statusConfig[status];
  
  const showTooltip = (status === 'approvato' || status === 'rifiutato') && statusChangedAt;
  
  const badgeContent = (
    <Badge variant={config.variant} className={cn(config.className)}>
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  const formattedDate = new Date(statusChangedAt).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {status === 'approvato' ? 'Approvato il' : 'Rifiutato il'} {formattedDate}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
