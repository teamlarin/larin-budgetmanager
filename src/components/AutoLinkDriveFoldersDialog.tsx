import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, FolderSearch, ExternalLink } from "lucide-react";

interface Candidate {
  folder_id: string;
  folder_name: string;
  score: number;
}

interface ScanEntry {
  client_id: string;
  client_name: string;
  candidates: Candidate[];
  best?: Candidate;
}

interface ScanResult {
  drive_id: string;
  clienti_folder_id: string;
  total_folders: number;
  total_unlinked_clients: number;
  auto: ScanEntry[];
  ambiguous: ScanEntry[];
  none: ScanEntry[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}

export const AutoLinkDriveFoldersDialog = ({ open, onOpenChange, onApplied }: Props) => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  // Map clientId -> selected folder_id (or "none")
  const [selections, setSelections] = useState<Record<string, string>>({});

  const reset = () => {
    setResult(null);
    setSelections({});
  };

  const runScan = async () => {
    setLoading(true);
    setResult(null);
    setSelections({});
    try {
      const { data, error } = await supabase.functions.invoke("auto-link-client-drive-folders", {
        body: { action: "scan" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = data as ScanResult;
      setResult(r);
      // Pre-seleziona match automatici
      const sel: Record<string, string> = {};
      for (const e of r.auto) {
        if (e.best) sel[e.client_id] = e.best.folder_id;
      }
      setSelections(sel);
    } catch (e: any) {
      toast({
        title: "Errore scansione",
        description: e?.message || "Errore sconosciuto. Verifica di avere Google connesso.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (entry: ScanEntry, folderId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[entry.client_id] === folderId) {
        delete next[entry.client_id];
      } else {
        next[entry.client_id] = folderId;
      }
      return next;
    });
  };

  const setAmbiguousChoice = (entry: ScanEntry, folderId: string) => {
    setSelections((prev) => ({ ...prev, [entry.client_id]: folderId }));
  };

  const apply = async () => {
    if (!result) return;
    const all = [...result.auto, ...result.ambiguous, ...result.none];
    const links: { client_id: string; folder_id: string; folder_name: string }[] = [];
    for (const e of all) {
      const sel = selections[e.client_id];
      if (!sel) continue;
      const folder =
        e.candidates.find((c) => c.folder_id === sel) ||
        (e.best?.folder_id === sel ? e.best : undefined);
      if (folder) {
        links.push({
          client_id: e.client_id,
          folder_id: folder.folder_id,
          folder_name: folder.folder_name,
        });
      }
    }
    if (links.length === 0) {
      toast({ title: "Nessun collegamento selezionato", variant: "destructive" });
      return;
    }
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-link-client-drive-folders", {
        body: { action: "apply", links },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const updated = (data as any)?.updated || 0;
      const errors = (data as any)?.errors || [];
      toast({
        title: "Collegamento completato",
        description: `${updated} clienti collegati${errors.length ? `, ${errors.length} errori` : ""}.`,
      });
      onApplied();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message || "Errore sconosciuto", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const selectedCount = Object.keys(selections).length;

  const renderEntry = (entry: ScanEntry, mode: "auto" | "ambiguous" | "none") => {
    const selected = selections[entry.client_id];
    return (
      <div key={entry.client_id} className="flex items-start gap-3 py-2 border-b last:border-0">
        {mode !== "none" && (
          <Checkbox
            checked={!!selected}
            onCheckedChange={(checked) => {
              if (checked && entry.best) {
                setSelections((p) => ({ ...p, [entry.client_id]: selected || entry.best!.folder_id }));
              } else {
                setSelections((p) => {
                  const n = { ...p };
                  delete n[entry.client_id];
                  return n;
                });
              }
            }}
            className="mt-1"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{entry.client_name}</div>
          {mode === "auto" && entry.best && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
              <span>→ {entry.best.folder_name}</span>
              <Badge variant="secondary" className="text-[10px]">
                {Math.round(entry.best.score * 100)}%
              </Badge>
              <a
                href={`https://drive.google.com/drive/folders/${entry.best.folder_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {mode === "ambiguous" && (
            <div className="mt-1">
              <Select value={selected || ""} onValueChange={(v) => setAmbiguousChoice(entry, v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Scegli cartella..." />
                </SelectTrigger>
                <SelectContent>
                  {entry.candidates.map((c) => (
                    <SelectItem key={c.folder_id} value={c.folder_id}>
                      {c.folder_name} — {Math.round(c.score * 100)}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {mode === "none" && (
            <div className="text-xs text-muted-foreground mt-1">Nessuna cartella simile trovata</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderSearch className="h-5 w-5" /> Collegamento automatico cartelle Drive
          </DialogTitle>
          <DialogDescription>
            Scansiona le cartelle dei clienti nel drive condiviso “01 | CLIENTI - Server Larin Group” e
            collega automaticamente quelle che corrispondono ai clienti senza cartella.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Verrà letta la cartella <strong>Clienti</strong> e confrontati i nomi delle sotto-cartelle con la
              ragione sociale dei clienti senza cartella collegata. Devi essere admin e avere Google connesso.
            </p>
            <Button onClick={runScan} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Avvia scansione
            </Button>
          </div>
        )}

        {result && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="text-xs text-muted-foreground mb-3">
              {result.total_folders} cartelle Drive · {result.total_unlinked_clients} clienti senza cartella ·{" "}
              {selectedCount} selezionati
            </div>
            <Tabs defaultValue="auto" className="flex-1 overflow-hidden flex flex-col">
              <TabsList>
                <TabsTrigger value="auto">Match automatici ({result.auto.length})</TabsTrigger>
                <TabsTrigger value="ambiguous">Da rivedere ({result.ambiguous.length})</TabsTrigger>
                <TabsTrigger value="none">Nessun match ({result.none.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="auto" className="flex-1 overflow-auto mt-2">
                {result.auto.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">Nessun match automatico.</div>
                ) : (
                  result.auto.map((e) => renderEntry(e, "auto"))
                )}
              </TabsContent>
              <TabsContent value="ambiguous" className="flex-1 overflow-auto mt-2">
                {result.ambiguous.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">Nessuna ambiguità.</div>
                ) : (
                  result.ambiguous.map((e) => renderEntry(e, "ambiguous"))
                )}
              </TabsContent>
              <TabsContent value="none" className="flex-1 overflow-auto mt-2">
                {result.none.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">Tutti i clienti hanno almeno un match.</div>
                ) : (
                  result.none.map((e) => renderEntry(e, "none"))
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Annulla
          </Button>
          {result && (
            <>
              <Button variant="outline" onClick={runScan} disabled={loading || applying}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Riavvia scansione
              </Button>
              <Button onClick={apply} disabled={applying || selectedCount === 0}>
                {applying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Applica {selectedCount > 0 ? `(${selectedCount})` : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
