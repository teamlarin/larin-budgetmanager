import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle2, XCircle, Building2, Users, Link2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HubSpotFieldMappings } from "./HubSpotFieldMappings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SyncResult {
  success: boolean;
  message: string;
  synced?: number;
  updated?: number;
  skipped?: number;
  total?: number;
}

export const HubSpotIntegration = () => {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSyncingCompanies, setIsSyncingCompanies] = useState(false);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-sync", {
        body: { action: "test-connection" },
      });

      if (error) throw error;

      if (data?.success) {
        setConnectionStatus("connected");
        toast({
          title: "Connessione attiva",
          description: "HubSpot è collegato correttamente",
        });
      } else {
        throw new Error(data?.error || "Connessione fallita");
      }
    } catch (error: any) {
      setConnectionStatus("error");
      toast({
        title: "Errore connessione",
        description: error.message || "Impossibile connettersi a HubSpot",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const syncCompanies = async () => {
    setIsSyncingCompanies(true);
    setLastSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-sync", {
        body: { action: "sync-companies" },
      });

      if (error) throw error;

      setLastSyncResult(data);
      toast({
        title: "Sincronizzazione completata",
        description: data.message,
      });
    } catch (error: any) {
      toast({
        title: "Errore sincronizzazione",
        description: error.message || "Impossibile sincronizzare le aziende",
        variant: "destructive",
      });
    } finally {
      setIsSyncingCompanies(false);
    }
  };

  const syncContacts = async () => {
    setIsSyncingContacts(true);
    setLastSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-sync", {
        body: { action: "sync-contacts" },
      });

      if (error) throw error;

      setLastSyncResult(data);
      toast({
        title: "Sincronizzazione completata",
        description: data.message,
      });
    } catch (error: any) {
      toast({
        title: "Errore sincronizzazione",
        description: error.message || "Impossibile sincronizzare i contatti",
        variant: "destructive",
      });
    } finally {
      setIsSyncingContacts(false);
    }
  };

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <Badge className="bg-green-500/10 text-green-700 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connesso
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Errore
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Non verificato
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Link2 className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Integrazione HubSpot</CardTitle>
              <CardDescription>
                Sincronizza clienti e contatti da HubSpot
              </CardDescription>
            </div>
          </div>
          {getConnectionBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Per utilizzare l'integrazione, configura il token HubSpot in{" "}
            <strong>Settings → Integrations → Private Apps</strong> su HubSpot.
            Il token deve avere i permessi: <code>crm.objects.companies.read</code> e{" "}
            <code>crm.objects.contacts.read</code>.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={isTestingConnection}
          >
            {isTestingConnection ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Verifica connessione
          </Button>

          <Button
            onClick={syncCompanies}
            disabled={isSyncingCompanies || connectionStatus !== "connected"}
          >
            {isSyncingCompanies ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Building2 className="h-4 w-4 mr-2" />
            )}
            Importa Aziende
          </Button>

          <Button
            onClick={syncContacts}
            disabled={isSyncingContacts || connectionStatus !== "connected"}
          >
            {isSyncingContacts ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Importa Contatti
          </Button>
        </div>

        {lastSyncResult && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="font-medium">Risultato ultima sincronizzazione:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {lastSyncResult.synced !== undefined && (
                <div>
                  <p className="text-muted-foreground">Nuovi</p>
                  <p className="text-lg font-semibold text-green-600">{lastSyncResult.synced}</p>
                </div>
              )}
              {lastSyncResult.updated !== undefined && (
                <div>
                  <p className="text-muted-foreground">Aggiornati</p>
                  <p className="text-lg font-semibold text-blue-600">{lastSyncResult.updated}</p>
                </div>
              )}
              {lastSyncResult.skipped !== undefined && (
                <div>
                  <p className="text-muted-foreground">Saltati</p>
                  <p className="text-lg font-semibold text-orange-600">{lastSyncResult.skipped}</p>
                </div>
              )}
              {lastSyncResult.total !== undefined && (
                <div>
                  <p className="text-muted-foreground">Totale HubSpot</p>
                  <p className="text-lg font-semibold">{lastSyncResult.total}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          💡 Importa prima le aziende, poi i contatti. I contatti verranno associati ai clienti
          corrispondenti in base al nome dell'azienda.
        </p>
      </CardContent>

      {/* Field Mappings Section */}
      <CardContent className="pt-0">
        <HubSpotFieldMappings />
      </CardContent>
    </Card>
  );
};
