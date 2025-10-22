import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BudgetStatusBadgeProps {
  status: 'in_attesa' | 'approvato' | 'rifiutato';
  statusChangedAt?: string;
}

export const BudgetStatusBadge = ({ status, statusChangedAt }: BudgetStatusBadgeProps) => {
  const statusConfig = {
    in_attesa: {
      label: 'In Attesa',
      variant: 'secondary' as const,
      className: '',
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
  
  // Show tooltip only for approvato or rifiutato status with a valid date
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
