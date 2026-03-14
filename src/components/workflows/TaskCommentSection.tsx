import { useState, useEffect } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TaskComment } from '@/types/workflow';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface TaskCommentSectionProps {
  taskId: string;
  fetchTaskComments: (taskId: string) => Promise<TaskComment[]>;
  addTaskComment: (taskId: string, content: string) => Promise<void>;
}

export const TaskCommentSection = ({ taskId, fetchTaskComments, addTaskComment }: TaskCommentSectionProps) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [data, { data: { session } }] = await Promise.all([
        fetchTaskComments(taskId),
        supabase.auth.getSession(),
      ]);
      setComments(data);
      setCurrentUserId(session?.user.id || null);
      setLoading(false);
    };
    load();
  }, [taskId, fetchTaskComments]);

  const handleSend = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    await addTaskComment(taskId, newComment.trim());
    setNewComment('');
    const data = await fetchTaskComments(taskId);
    setComments(data);
    setSending(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from('workflow_task_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      {loading ? (
        <p className="text-xs text-muted-foreground">Caricamento...</p>
      ) : (
        <>
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground">Nessun commento</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2 text-xs group/comment">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground">{c.userName}</span>
                <span className="text-muted-foreground ml-1.5">
                  {format(new Date(c.createdAt), 'd MMM HH:mm', { locale: it })}
                </span>
                <p className="text-muted-foreground mt-0.5">{c.content}</p>
              </div>
              {c.userId === currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover/comment:opacity-100 transition-opacity shrink-0"
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </>
      )}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Aggiungi un commento..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="h-7 text-xs"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={handleSend}
          disabled={sending || !newComment.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
