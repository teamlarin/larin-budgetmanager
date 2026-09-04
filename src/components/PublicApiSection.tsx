import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code2 } from 'lucide-react';
import { ApiKeysManagement } from './ApiKeysManagement';

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-api`;

export const PublicApiSection = () => {
  return (
    <div className="space-y-6">
      <ApiKeysManagement />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Documentazione API
          </CardTitle>
          <CardDescription>
            Endpoint REST read-only sui progetti. Versione <strong>v1</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="font-medium mb-1">Base URL</div>
            <code className="block p-2 rounded bg-muted text-xs break-all">{BASE_URL}</code>
          </div>

          <div>
            <div className="font-medium mb-1">Autenticazione</div>
            <p className="text-muted-foreground mb-2">
              Includi la chiave in uno dei due header:
            </p>
            <code className="block p-2 rounded bg-muted text-xs">
              Authorization: Bearer tt_live_xxxxxxxxxxxx
            </code>
            <code className="block p-2 rounded bg-muted text-xs mt-1">
              X-Api-Key: tt_live_xxxxxxxxxxxx
            </code>
          </div>

          <div>
            <div className="font-medium mb-2">Endpoint</div>
            <ul className="space-y-3">
              <li>
                <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">GET /health</code> — ping (no auth)</div>
              </li>
              <li>
                <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">GET /projects</code> — lista progetti</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Filtri opzionali: <code>status</code>, <code>project_status</code>, <code>area</code>, <code>client_id</code>, <code>updated_since</code> (ISO date), <code>limit</code> (max 200), <code>cursor</code> (paginazione cursor-based).
                </div>
              </li>
              <li>
                <div><code className="text-xs bg-muted px-1.5 py-0.5 rounded">GET /projects/:id</code> — dettaglio singolo</div>
              </li>
            </ul>
            <div className="text-xs text-muted-foreground mt-3">
              Ogni progetto include: dati base (nome, stato, area, disciplina, date, avanzamento, numero preventivo),
              <code> drive_folder</code> (id, nome, link), <code>slack_channel</code> (id, nome, link),
              <code> client</code> (nome, email, telefono, cartella Drive),
              <code> client_contact</code> (nome, cognome, email, telefono, ruolo),
              <code> account</code> e <code>project_leader</code>.
            </div>
          </div>


          <div>
            <div className="font-medium mb-1">Esempio cURL</div>
            <code className="block p-2 rounded bg-muted text-xs whitespace-pre-wrap break-all">
{`curl -H "Authorization: Bearer tt_live_xxx" \\
  "${BASE_URL}/projects?status=approvato&limit=20"`}
            </code>
          </div>

          <div>
            <div className="font-medium mb-1">Rate limit</div>
            <p className="text-xs text-muted-foreground">60 richieste/minuto per chiave (best-effort).</p>
          </div>

          <div>
            <div className="font-medium mb-1">Codici errore</div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li><code>401</code> — chiave mancante, invalida, revocata o scaduta</li>
              <li><code>403</code> — scope insufficiente</li>
              <li><code>404</code> — risorsa o endpoint non trovati</li>
              <li><code>429</code> — rate limit superato</li>
              <li><code>500</code> — errore interno</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
