import { BudgetItem } from '@/types/budget';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Clock, User, Euro } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryBadgeColor } from '@/lib/categoryColors';

interface BudgetItemCardProps {
  item: BudgetItem;
  onEdit: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
}

export const BudgetItemCard = ({ item, onEdit, onDelete }: BudgetItemCardProps) => {
  return (
    <Card className="bg-gradient-card shadow-soft hover:shadow-medium transition-all duration-300 border-0">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Badge className={cn("text-xs font-medium", getCategoryBadgeColor(item.category))}>
            {item.category}
          </Badge>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(item)}
              className="h-8 w-8 p-0 hover:bg-primary/10"
            >
              <Edit className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(item.id)}
              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <h3 className="font-semibold text-foreground leading-tight">
          {item.activityName}
        </h3>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="w-4 h-4" />
          <span>{item.assigneeName}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Euro className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-medium">{item.hourlyRate} €/ora</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-medium">{item.hoursWorked}h</span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Costo Totale</span>
            <span className="text-lg font-bold text-primary">
              {item.totalCost.toLocaleString()} €
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};