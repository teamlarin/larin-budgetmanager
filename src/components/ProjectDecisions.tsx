import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Lightbulb, Plus, Pencil, Trash2, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProjectDecisionsProps {
  projectId: string;
}

interface DecisionRow {
  id: string;
  project_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  updated_by: string | null;
  _authorName?: string;
}

const ROLES_THAT_CAN_ADD = new Set(['admin', 'team_leader', 'coordinator', 'account']);

export const ProjectDecisions = ({ projectId }: ProjectDecisionsProps) => {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);

  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load current user + roles
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      setCurrentUserRoles((roles ?? []).map((r) => r.role as string));
    })();
  }, []);

  const isAdmin = currentUserRoles.includes('admin');
  const canAdd = currentUserRoles.some((r) => ROLES_THAT_CAN_ADD.has(r));

  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ['project-decisions', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_decisions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = Array.from(
        new Set(
          (data ?? []).flatMap((d) => [d.created_by, d.updated_by].filter(Boolean) as string[])
        )
      );
      const namesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name')
          .in('id', userIds);
        profiles?.forEach((p: any) => {
          namesMap[p.id] =
            p.full_name ||
            `${p.first_name || ''} ${p.last_name || ''}`.trim() ||
            'Utente';
        });
      }

      return (data ?? []).map((d) => ({
        ...d,
        _authorName: namesMap[d.created_by] || 'Utente',
      })) as DecisionRow[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['project-decisions', projectId] });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentUserId) throw new Error('Utente non autenticato');
      const { error } = await supabase.from('project_decisions').insert({
        project_id: projectId,
        content: content.trim(),
        created_by: currentUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Decisione registrata');
      setNewContent('');
      setIsAdding(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? 'Errore nel salvataggio'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      if (!currentUserId) throw new Error('Utente non autenticato');
      const { error } = await supabase
        .from('project_decisions')
        .update({ content: content.trim(), updated_by: currentUserId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Decisione aggiornata');
      setEditingId(null);
      setEditingContent('');
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? 'Errore nell\'aggiornamento'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_decisions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Decisione eliminata');
      setDeletingId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? 'Errore nell\'eliminazione'),
  });

  const canModify = (d: DecisionRow) => isAdmin || d.created_by === currentUserId;

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && newContent.trim()) {
      e.preventDefault();
      addMutation.mutate(newContent);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && editingContent.trim()) {
      e.preventDefault();
      updateMutation.mutate({ id, content: editingContent });
    }
  };

  const count = decisions.length;
  const deletingDecision = useMemo(
    () => decisions.find((d) => d.id === deletingId) ?? null,
    [decisions, deletingId]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Decisioni{count > 0 ? ` (${count})` : ''}
        </CardTitle>
        {canAdd && !isAdding && (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Aggiungi decisione
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <Textarea
              autoFocus
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="Scrivi la decisione… (Ctrl/Cmd + Enter per salvare)"
              rows={3}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewContent('');
                }}
                disabled={addMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={() => addMutation.mutate(newContent)}
                disabled={!newContent.trim() || addMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Salva decisione
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Caricamento…</p>
        ) : decisions.length === 0 && !isAdding ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessuna decisione registrata. Inizia tracciando la prima.
          </p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4 pl-4">
            {decisions.map((d) => {
              const isEditing = editingId === d.id;
              return (
                <li key={d.id} className="relative">
                  <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium text-foreground">
                          {format(new Date(d.created_at), "d MMM yyyy 'alle' HH:mm", { locale: it })}
                        </span>
                        <span>·</span>
                        <span>{d._authorName}</span>
                        {d.updated_at && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            modificata il {format(new Date(d.updated_at), 'd MMM HH:mm', { locale: it })}
                          </Badge>
                        )}
                      </div>
                      {canModify(d) && !isEditing && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => {
                              setEditingId(d.id);
                              setEditingContent(d.content);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setDeletingId(d.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          autoFocus
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onKeyDown={(e) => handleEditKeyDown(e, d.id)}
                          rows={3}
                          className="resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditingContent('');
                            }}
                            disabled={updateMutation.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Annulla
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateMutation.mutate({ id: d.id, content: editingContent })}
                            disabled={!editingContent.trim() || updateMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Salva
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{d.content}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa decisione?</AlertDialogTitle>
            <AlertDialogDescription>
              L'operazione è permanente. La decisione verrà rimossa dal log del progetto.
              {deletingDecision && (
                <span className="block mt-2 italic text-muted-foreground line-clamp-3">
                  "{deletingDecision.content}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
