import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Users } from 'lucide-react';

interface UserHoursData {
  id: string;
  name: string;
  confirmedHours: number;
  contractHours: number;
  contractType: string;
  contractHoursPeriod: string;
}

interface UserHoursSummaryProps {
  usersData: UserHoursData[];
  periodLabel: string;
}

export const UserHoursSummary = ({ usersData, periodLabel }: UserHoursSummaryProps) => {
  const formatHours = (hours: number) => {
    return hours.toFixed(1).replace('.', ',');
  };

  const getPercentage = (confirmed: number, contract: number) => {
    if (contract === 0) return 0;
    return Math.min((confirmed / contract) * 100, 100);
  };

  const getStatusBadge = (confirmed: number, contract: number) => {
    if (contract === 0) return <Badge variant="secondary">N/D</Badge>;
    const percentage = (confirmed / contract) * 100;
    if (percentage >= 100) {
      return <Badge className="bg-green-500 text-white">Completato</Badge>;
    } else if (percentage >= 75) {
      return <Badge className="bg-blue-500 text-white">In linea</Badge>;
    } else if (percentage >= 50) {
      return <Badge variant="secondary">In corso</Badge>;
    } else {
      return <Badge variant="outline">Iniziato</Badge>;
    }
  };

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case 'full-time':
        return 'Dipendente FT';
      case 'part-time':
        return 'Dipendente PT';
      case 'freelance':
        return 'Freelance';
      default:
        return type;
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'daily':
        return '/giorno';
      case 'weekly':
        return '/settimana';
      case 'monthly':
        return '/mese';
      default:
        return '';
    }
  };

  const totalConfirmed = usersData.reduce((sum, u) => sum + u.confirmedHours, 0);
  const totalContract = usersData.reduce((sum, u) => sum + u.contractHours, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Riepilogo Ore Team
            </CardTitle>
            <CardDescription>
              Ore confermate vs ore da contratto - {periodLabel}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {usersData.length} utenti
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {usersData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessun dato disponibile per il periodo selezionato
          </p>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Ore Confermate</p>
                <p className="text-lg font-bold">{formatHours(totalConfirmed)}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ore Contratto</p>
                <p className="text-lg font-bold">{formatHours(totalContract)}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completamento</p>
                <p className="text-lg font-bold">
                  {totalContract > 0 ? Math.round((totalConfirmed / totalContract) * 100) : 0}%
                </p>
              </div>
            </div>

            {/* Users Table */}
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Confermate</TableHead>
                    <TableHead className="text-right">Contratto</TableHead>
                    <TableHead className="w-[150px]">Progresso</TableHead>
                    <TableHead className="text-center">Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {getContractTypeLabel(user.contractType)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHours(user.confirmedHours)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHours(user.contractHours)}h
                        <span className="text-xs text-muted-foreground ml-1">
                          {getPeriodLabel(user.contractHoursPeriod)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Progress 
                          value={getPercentage(user.confirmedHours, user.contractHours)} 
                          className="h-2"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(user.confirmedHours, user.contractHours)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
