import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useApprovedProfiles } from '@/hooks/useProfiles';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Target, MessageSquare, Briefcase, GraduationCap, Star } from 'lucide-react';

interface Review {
  id: string;
  user_id: string;
  year: number;
  compilation_period: string | null;
  job_title: string | null;
  team: string | null;
  team_leader_name: string | null;
  start_date: string | null;
  contract_history: string | null;
  compensation: string | null;
  contract_type: string | null;
  career_target_role: string | null;
  career_long_term_goal: string | null;
  company_support: string | null;
  strengths: string | null;
  improvement_areas: string | null;
}

interface Objective {
  id: string;
  review_id: string;
  title: string;
  description: string | null;
  bonus_percentage: number;
  sort_order: number;
}

interface QNote {
  id: string;
  review_id: string;
  quarter: string;
  notes: string | null;
}

const emptyReview = {
  user_id: '',
  year: new Date().getFullYear(),
  compilation_period: '',
  job_title: '',
  team: '',
  team_leader_name: '',
  start_date: '',
  contract_history: '',
  compensation: '',
  contract_type: '',
  career_target_role: '',
  career_long_term_goal: '',
  company_support: '',
  strengths: '',
  improvement_areas: '',
};

export const PerformanceReviewManagement = () => {
  const { toast } = useToast();
  const profiles = useApprovedProfiles();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [form, setForm] = useState(emptyReview);
  const [saving, setSaving] = useState(false);

  // Objectives & quarterly notes for selected review
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [quarterlyNotes, setQuarterlyNotes] = useState<QNote[]>([]);
  const [objDialogOpen, setObjDialogOpen] = useState(false);
  const [objForm, setObjForm] = useState({ title: '', description: '', bonus_percentage: 0, sort_order: 0 });
  const [editingObj, setEditingObj] = useState<Objective | null>(null);
  const [noteForm, setNoteForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedUserId) loadReviews();
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedReview) loadDetails(selectedReview.id);
  }, [selectedReview]);

  const loadReviews = async () => {
    const { data } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('user_id', selectedUserId)
      .order('year', { ascending: false });
    setReviews((data || []) as unknown as Review[]);
    setSelectedReview(null);
  };

  const loadDetails = async (reviewId: string) => {
    const [o, n] = await Promise.all([
      supabase.from('performance_objectives').select('*').eq('review_id', reviewId).order('sort_order'),
      supabase.from('performance_quarterly_notes').select('*').eq('review_id', reviewId).order('quarter'),
    ]);
    setObjectives((o.data || []) as unknown as Objective[]);
    const notes = (n.data || []) as unknown as QNote[];
    setQuarterlyNotes(notes);
    const nf: Record<string, string> = {};
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      nf[q] = notes.find(nn => nn.quarter === q)?.notes || '';
    });
    setNoteForm(nf);
  };

  const openCreate = () => {
    setEditingReview(null);
    setForm({ ...emptyReview, user_id: selectedUserId });
    setDialogOpen(true);
  };

  const openEdit = (r: Review) => {
    setEditingReview(r);
    setForm({
      user_id: r.user_id,
      year: r.year,
      compilation_period: r.compilation_period || '',
      job_title: r.job_title || '',
      team: r.team || '',
      team_leader_name: r.team_leader_name || '',
      start_date: r.start_date || '',
      contract_history: r.contract_history || '',
      compensation: r.compensation || '',
      contract_type: r.contract_type || '',
      career_target_role: r.career_target_role || '',
      career_long_term_goal: r.career_long_term_goal || '',
      company_support: r.company_support || '',
      strengths: r.strengths || '',
      improvement_areas: r.improvement_areas || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        user_id: form.user_id || selectedUserId,
        year: form.year,
        compilation_period: form.compilation_period || null,
        job_title: form.job_title || null,
        team: form.team || null,
        team_leader_name: form.team_leader_name || null,
        start_date: form.start_date || null,
        contract_history: form.contract_history || null,
        compensation: form.compensation || null,
        contract_type: form.contract_type || null,
        career_target_role: form.career_target_role || null,
        career_long_term_goal: form.career_long_term_goal || null,
        company_support: form.company_support || null,
        strengths: form.strengths || null,
        improvement_areas: form.improvement_areas || null,
      };

      if (editingReview) {
        const { error } = await supabase.from('performance_reviews').update(payload).eq('id', editingReview.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('performance_reviews').insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Salvato', description: 'Scheda performance salvata' });
      setDialogOpen(false);
      loadReviews();
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questa scheda performance?')) return;
    await supabase.from('performance_reviews').delete().eq('id', id);
    loadReviews();
  };

  // Objectives
  const handleSaveObjective = async () => {
    if (!selectedReview) return;
    try {
      const payload: any = {
        review_id: selectedReview.id,
        title: objForm.title,
        description: objForm.description || null,
        bonus_percentage: objForm.bonus_percentage,
        sort_order: objForm.sort_order,
      };
      if (editingObj) {
        await supabase.from('performance_objectives').update(payload).eq('id', editingObj.id);
      } else {
        await supabase.from('performance_objectives').insert(payload);
      }
      setObjDialogOpen(false);
      setEditingObj(null);
      setObjForm({ title: '', description: '', bonus_percentage: 0, sort_order: 0 });
      loadDetails(selectedReview.id);
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteObjective = async (id: string) => {
    if (!selectedReview) return;
    await supabase.from('performance_objectives').delete().eq('id', id);
    loadDetails(selectedReview.id);
  };

  // Quarterly notes
  const handleSaveNotes = async () => {
    if (!selectedReview) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
        const existing = quarterlyNotes.find(n => n.quarter === q);
        if (existing) {
          await supabase.from('performance_quarterly_notes').update({ notes: noteForm[q] || null }).eq('id', existing.id);
        } else if (noteForm[q]) {
          await supabase.from('performance_quarterly_notes').insert({
            review_id: selectedReview.id,
            quarter: q,
            notes: noteForm[q],
            created_by: user?.id,
          });
        }
      }
      toast({ title: 'Note trimestrali salvate' });
      loadDetails(selectedReview.id);
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const selectedProfile = profiles.find(p => p.id === selectedUserId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestione Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User selector */}
          <div className="flex items-center gap-4">
            <Label>Utente:</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Seleziona utente..." />
              </SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUserId && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-medium">
                  Schede di {selectedProfile?.first_name} {selectedProfile?.last_name}
                </h3>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nuova Scheda
                </Button>
              </div>

              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessuna scheda performance.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anno</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map(r => (
                      <TableRow
                        key={r.id}
                        className={`cursor-pointer ${selectedReview?.id === r.id ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedReview(r)}
                      >
                        <TableCell className="font-medium">{r.year}</TableCell>
                        <TableCell>{r.job_title || '-'}</TableCell>
                        <TableCell>{r.team || '-'}</TableCell>
                        <TableCell><Badge variant="secondary">{r.compilation_period || '-'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail panel for selected review */}
      {selectedReview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Dettaglio {selectedReview.year} — {selectedProfile?.first_name} {selectedProfile?.last_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="objectives">
              <TabsList>
                <TabsTrigger value="objectives" className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  Obiettivi
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  Note Trimestrali
                </TabsTrigger>
              </TabsList>

              <TabsContent value="objectives" className="space-y-4 mt-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => {
                    setEditingObj(null);
                    setObjForm({ title: '', description: '', bonus_percentage: 0, sort_order: objectives.length });
                    setObjDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi Obiettivo
                  </Button>
                </div>

                {objectives.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Obiettivo</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead className="text-right">% Premio</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {objectives.map((obj, i) => (
                        <TableRow key={obj.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{obj.title}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{obj.description || '-'}</TableCell>
                          <TableCell className="text-right"><Badge variant="outline">{obj.bonus_percentage}%</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => {
                                setEditingObj(obj);
                                setObjForm({ title: obj.title, description: obj.description || '', bonus_percentage: obj.bonus_percentage, sort_order: obj.sort_order });
                                setObjDialogOpen(true);
                              }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteObjective(obj.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Nessun obiettivo definito.</p>
                )}
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                    <div key={q} className="space-y-2">
                      <Label>{q}</Label>
                      <Textarea
                        value={noteForm[q] || ''}
                        onChange={(e) => setNoteForm({ ...noteForm, [q]: e.target.value })}
                        placeholder={`Note ${q}...`}
                        rows={4}
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={handleSaveNotes}>Salva Note Trimestrali</Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Review form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReview ? 'Modifica Scheda' : 'Nuova Scheda Performance'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Anno *</Label>
                <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Periodo compilazione</Label>
                <Input value={form.compilation_period} onChange={e => setForm({ ...form, compilation_period: e.target.value })} placeholder="Es. Q4 2025" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ruolo</Label>
                <Input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Team</Label>
                <Input value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Team Leader</Label>
                <Input value={form.team_leader_name} onChange={e => setForm({ ...form, team_leader_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data inizio</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo contratto</Label>
                <Input value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Compenso</Label>
                <Input value={form.compensation} onChange={e => setForm({ ...form, compensation: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Storico variazioni contrattuali</Label>
              <Textarea value={form.contract_history} onChange={e => setForm({ ...form, contract_history: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Ruolo obiettivo (carriera)</Label>
              <Input value={form.career_target_role} onChange={e => setForm({ ...form, career_target_role: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Obiettivo a lungo termine</Label>
              <Textarea value={form.career_long_term_goal} onChange={e => setForm({ ...form, career_long_term_goal: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Supporto dell'azienda</Label>
              <Textarea value={form.company_support} onChange={e => setForm({ ...form, company_support: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Punti di forza</Label>
                <Textarea value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Aree di miglioramento</Label>
                <Textarea value={form.improvement_areas} onChange={e => setForm({ ...form, improvement_areas: e.target.value })} rows={3} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Objective form dialog */}
      <Dialog open={objDialogOpen} onOpenChange={setObjDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingObj ? 'Modifica Obiettivo' : 'Nuovo Obiettivo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titolo *</Label>
              <Input value={objForm.title} onChange={e => setObjForm({ ...objForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrizione / Risultati attesi</Label>
              <Textarea value={objForm.description} onChange={e => setObjForm({ ...objForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>% Premio</Label>
                <Input type="number" value={objForm.bonus_percentage} onChange={e => setObjForm({ ...objForm, bonus_percentage: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Ordine</Label>
                <Input type="number" value={objForm.sort_order} onChange={e => setObjForm({ ...objForm, sort_order: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setObjDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSaveObjective}>{editingObj ? 'Aggiorna' : 'Aggiungi'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
