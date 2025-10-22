import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BudgetStatusBadgeProps {
  status: 'in_attesa' | 'approvato' | 'rifiutato';
}

export const BudgetStatusBadge = ({ status }: BudgetStatusBadgeProps) => {
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

  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      {config.label}
    </Badge>
  );
};
