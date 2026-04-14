import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Target, TrendingUp, ThumbsUp, AlertTriangle, MessageSquare } from 'lucide-react';

interface PerformanceReview {
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

interface PerformanceObjective {
  id: string;
  title: string;
  description: string | null;
  bonus_percentage: number;
  sort_order: number;
}

interface QuarterlyNote {
  id: string;
  quarter: string;
  notes: string | null;
}

interface PerformanceReviewTabProps {
  userId?: string;
}

export const PerformanceReviewTab = ({ userId }: PerformanceReviewTabProps) => {
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [objectives, setObjectives] = useState<PerformanceObjective[]>([]);
  const [quarterlyNotes, setQuarterlyNotes] = useState<QuarterlyNote[]>([]);
  const [perfProfile, setPerfProfile] = useState<PerformanceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  useEffect(() => {
    if (selectedYear) {
      const review = reviews.find(r => r.year === selectedYear);
      if (review) loadDetails(review.id);
    }
  }, [selectedYear, reviews]);

  const loadData = async () => {
    try {
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }
      if (!targetUserId) return;

      const [reviewsRes, profileRes] = await Promise.all([
        supabase
          .from('performance_reviews')
          .select('*')
          .eq('user_id', targetUserId)
          .order('year', { ascending: false }),
        (supabase.from('performance_profiles' as any) as any)
          .select('*')
          .eq('user_id', targetUserId)
          .maybeSingle(),
      ]);

      const typed = (reviewsRes.data || []) as unknown as PerformanceReview[];
      setReviews(typed);
      setPerfProfile(profileRes.data as unknown as PerformanceProfile | null);
      if (typed.length > 0) setSelectedYear(typed[0].year);
    } catch (err) {
      console.error('Error loading performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (reviewId: string) => {
    const [objRes, notesRes] = await Promise.all([
      supabase.from('performance_objectives').select('*').eq('review_id', reviewId).order('sort_order'),
      supabase.from('performance_quarterly_notes').select('*').eq('review_id', reviewId).order('quarter'),
    ]);
    setObjectives((objRes.data || []) as unknown as PerformanceObjective[]);
    setQuarterlyNotes((notesRes.data || []) as unknown as QuarterlyNote[]);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (reviews.length === 0 && !perfProfile) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Nessuna scheda performance disponibile.
        </CardContent>
      </Card>
    );
  }

  const review = reviews.find(r => r.year === selectedYear);

  return (
    <div className="space-y-6">
      {/* Percorso Professionale - always visible */}
      {perfProfile && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                Percorso Professionale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoField label="Ruolo" value={perfProfile.job_title} />
                <InfoField label="Team" value={perfProfile.team} />
                <InfoField label="Team Leader" value={perfProfile.team_leader_name} />
                <InfoField label="Data inizio" value={perfProfile.start_date ? new Date(perfProfile.start_date).toLocaleDateString('it-IT') : null} />
                <InfoField label="Tipo contratto" value={perfProfile.contract_type} />
                <InfoField label="Compenso" value={perfProfile.compensation} />
              </div>
              {perfProfile.contract_history && (
                <div className="mt-4">
                  <InfoField label="Storico variazioni" value={perfProfile.contract_history} fullWidth />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sviluppo Professionale - always visible */}
          {(perfProfile.career_target_role || perfProfile.career_long_term_goal || perfProfile.company_support) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5" />
                  Sviluppo Professionale
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoField label="Ruolo obiettivo" value={perfProfile.career_target_role} fullWidth />
                <InfoField label="Obiettivo a lungo termine" value={perfProfile.career_long_term_goal} fullWidth />
                <InfoField label="Supporto dell'azienda" value={perfProfile.company_support} fullWidth />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Year selector */}
      {reviews.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Anno:</span>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reviews.map(r => (
                  <SelectItem key={r.year} value={String(r.year)}>
                    {r.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {review?.compilation_period && (
              <Badge variant="secondary">{review.compilation_period}</Badge>
            )}
          </div>

          {review && (
            <>
              {/* Obiettivi di Performance */}
              {objectives.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="h-5 w-5" />
                      Obiettivi di Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Obiettivo</TableHead>
                          <TableHead>Descrizione / Risultati attesi</TableHead>
                          <TableHead className="text-right">% Premio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {objectives.map((obj, i) => (
                          <TableRow key={obj.id}>
                            <TableCell className="font-medium">{i + 1}</TableCell>
                            <TableCell className="font-medium">{obj.title}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap">{obj.description || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{obj.bonus_percentage}%</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={3} className="font-semibold text-right">Totale</TableCell>
                          <TableCell className="text-right">
                            <Badge>{objectives.reduce((sum, o) => sum + (o.bonus_percentage || 0), 0)}%</Badge>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Punti di Forza e Aree di Miglioramento */}
              {(review.strengths || review.improvement_areas) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Punti di Forza e Aree di Miglioramento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {review.strengths && (
                        <div>
                          <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
                            <ThumbsUp className="h-4 w-4 text-green-600" />
                            Punti di Forza
                          </h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.strengths}</p>
                        </div>
                      )}
                      {review.improvement_areas && (
                        <div>
                          <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            Aree di Miglioramento
                          </h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.improvement_areas}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Confronti Trimestrali */}
              {quarterlyNotes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MessageSquare className="h-5 w-5" />
                      Confronti Trimestrali
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
                        const note = quarterlyNotes.find(n => n.quarter === q);
                        return (
                          <div key={q} className="p-4 rounded-lg border bg-muted/30">
                            <h4 className="font-medium text-sm mb-2">{q}</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {note?.notes || <span className="italic">Nessuna nota</span>}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

const InfoField = ({ label, value, fullWidth }: { label: string; value: string | null; fullWidth?: boolean }) => (
  <div className={fullWidth ? '' : ''}>
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-sm mt-0.5 whitespace-pre-wrap">{value || '-'}</p>
  </div>
);
