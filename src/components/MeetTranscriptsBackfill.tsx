import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

type Totals = { processed: number; copied: number; already_present: number; not_found: number; errors: number };

export function MeetTranscriptsBackfill() {
  const [projectId, setProjectId] = useState("__none__");
  const [days, setDays] = useState("90");
  const [running, setRunning] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["meet-backfill-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .not("drive_folder_id", "is", null)
        .order("name");
      return data || [];
    },
  });

  const run = async () => {
    setRunning(true);
    const acc: Totals = { processed: 0, copied: 0, already_present: 0, not_found: 0, errors: 0 };
    setTotals({ ...acc });
    try {
      let offset: number | null = 0;
      while (offset !== null) {
        const { data, error } = await supabase.functions.invoke("copy-meet-attachments-to-project", {
          body: {
            batch: true,
            offset,
            limit: 10,
            days: Number(days),
            project_id: projectId === "__none__" ? undefined : projectId,
          },
        });
        if (error) {
          const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
          throw new Error(details);
        }
        acc.processed += data.processed;
        acc.copied += data.copied;
        acc.already_present += data.already_present;
        acc.not_found += data.not_found;
        acc.errors += data.errors;
        setTotals({ ...acc });
        offset = data.next_offset;
      }
      toast.success(`${acc.copied} trascrizioni copiate, ${acc.already_present} già presenti`);
    } catch (e) {
      toast.error(`Sincronizzazione interrotta: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Trascrizioni Meet passate</CardTitle>
        <CardDescription>
          Recupera le trascrizioni delle riunioni confermate e le copia nella cartella Meeting dei progetti. Se l'account della persona non ha accesso, viene usato quello di un admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={projectId} onValueChange={setProjectId} disabled={running}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Tutti i progetti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Tutti i progetti</SelectItem>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays} disabled={running}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Ultimi 30 giorni</SelectItem>
              <SelectItem value="90">Ultimi 90 giorni</SelectItem>
              <SelectItem value="180">Ultimi 6 mesi</SelectItem>
              <SelectItem value="365">Ultimo anno</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={run} disabled={running}>
            {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sincronizza trascrizioni passate
          </Button>
        </div>
        {totals && (
          <p className="text-sm text-muted-foreground">
            {running ? "In corso… " : "Completato: "}
            {totals.processed} riunioni esaminate · {totals.copied} copiate · {totals.already_present} già presenti · {totals.not_found} senza trascrizione · {totals.errors} con errori
          </p>
        )}
      </CardContent>
    </Card>
  );
}
