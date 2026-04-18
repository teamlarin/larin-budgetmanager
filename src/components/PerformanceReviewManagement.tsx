import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useApprovedProfiles } from '@/hooks/useProfiles';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Target, MessageSquare, Briefcase, GraduationCap, Star, History, ArrowLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface ContractPeriod {
  id: string;
  start_date: string;
  end_date: string | null;
  contract_type: string;
  contract_hours: number;
  contract_hours_period: string;
  hourly_rate: number;
}

interface Review {
  id: string;
  user_id: string;
  year: number;
  compilation_period: string | null;
  strengths: string | null;
  improvement_areas: string | null;
}

interface PerformanceProfile {
  id: string;
  user_id: string;
  job_title: string | null;
  team: string | null;
  team_leader_name: string | null;
  start_date: string | null;
  contract_type: string | null;
  compensation: string | null;
  contract_history: string | null;
  career_target_role: string | null;
  career_long_term_goal: string | null;
  company_support: string | null;
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
  strengths: '',
  improvement_areas: '',
};

const emptyProfile = {
  job_title: '',
  team: '',
  team_leader_name: '',
  start_date: '',
  contract_type: '',
  compensation: '',
  contract_history: '',
  career_target_role: '',
  career_long_term_goal: '',
  company_support: '',
};

export const PerformanceReviewManagement = () => {
  const { toast } = useToast();
  const profiles = useApprovedProfiles();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [previews, setPreviews] = useState<Record<string, { reviewCount: number; lastYear: number | null; hasProfile: boolean; jobTitle: string | null; team: string | null }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [form, setForm] = useState(emptyReview);
  const [saving, setSaving] = useState(false);

  // Performance profile (persistent per-user data)
  const [perfProfile, setPerfProfile] = useState<PerformanceProfile | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [profileSaving, setProfileSaving] = useState(false);

  // Objectives & quarterly notes for selected review
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [quarterlyNotes, setQuarterlyNotes] = useState<QNote[]>([]);
  const [objDialogOpen, setObjDialogOpen] = useState(false);
  const [objForm, setObjForm] = useState({ title: '', description: '', bonus_percentage: 0, sort_order: 0 });
  const [editingObj, setEditingObj] = useState<Objective | null>(null);
  const [noteForm, setNoteForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedUserId) {
      loadReviews();
      loadPerfProfile();
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedReview) loadDetails(selectedReview.id);
  }, [selectedReview]);

  useEffect(() => {
    if (profiles.length > 0) loadPreviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.length]);

  const loadPreviews = async () => {
    const ids = profiles.map(p => p.id);
    if (ids.length === 0) return;
    const [reviewsRes, profilesRes] = await Promise.all([
      supabase.from('performance_reviews').select('user_id, year').in('user_id', ids),
      supabase.from('performance_profiles' as any).select('user_id, job_title, team').in('user_id', ids),
    ]);
    const map: typeof previews = {};
    ids.forEach(id => {
      map[id] = { reviewCount: 0, lastYear: null, hasProfile: false, jobTitle: null, team: null };
    });
    (reviewsRes.data || []).forEach((r: any) => {
      const m = map[r.user_id];
      if (!m) return;
      m.reviewCount += 1;
      if (m.lastYear === null || r.year > m.lastYear) m.lastYear = r.year;
    });
    ((profilesRes.data as any[]) || []).forEach((p: any) => {
      const m = map[p.user_id];
      if (!m) return;
      m.hasProfile = true;
      m.jobTitle = p.job_title;
      m.team = p.team;
    });
    setPreviews(map);
  };

  const loadReviews = async () => {
    const { data } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('user_id', selectedUserId)
      .order('year', { ascending: false });
    setReviews((data || []) as unknown as Review[]);
    setSelectedReview(null);
  };

  const loadPerfProfile = async () => {
    const { data } = await supabase
      .from('performance_profiles' as any)
      .select('*')
      .eq('user_id', selectedUserId)
      .maybeSingle();
    setPerfProfile(data as unknown as PerformanceProfile | null);
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
  const [contractPeriods, setContractPeriods] = useState<ContractPeriod[]>([]);

  // Performance profile edit
  const openProfileEdit = async () => {
    if (perfProfile) {
      setProfileForm({
        job_title: perfProfile.job_title || '',
        team: perfProfile.team || '',
        team_leader_name: perfProfile.team_leader_name || '',
        start_date: perfProfile.start_date || '',
        contract_type: perfProfile.contract_type || '',
        compensation: perfProfile.compensation || '',
        contract_history: perfProfile.contract_history || '',
        career_target_role: perfProfile.career_target_role || '',
        career_long_term_goal: perfProfile.career_long_term_goal || '',
        company_support: perfProfile.company_support || '',
      });
    } else {
      const base = { ...emptyProfile };
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('title, area')
          .eq('id', selectedUserId)
          .maybeSingle();

        if (profile) {
          base.job_title = profile.title || '';
          base.team = profile.area || '';

          if (profile.area) {
            const { data: leaderArea } = await (supabase
              .from('team_leader_areas' as any) as any)
              .select('user_id')
              .eq('area', profile.area)
              .limit(1)
              .maybeSingle();

            if ((leaderArea as any)?.user_id) {
              const { data: leaderProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', (leaderArea as any).user_id)
                .maybeSingle();

              if (leaderProfile) {
                base.team_leader_name = `${leaderProfile.first_name || ''} ${leaderProfile.last_name || ''}`.trim();
              }
            }
          }
        }
      } catch (err) {
        console.error('Error prefilling profile data:', err);
      }
      setProfileForm(base);
    }

    // Load contract periods
    try {
      const { data: periods } = await supabase
        .from('user_contract_periods')
        .select('*')
        .eq('user_id', selectedUserId)
        .order('start_date', { ascending: false });
      setContractPeriods(periods || []);
    } catch {
      setContractPeriods([]);
    }

    setProfileDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const payload: any = {
        user_id: selectedUserId,
        job_title: profileForm.job_title || null,
        team: profileForm.team || null,
        team_leader_name: profileForm.team_leader_name || null,
        start_date: profileForm.start_date || null,
        contract_type: profileForm.contract_type || null,
        compensation: profileForm.compensation || null,
        contract_history: profileForm.contract_history || null,
        career_target_role: profileForm.career_target_role || null,
        career_long_term_goal: profileForm.career_long_term_goal || null,
        company_support: profileForm.company_support || null,
      };

      if (perfProfile) {
        const { error } = await (supabase.from('performance_profiles' as any) as any).update(payload).eq('id', perfProfile.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('performance_profiles' as any) as any).insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Salvato', description: 'Profilo professionale aggiornato' });
      setProfileDialogOpen(false);
      loadPerfProfile();
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    } finally {
      setProfileSaving(false);
    }
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
      {!selectedUserId ? (
        <Card>
          <CardHeader>
            <CardTitle>Gestione Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun utente disponibile.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ruolo</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Schede</TableHead>
                    <TableHead>Ultima scheda</TableHead>
                    <TableHead>Profilo</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map(p => {
                    const pv = previews[p.id];
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedUserId(p.id)}
                      >
                        <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{pv?.jobTitle || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{pv?.team || '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={pv?.reviewCount ? 'secondary' : 'outline'}>{pv?.reviewCount ?? 0}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{pv?.lastYear ?? '-'}</TableCell>
                        <TableCell>
                          {pv?.hasProfile ? (
                            <Badge variant="secondary">Compilato</Badge>
                          ) : (
                            <Badge variant="outline">Da compilare</Badge>
                          )}
                        </TableCell>
                        <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(''); setSelectedReview(null); loadPreviews(); }}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Torna alla lista
          </Button>
          <h2 className="text-lg font-semibold">
            {selectedProfile?.first_name} {selectedProfile?.last_name}
          </h2>
        </div>
      )}

      {/* Performance Profile - fixed section */}
      {selectedUserId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Percorso Professionale
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={openProfileEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {perfProfile ? (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="text-muted-foreground">Ruolo:</span>
                      <p className="font-medium">{perfProfile.job_title || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Team:</span>
                      <p className="font-medium">{perfProfile.team || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Team Leader:</span>
                      <p className="font-medium">{perfProfile.team_leader_name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data inizio:</span>
                      <p className="font-medium">{perfProfile.start_date || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo contratto:</span>
                      <p className="font-medium">{perfProfile.contract_type || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Compenso:</span>
                      <p className="font-medium">{perfProfile.compensation || '-'}</p>
                    </div>
                  </div>
                  {perfProfile.contract_history && (
                    <div className="pt-2 border-t">
                      <span className="text-muted-foreground">Storico variazioni:</span>
                      <p className="font-medium whitespace-pre-wrap">{perfProfile.contract_history}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground italic">Nessun dato. Clicca la matita per compilare.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                Sviluppo Professionale
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={openProfileEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {perfProfile ? (
                <>
                  <div>
                    <span className="text-muted-foreground">Ruolo obiettivo:</span>
                    <p className="font-medium">{perfProfile.career_target_role || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Obiettivo a lungo termine:</span>
                    <p className="font-medium whitespace-pre-wrap">{perfProfile.career_long_term_goal || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Supporto dell'azienda:</span>
                    <p className="font-medium whitespace-pre-wrap">{perfProfile.company_support || '-'}</p>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground italic">Nessun dato. Clicca la matita per compilare.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Annual reviews list */}
      {selectedUserId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Schede Annuali — {selectedProfile?.first_name} {selectedProfile?.last_name}
            </CardTitle>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Nuova Scheda
            </Button>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna scheda performance.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anno</TableHead>
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
          </CardContent>
        </Card>
      )}

      {/* Detail panel for selected review */}
      {selectedReview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Dettaglio {selectedReview.year} — {selectedProfile?.first_name} {selectedProfile?.last_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="valutazione">
              <TabsList>
                <TabsTrigger value="valutazione" className="flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  Valutazione
                </TabsTrigger>
                <TabsTrigger value="objectives" className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  Obiettivi
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  Note Trimestrali
                </TabsTrigger>
              </TabsList>

              <TabsContent value="valutazione" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Punti di forza:</span>
                    <p className="font-medium whitespace-pre-wrap mt-1">{selectedReview.strengths || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Aree di miglioramento:</span>
                    <p className="font-medium whitespace-pre-wrap mt-1">{selectedReview.improvement_areas || '-'}</p>
                  </div>
                </div>
              </TabsContent>

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
                          <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap">{obj.description || '-'}</TableCell>
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

      {/* Review form dialog (simplified: only year, period, strengths, improvement areas) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
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
            <div className="space-y-2">
              <Label>Punti di forza</Label>
              <Textarea value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} rows={5} />
            </div>
            <div className="space-y-2">
              <Label>Aree di miglioramento</Label>
              <Textarea value={form.improvement_areas} onChange={e => setForm({ ...form, improvement_areas: e.target.value })} rows={5} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Performance Profile edit dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Profilo Professionale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Percorso Professionale
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ruolo</Label>
                <Input value={profileForm.job_title} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Team</Label>
                <Input value={profileForm.team} disabled className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Team Leader</Label>
                <Input value={profileForm.team_leader_name} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Data inizio</Label>
                <Input type="date" value={profileForm.start_date} onChange={e => setProfileForm({ ...profileForm, start_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo contratto</Label>
                <Input value={profileForm.contract_type} onChange={e => setProfileForm({ ...profileForm, contract_type: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Compenso</Label>
                <Input value={profileForm.compensation} onChange={e => setProfileForm({ ...profileForm, compensation: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note storico contrattuale</Label>
              <Textarea value={profileForm.contract_history} onChange={e => setProfileForm({ ...profileForm, contract_history: e.target.value })} rows={2} />
            </div>

            {contractPeriods.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <History className="h-4 w-4" /> Storico variazioni contrattuali
                </Label>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Periodo</TableHead>
                        <TableHead>Tipo contratto</TableHead>
                        <TableHead>Ore</TableHead>
                        <TableHead>Costo orario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contractPeriods.map(cp => (
                        <TableRow key={cp.id}>
                          <TableCell className="text-sm">
                            {format(parseISO(cp.start_date), 'dd MMM yyyy', { locale: it })}
                            {cp.end_date
                              ? ` → ${format(parseISO(cp.end_date), 'dd MMM yyyy', { locale: it })}`
                              : <Badge variant="outline" className="ml-2 text-xs">Attivo</Badge>
                            }
                          </TableCell>
                          <TableCell className="text-sm capitalize">{cp.contract_type}</TableCell>
                          <TableCell className="text-sm">
                            {cp.contract_hours} {cp.contract_hours_period === 'daily' ? '/g' : cp.contract_hours_period === 'weekly' ? '/sett' : '/mese'}
                          </TableCell>
                          <TableCell className="text-sm">€{cp.hourly_rate}/h</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <h4 className="font-medium text-sm flex items-center gap-2 pt-2">
              <GraduationCap className="h-4 w-4" /> Sviluppo Professionale
            </h4>
            <div className="space-y-2">
              <Label>Ruolo obiettivo (carriera)</Label>
              <Input value={profileForm.career_target_role} onChange={e => setProfileForm({ ...profileForm, career_target_role: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Obiettivo a lungo termine</Label>
              <Textarea value={profileForm.career_long_term_goal} onChange={e => setProfileForm({ ...profileForm, career_long_term_goal: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Supporto dell'azienda</Label>
              <Textarea value={profileForm.company_support} onChange={e => setProfileForm({ ...profileForm, company_support: e.target.value })} rows={2} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSaveProfile} disabled={profileSaving}>{profileSaving ? 'Salvataggio...' : 'Salva'}</Button>
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
