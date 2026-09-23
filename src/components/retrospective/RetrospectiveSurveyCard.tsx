import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { SURVEY_QUESTIONS, type RetrospectiveSurvey } from '@/hooks/useProjectRetrospective';

interface Props {
  mySurvey: RetrospectiveSurvey | null;
  disabled?: boolean;
  onSave: (answers: Partial<RetrospectiveSurvey>) => void;
  saving?: boolean;
}

/** Questionario individuale a 4 domande, compilabile da ogni persona del team. */
export const RetrospectiveSurveyCard = ({ mySurvey, disabled, onSave, saving }: Props) => {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues({
      answer_structure: mySurvey?.answer_structure || '',
      answer_communication: mySurvey?.answer_communication || '',
      answer_client: mySurvey?.answer_client || '',
      answer_golden_lesson: mySurvey?.answer_golden_lesson || '',
    });
  }, [mySurvey?.id, mySurvey?.submitted_at]);

  const isEmpty = SURVEY_QUESTIONS.every((q) => !(values[q.field] || '').trim());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Il mio questionario</CardTitle>
        {mySurvey?.submitted_at && (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Inviato il {format(new Date(mySurvey.submitted_at), 'd MMM yyyy', { locale: it })}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {SURVEY_QUESTIONS.map((q) => (
          <div key={q.field} className="space-y-1.5">
            <Label className="text-sm font-medium">{q.label}</Label>
            <p className="text-xs text-muted-foreground">{q.question}</p>
            <Textarea
              value={values[q.field] || ''}
              disabled={disabled}
              rows={3}
              placeholder="Scrivi la tua risposta..."
              onChange={(e) => setValues((prev) => ({ ...prev, [q.field]: e.target.value }))}
            />
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            onClick={() => onSave(values as Partial<RetrospectiveSurvey>)}
            disabled={disabled || saving || isEmpty}
          >
            {mySurvey?.submitted_at ? 'Aggiorna risposte' : 'Invia risposte'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
