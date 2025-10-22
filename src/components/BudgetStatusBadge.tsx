import { Badge } from '@/components/ui/badge';

interface BudgetStatusBadgeProps {
  status: 'in_attesa' | 'approvato' | 'rifiutato';
}

export const BudgetStatusBadge = ({ status }: BudgetStatusBadgeProps) => {
  const statusConfig = {
    in_attesa: {
      label: 'In Attesa',
      variant: 'secondary' as const,
    },
    approvato: {
      label: 'Approvato',
      variant: 'default' as const,
    },
    rifiutato: {
      label: 'Rifiutato',
      variant: 'destructive' as const,
    },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
};
