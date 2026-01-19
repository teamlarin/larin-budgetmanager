import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle2, XCircle, Building2, Users, Link2, Loader2, Webhook, Copy, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HubSpotFieldMappings } from "./HubSpotFieldMappings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";

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
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    fetchWebhookUrl();
  }, []);

  const fetchWebhookUrl = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-sync", {
        body: { action: "get-webhook-url" },
      });

      if (!error && data?.webhookUrl) {
        setWebhookUrl(data.webhookUrl);
      }
    } catch (error) {
      console.error("Error fetching webhook URL:", error);
    }
  };

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      toast({
        title: "URL copiato",
        description: "URL webhook copiato negli appunti",
      });
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile copiare l'URL",
        variant: "destructive",
      });
    }
  };

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
          <Badge variant="outline" className="border-primary/30 text-primary">
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
            <div className="p-2 bg-primary/10 rounded-lg">
              <Link2 className="h-5 w-5 text-primary" />
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

        {/* Webhook Configuration */}
        {webhookUrl && (
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Webhook per sincronizzazione automatica</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Configura questo URL in HubSpot → Settings → Integrations → Private Apps → Webhooks
              per ricevere aggiornamenti automatici quando clienti o contatti cambiano.
            </p>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyWebhookUrl}
              >
                {copiedWebhook ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sottoscrizioni consigliate: <code>company.creation</code>, <code>company.propertyChange</code>,{" "}
              <code>contact.creation</code>, <code>contact.propertyChange</code>
            </p>
          </div>
        )}

        {lastSyncResult && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="font-medium">Risultato ultima sincronizzazione:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {lastSyncResult.synced !== undefined && (
                <div>
                  <p className="text-muted-foreground">Nuovi</p>
                  <p className="text-lg font-semibold text-primary">{lastSyncResult.synced}</p>
                </div>
              )}
              {lastSyncResult.updated !== undefined && (
                <div>
                  <p className="text-muted-foreground">Aggiornati</p>
                  <p className="text-lg font-semibold text-primary">{lastSyncResult.updated}</p>
                </div>
              )}
              {lastSyncResult.skipped !== undefined && (
                <div>
                  <p className="text-muted-foreground">Saltati</p>
                  <p className="text-lg font-semibold text-muted-foreground">{lastSyncResult.skipped}</p>
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
