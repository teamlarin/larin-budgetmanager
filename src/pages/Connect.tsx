import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "";
const mcpUrl = `https://${projectRef}.supabase.co/functions/v1/mcp`;

export default function Connect() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    toast.success("URL copiato");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Collega un assistente AI</h1>
        <p className="text-muted-foreground">
          Connetti ChatGPT o Claude a TimeTrap tramite MCP per interrogare progetti,
          budget e timesheet direttamente dalla chat.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>URL del server MCP</CardTitle>
          <CardDescription>Incolla questo URL nel tuo assistente AI.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input readOnly value={mcpUrl} className="font-mono text-sm" />
          <Button onClick={copy} variant="outline">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Come collegarti</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chatgpt">
            <TabsList>
              <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
              <TabsTrigger value="claude">Claude</TabsTrigger>
            </TabsList>
            <TabsContent value="chatgpt" className="space-y-3 pt-4">
              <ol className="list-decimal ml-5 space-y-2 text-sm">
                <li>
                  Apri{" "}
                  <a
                    href="https://chatgpt.com/#settings/Connectors/Advanced"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    Impostazioni → Connettori → Avanzate <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  e attiva la Developer mode (leggi l'avviso di rischio).
                </li>
                <li>Nel menu "+" del composer della chat attiva la Developer mode.</li>
                <li>Clicca "Add sources", poi "Connect more".</li>
                <li>Assegna un nome al connettore e incolla l'URL MCP qui sopra.</li>
                <li>Chiedi a ChatGPT di usare l'app (es. "elenca i miei progetti attivi").</li>
              </ol>
            </TabsContent>
            <TabsContent value="claude" className="space-y-3 pt-4">
              <ol className="list-decimal ml-5 space-y-2 text-sm">
                <li>
                  Apri{" "}
                  <a
                    href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    Claude → Connettori → Aggiungi connettore <ExternalLink className="h-3 w-3" />
                  </a>
                  .
                </li>
                <li>Assegna un nome al connettore e incolla l'URL MCP qui sopra.</li>
                <li>Abilita il connettore dal composer della chat.</li>
                <li>Chiedi a Claude di usare l'app.</li>
              </ol>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aggiornare la connessione</CardTitle>
          <CardDescription>
            Quando aggiungiamo nuovi tool o modifichiamo l'app, l'assistente deve rinfrescare la lista dei tool.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chatgpt">
            <TabsList>
              <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
              <TabsTrigger value="claude">Claude</TabsTrigger>
            </TabsList>
            <TabsContent value="chatgpt" className="space-y-3 pt-4">
              <ol className="list-decimal ml-5 space-y-2 text-sm">
                <li>Apri le preferenze di ChatGPT e seleziona questa app in "Enabled apps".</li>
                <li>Accanto a "Information", clicca "Refresh".</li>
                <li>Se l'URL è cambiato, incolla quello aggiornato qui sopra.</li>
                <li>Apri una nuova chat e chiedi a ChatGPT di usare l'app.</li>
              </ol>
            </TabsContent>
            <TabsContent value="claude" className="space-y-3 pt-4">
              <ol className="list-decimal ml-5 space-y-2 text-sm">
                <li>Apri la pagina Connettori e seleziona questo connettore.</li>
                <li>Aggiorna la lista dei tool del connettore.</li>
                <li>Se l'URL è cambiato, incolla quello aggiornato qui sopra.</li>
                <li>Chiedi a Claude di usare l'app.</li>
              </ol>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
