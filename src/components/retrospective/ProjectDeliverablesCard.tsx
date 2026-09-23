import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { useProjectDeliverables, type ProjectDeliverable } from '@/hooks/useProjectRetrospective';

interface Props {
  projectId: string;
  canManage: boolean;
}

/** Registro consegne: data prevista vs data effettiva, alimenta la puntualit\u00e0 (OTD). */
export const ProjectDeliverablesCard = ({ projectId, canManage }: Props) => {
  const { deliverables, createDeliverable, updateDeliverable, deleteDeliverable } =
    useProjectDeliverables(projectId);
  const [newName, setNewName] = useState('');
  const [newPlanned, setNewPlanned] = useState('');

  const delay = (d: ProjectDeliverable) =>
    d.planned_date && d.actual_date
      ? differenceInCalendarDays(new Date(d.actual_date), new Date(d.planned_date))
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consegne / Milestone</CardTitle>
        <CardDescription>
          Titolo, data prevista e data di consegna effettiva: alimenta la puntualità nei dati
          oggettivi della retrospettiva.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {deliverables.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna consegna registrata.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consegna</TableHead>
                  <TableHead className="w-[150px]">Prevista</TableHead>
                  <TableHead className="w-[150px]">Effettiva</TableHead>
                  <TableHead className="w-[110px]">Scostamento</TableHead>
                  {canManage && <TableHead className="w-[60px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliverables.map((d) => {
                  const diff = delay(d);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium break-words">{d.name}</TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={d.planned_date || ''}
                          disabled={!canManage}
                          onChange={(e) =>
                            updateDeliverable.mutate({ id: d.id, planned_date: e.target.value || null })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={d.actual_date || ''}
                          disabled={!canManage}
                          onChange={(e) =>
                            updateDeliverable.mutate({ id: d.id, actual_date: e.target.value || null })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {diff === null ? (
                          <span className="text-muted-foreground text-sm">—</span>
                        ) : diff <= 0 ? (
                          <Badge variant="outline" className="text-green-600 border-green-600/40">
                            In tempo
                          </Badge>
                        ) : (
                          <Badge variant="destructive">+{diff} g</Badge>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteDeliverable.mutate(d.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {canManage && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Nome consegna (es. Consegna sito)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              type="date"
              className="sm:w-[180px]"
              value={newPlanned}
              onChange={(e) => setNewPlanned(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!newName.trim()}
              onClick={() => {
                createDeliverable.mutate(
                  { name: newName.trim(), planned_date: newPlanned || null },
                  {
                    onSuccess: () => {
                      setNewName('');
                      setNewPlanned('');
                    },
                  },
                );
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
