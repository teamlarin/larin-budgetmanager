import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Shield, Check, X } from 'lucide-react';
import { defaultPermissions, type Permission } from '@/lib/permissions';

const roles: { key: string; label: string; color: string }[] = [
  { key: 'admin', label: 'Admin', color: 'bg-red-100 text-red-800' },
  { key: 'account', label: 'Account', color: 'bg-blue-100 text-blue-800' },
  { key: 'finance', label: 'Finance', color: 'bg-green-100 text-green-800' },
  { key: 'team_leader', label: 'Team Leader', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'coordinator', label: 'Coordinator', color: 'bg-purple-100 text-purple-800' },
  { key: 'member', label: 'Member', color: 'bg-gray-100 text-gray-800' },
];

const permissionLabels: { key: keyof Permission; label: string }[] = [
  { key: 'canAccessSettings', label: 'Accesso Impostazioni' },
  { key: 'canManageUsers', label: 'Gestione Utenti' },
  { key: 'canManageClients', label: 'Gestione Clienti' },
  { key: 'canManageProducts', label: 'Gestione Prodotti' },
  { key: 'canManageServices', label: 'Gestione Servizi' },
  { key: 'canManageLevels', label: 'Gestione Livelli' },
  { key: 'canManageCategories', label: 'Gestione Categorie' },
  { key: 'canManageTemplates', label: 'Gestione Template' },
  { key: 'canCreateProjects', label: 'Creazione Progetti' },
  { key: 'canEditProjects', label: 'Modifica Progetti' },
  { key: 'canDeleteProjects', label: 'Eliminazione Progetti' },
  { key: 'canChangeProjectStatus', label: 'Cambio Stato Progetto' },
  { key: 'canEditBudget', label: 'Modifica Budget' },
  { key: 'canEditFinancialFields', label: 'Campi Finanziari' },
  { key: 'canViewAllProjects', label: 'Visualizza Tutti i Progetti' },
  { key: 'canCreateQuotes', label: 'Creazione Preventivi' },
  { key: 'canEditQuotes', label: 'Modifica Preventivi' },
  { key: 'canDeleteQuotes', label: 'Eliminazione Preventivi' },
  { key: 'canDownloadQuotes', label: 'Download Preventivi' },
];

export function RolesPermissionsSection() {
  return (
    <section id="ruoli-permessi" className="scroll-mt-20 mb-12">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        Ruoli e Permessi
      </h2>

      {/* Role descriptions */}
      <Card variant="static" className="mb-6">
        <CardHeader>
          <CardTitle>Descrizione dei ruoli</CardTitle>
          <CardDescription>Ogni utente ha un ruolo che determina le funzionalità accessibili</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong>Admin:</strong> Accesso completo a tutte le funzionalità. Gestione utenti, impostazioni di sistema, configurazione integrazioni. Visibilità totale su budget, progetti e metriche.</p>
          <p><strong>Account:</strong> Gestione di budget, preventivi e clienti. Accesso in sola lettura ai progetti e ai campi finanziari del canvas. Può visualizzare, duplicare ed eliminare budget ma non può modificare margini o sconti.</p>
          <p><strong>Finance:</strong> Focus su aspetti finanziari: preventivi, margini, campi finanziari. Visibilità su tutti i progetti per monitorare la redditività.</p>
          <p><strong>Team Leader:</strong> Supervisione del proprio team e dei progetti associati. Può creare e modificare budget, gestire attività. Non può modificare campi finanziari o cambiare lo stato dei progetti.</p>
          <p><strong>Coordinator:</strong> Simile al Team Leader ma senza possibilità di creare progetti. Può modificare budget e progetti esistenti, gestire template e impostazioni parziali.</p>
          <p><strong>Member:</strong> Accesso limitato al calendario e ai progetti a cui è assegnato. Può aggiornare il progresso se è Project Leader. Visualizzazione in sola lettura del canvas.</p>
          <p><strong>External:</strong> Collaboratore esterno con accesso via <strong>magic link</strong> (no password). Vede solo i progetti esplicitamente assegnati tramite <code>external_project_access</code> e può assegnare attività solo agli utenti consentiti tramite <code>external_visible_users</code>. Gestione delegata agli Admin in Impostazioni → External Users.</p>
        </CardContent>
      </Card>

      {/* Dynamic permissions table */}
      <Card variant="static" className="mb-6">
        <CardHeader>
          <CardTitle>Matrice dei permessi</CardTitle>
          <CardDescription>
            Questa tabella si aggiorna automaticamente con le configurazioni definite nel codice.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Permesso</TableHead>
                {roles.map((r) => (
                  <TableHead key={r.key} className="text-center min-w-[90px]">
                    <Badge variant="secondary" className={`text-xs ${r.color}`}>{r.label}</Badge>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissionLabels.map((perm) => (
                <TableRow key={perm.key}>
                  <TableCell className="font-medium text-sm">{perm.label}</TableCell>
                  {roles.map((role) => {
                    const perms = defaultPermissions[role.key as keyof typeof defaultPermissions];
                    const has = perms?.[perm.key] ?? false;
                    return (
                      <TableCell key={role.key} className="text-center">
                        {has ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role simulation */}
      <Card variant="static">
        <CardHeader>
          <CardTitle>Simulazione ruolo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Gli Admin possono <strong>simulare</strong> qualsiasi ruolo per verificare come appare l'interfaccia per altri utenti:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Vai su <strong>Impostazioni → Gestione Utenti</strong></li>
            <li>Clicca sull'icona di simulazione accanto a un utente</li>
            <li>L'interfaccia si adatta ai permessi del ruolo simulato</li>
            <li>Un banner in alto indica che stai simulando un ruolo</li>
            <li>Clicca su "Termina simulazione" per tornare al tuo ruolo</li>
          </ol>
          <p className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
            <strong className="text-foreground">💡 Nota:</strong> La simulazione è solo visuale. Le azioni eseguite durante la simulazione mantengono i permessi del tuo ruolo reale per motivi di sicurezza.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
