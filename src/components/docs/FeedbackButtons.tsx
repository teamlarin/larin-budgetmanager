import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FeedbackButtonsProps {
  source: 'search' | 'chatbot';
  query?: string;
  context?: string;
  /** Stable identifier of the entity being rated (e.g. doc section id or chatbot turn id). */
  entityId?: string;
  /** Type of the entity, e.g. 'doc_section' or 'chatbot_turn'. */
  entityType?: 'doc_section' | 'chatbot_turn' | string;
  className?: string;
  size?: 'sm' | 'xs';
}

export function FeedbackButtons({ source, query, context, entityId, entityType, className = '', size = 'sm' }: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<null | boolean>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const { toast } = useToast();

  const submit = async (helpful: boolean) => {
    if (submitted !== null) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('help_feedback')
      .insert({
        source,
        helpful,
        query: query?.slice(0, 500) ?? null,
        context: context?.slice(0, 2000) ?? null,
        entity_id: entityId ?? null,
        entity_type: entityType ?? null,
        user_id: user?.id ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Feedback error:', error);
      toast({ title: 'Errore', description: 'Impossibile inviare il feedback.', variant: 'destructive' });
      return;
    }
    setSubmitted(helpful);
    setFeedbackId(data?.id ?? null);
    if (!helpful) setShowCommentBox(true);
  };

  const saveComment = async () => {
    if (!feedbackId || !comment.trim()) {
      setShowCommentBox(false);
      return;
    }
    setSavingComment(true);
    const { error } = await supabase
      .from('help_feedback')
      .update({ comment: comment.trim().slice(0, 1000) })
      .eq('id', feedbackId);
    setSavingComment(false);
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile salvare il commento.', variant: 'destructive' });
      return;
    }
    setShowCommentBox(false);
    toast({ title: 'Grazie!', description: 'Il tuo commento è stato registrato.' });
  };

  const iconSize = size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const btnHeight = size === 'xs' ? 'h-6' : 'h-7';

  if (submitted !== null && !showCommentBox) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
        <Check className={`${iconSize} text-primary`} />
        <span>Grazie per il feedback!</span>
      </div>
    );
  }

  if (showCommentBox) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-xs text-muted-foreground">Cosa potremmo migliorare? (opzionale)</p>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="La tua osservazione..."
          rows={2}
          maxLength={1000}
          className="text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={saveComment} disabled={savingComment} className="h-7 text-xs">
            Invia
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCommentBox(false)} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" /> Chiudi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <span>Utile?</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => submit(true)}
        className={`${btnHeight} px-2 hover:bg-primary/10 hover:text-primary`}
        aria-label="Risposta utile"
      >
        <ThumbsUp className={iconSize} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => submit(false)}
        className={`${btnHeight} px-2 hover:bg-destructive/10 hover:text-destructive`}
        aria-label="Risposta non utile"
      >
        <ThumbsDown className={iconSize} />
      </Button>
    </div>
  );
}
