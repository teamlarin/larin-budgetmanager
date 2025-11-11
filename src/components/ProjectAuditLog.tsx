import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, User } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface ProjectAuditLogProps {
  projectId: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user_id: string;
  user_name?: string;
}

const fieldNameMap: Record<string, string> = {
  name: 'Nome',
  description: 'Descrizione',
  objective: 'Obiettivo',
  client_id: 'Cliente',
  account_user_id: 'Account',
  status: 'Stato',
  discount_percentage: 'Sconto',
  margin_percentage: 'Margine',
  project_type: 'Tipo progetto',
  brief_link: 'Link del brief',
  project: 'Progetto',
};

const statusMap: Record<string, string> = {
  in_attesa: 'In attesa',
  approvato: 'Approvato',
  rifiutato: 'Rifiutato',
};

export const ProjectAuditLog = ({ projectId }: ProjectAuditLogProps) => {
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['project-audit-log', projectId],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('project_audit_log')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch user profiles separately
      const userIds = [...new Set(logs?.map(log => log.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);

      // Map profiles to logs
      const profileMap = new Map(
        profiles?.map(p => [p.id, `${p.first_name} ${p.last_name}`]) || []
      );

      return logs?.map(log => ({
        ...log,
        user_name: profileMap.get(log.user_id) || 'Utente sconosciuto',
      })) as AuditLogEntry[];
    },
  });

  const formatValue = (fieldName: string | null, value: string | null) => {
    if (!value) return 'Non specificato';
    
    if (fieldName === 'status') {
      return statusMap[value] || value;
    }
    
    if (fieldName === 'discount_percentage' || fieldName === 'margin_percentage') {
      return `${value}%`;
    }
    
    return value;
  };

  const getChangeDescription = (log: AuditLogEntry) => {
    if (log.action === 'create') {
      return 'Progetto creato';
    }

    const fieldLabel = fieldNameMap[log.field_name || ''] || log.field_name;
    const oldVal = formatValue(log.field_name, log.old_value);
    const newVal = formatValue(log.field_name, log.new_value);

    return (
      <span>
        <span className="font-medium">{fieldLabel}</span> modificato da{' '}
        <span className="text-muted-foreground line-through">{oldVal}</span> a{' '}
        <span className="font-medium text-foreground">{newVal}</span>
      </span>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Storico Modifiche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!auditLogs || auditLogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Storico Modifiche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nessuna modifica registrata</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Storico Modifiche
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex gap-3 pb-4 border-b border-border last:border-0"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{getChangeDescription(log)}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{log.user_name}</span>
                    <span>•</span>
                    <span>
                      {format(new Date(log.created_at), "d MMM yyyy 'alle' HH:mm", {
                        locale: it,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
