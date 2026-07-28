import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Key, Plus, Copy, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

// Generate a cryptographically random API key: tt_live_<32 base62 chars>
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return `tt_live_${out}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const ApiKeysManagement = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_keys' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ApiKey[]) ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const key = generateApiKey();
      const key_hash = await sha256Hex(key);
      const key_prefix = key.slice(0, 16); // tt_live_XXXXXXXX
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('api_keys' as any).insert({
        name,
        key_prefix,
        key_hash,
        scopes: ['projects:read', 'mcp:use'],
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      setGeneratedKey(key);
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (e: any) => toast.error(e.message || 'Errore nella creazione della chiave'),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('api_keys' as any)
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Chiave revocata');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setRevokeTarget(null);
    },
    onError: (e: any) => toast.error(e.message || 'Errore'),
  });

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setGeneratedKey(null);
    setNewName('');
  };

  const copyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    toast.success('Chiave copiata negli appunti');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            API Keys
          </CardTitle>
          <CardDescription>
            Genera chiavi per consentire a strumenti esterni (knowledge base, automazioni) di leggere i progetti via API REST.
          </CardDescription>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuova chiave
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna chiave creata. Genera la prima per iniziare.</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((k) => {
              const isRevoked = !!k.revoked_at;
              const isExpired = k.expires_at && new Date(k.expires_at) < new Date();
              const active = !isRevoked && !isExpired;
              return (
                <div key={k.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{k.name}</span>
                      {active ? (
                        <Badge variant="secondary">Attiva</Badge>
                      ) : isRevoked ? (
                        <Badge variant="destructive">Revocata</Badge>
                      ) : (
                        <Badge variant="outline">Scaduta</Badge>
                      )}
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{k.key_prefix}…</div>
                    <div className="text-xs text-muted-foreground">
                      Creata il {format(new Date(k.created_at), 'd MMM yyyy', { locale: it })}
                      {k.last_used_at && ` · Ultimo uso: ${format(new Date(k.last_used_at), 'd MMM yyyy HH:mm', { locale: it })}`}
                      {!k.last_used_at && ' · Mai utilizzata'}
                    </div>
                  </div>
                  {active && (
                    <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(k)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => (!o ? handleCloseCreate() : setCreateOpen(true))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{generatedKey ? 'Chiave generata' : 'Genera nuova API key'}</DialogTitle>
            <DialogDescription>
              {generatedKey
                ? 'Copia subito la chiave: non potrai più visualizzarla.'
                : 'Assegna un nome descrittivo (es. "Notion KB", "Make automation").'}
            </DialogDescription>
          </DialogHeader>

          {!generatedKey ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="api-key-name">Nome</Label>
                <Input
                  id="api-key-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Es. Notion knowledge base"
                />
              </div>
              <Alert>
                <AlertDescription className="text-xs">
                  Permessi: <strong>projects:read</strong> (sola lettura sui progetti).
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Questa è l'unica volta che vedrai la chiave per intero. Salvala in un password manager.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted font-mono text-xs break-all">
                {generatedKey}
              </div>
              <Button onClick={copyKey} className="w-full">
                <Copy className="h-4 w-4 mr-2" />
                Copia chiave
              </Button>
            </div>
          )}

          <DialogFooter>
            {!generatedKey ? (
              <>
                <Button variant="ghost" onClick={handleCloseCreate}>Annulla</Button>
                <Button
                  onClick={() => createMutation.mutate(newName.trim())}
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Generazione...' : 'Genera'}
                </Button>
              </>
            ) : (
              <Button onClick={handleCloseCreate}>Chiudi</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocare la chiave?</AlertDialogTitle>
            <AlertDialogDescription>
              La chiave <strong>{revokeTarget?.name}</strong> smetterà immediatamente di funzionare.
              L'operazione non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}>
              Revoca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
