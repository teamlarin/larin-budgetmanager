import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, User, Clock, Activity } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ActionLog {
  id: string;
  user_id: string;
  action_type: string;
  action_description: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

const actionTypeLabels: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  create: "Creazione",
  update: "Modifica",
  delete: "Eliminazione",
  view: "Visualizzazione",
  export: "Esportazione",
  import: "Importazione",
  approve: "Approvazione",
  reject: "Rifiuto",
};

const entityTypeLabels: Record<string, string> = {
  project: "Progetto",
  budget: "Budget",
  quote: "Preventivo",
  client: "Cliente",
  user: "Utente",
  activity: "Attività",
  timesheet: "Timesheet",
  settings: "Impostazioni",
};

const UserActionLogs = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedActionType, setSelectedActionType] = useState<string>("all");

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role !== 'admin') {
        navigate('/settings');
      }
    };
    checkAccess();
  }, [navigate]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['user-action-logs', selectedUser, selectedActionType],
    queryFn: async () => {
      let query = supabase
        .from('user_action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }

      if (selectedActionType !== 'all') {
        query = query.eq('action_type', selectedActionType);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set(data?.map(log => log.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds);

      const profileMap = new Map(
        profiles?.map(p => [p.id, { 
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente',
          email: p.email 
        }]) || []
      );

      return data?.map(log => ({
        ...log,
        user_name: profileMap.get(log.user_id)?.name || 'Utente sconosciuto',
        user_email: profileMap.get(log.user_id)?.email || '',
      })) as ActionLog[];
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-with-actions'],
    queryFn: async () => {
      // Get distinct user_ids from action logs
      const { data: logUsers, error: logError } = await supabase
        .from('user_action_logs')
        .select('user_id');
      
      if (logError) throw logError;
      
      const uniqueUserIds = [...new Set(logUsers?.map(l => l.user_id) || [])];
      if (uniqueUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', uniqueUserIds)
        .order('first_name');
      if (error) throw error;
      return data;
    },
  });

  const filteredLogs = logs?.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.action_description.toLowerCase().includes(search) ||
      log.user_name?.toLowerCase().includes(search) ||
      log.user_email?.toLowerCase().includes(search) ||
      log.action_type.toLowerCase().includes(search) ||
      log.entity_type?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="page-container stack-lg">
      <div className="page-header-with-actions">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="page-title">Log Azioni Utenti</h1>
            <p className="text-sm text-muted-foreground">
              Storico delle azioni degli ultimi 7 giorni
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Filtri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca nelle azioni..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Tutti gli utenti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli utenti</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedActionType} onValueChange={setSelectedActionType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tutte le azioni" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le azioni</SelectItem>
                {Object.entries(actionTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Registro Azioni
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {filteredLogs?.length || 0} azioni trovate
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Ora</TableHead>
                    <TableHead>Utente</TableHead>
                    <TableHead>Azione</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Entità</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss", { locale: it })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{log.user_name}</p>
                            <p className="text-xs text-muted-foreground">{log.user_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {actionTypeLabels[log.action_type] || log.action_type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm truncate">{log.action_description}</p>
                      </TableCell>
                      <TableCell>
                        {log.entity_type && (
                          <span className="text-sm text-muted-foreground">
                            {entityTypeLabels[log.entity_type] || log.entity_type}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nessuna azione registrata</p>
              <p className="text-sm text-muted-foreground mt-1">
                Le azioni degli utenti appariranno qui
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserActionLogs;
