import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Target, TrendingUp, ThumbsUp, AlertTriangle, MessageSquare } from 'lucide-react';

interface PerformanceReview {
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
  userId?: string; // If provided, show this user's data (for admin/TL view)
}

export const PerformanceReviewTab = ({ userId }: PerformanceReviewTabProps) => {
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [objectives, setObjectives] = useState<PerformanceObjective[]>([]);
  const [quarterlyNotes, setQuarterlyNotes] = useState<QuarterlyNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, [userId]);

  useEffect(() => {
    if (selectedYear) {
      const review = reviews.find(r => r.year === selectedYear);
      if (review) {
        loadDetails(review.id);
      }
    }
  }, [selectedYear, reviews]);

  const loadReviews = async () => {
    try {
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }
      if (!targetUserId) return;

      const { data, error } = await supabase
        .from('performance_reviews')
        .select('*')
        .eq('user_id', targetUserId)
        .order('year', { ascending: false });

      if (error) throw error;

      const typed = (data || []) as unknown as PerformanceReview[];
      setReviews(typed);
      if (typed.length > 0) {
        setSelectedYear(typed[0].year);
      }
    } catch (err) {
      console.error('Error loading performance reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (reviewId: string) => {
    const [objRes, notesRes] = await Promise.all([
      supabase
        .from('performance_objectives')
        .select('*')
        .eq('review_id', reviewId)
        .order('sort_order'),
      supabase
        .from('performance_quarterly_notes')
        .select('*')
        .eq('review_id', reviewId)
        .order('quarter'),
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

  if (reviews.length === 0) {
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
      {/* Year selector */}
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
          {/* Percorso Professionale */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                Percorso Professionale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoField label="Ruolo" value={review.job_title} />
                <InfoField label="Team" value={review.team} />
                <InfoField label="Team Leader" value={review.team_leader_name} />
                <InfoField label="Data inizio" value={review.start_date ? new Date(review.start_date).toLocaleDateString('it-IT') : null} />
                <InfoField label="Tipo contratto" value={review.contract_type} />
                <InfoField label="Compenso" value={review.compensation} />
              </div>
              {review.contract_history && (
                <div className="mt-4">
                  <InfoField label="Storico variazioni" value={review.contract_history} fullWidth />
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* Sviluppo Professionale */}
          {(review.career_target_role || review.career_long_term_goal || review.company_support) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5" />
                  Sviluppo Professionale
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoField label="Ruolo obiettivo" value={review.career_target_role} fullWidth />
                <InfoField label="Obiettivo a lungo termine" value={review.career_long_term_goal} fullWidth />
                <InfoField label="Supporto dell'azienda" value={review.company_support} fullWidth />
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
    </div>
  );
};

const InfoField = ({ label, value, fullWidth }: { label: string; value: string | null; fullWidth?: boolean }) => (
  <div className={fullWidth ? '' : ''}>
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-sm mt-0.5 whitespace-pre-wrap">{value || '-'}</p>
  </div>
);
