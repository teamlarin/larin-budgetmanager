import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Users, ArrowRightLeft, CheckCircle2 } from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  drive_folder_id: string | null;
  drive_folder_name: string | null;
  account_user_id: string | null;
  strategic_level: number | null;
  fic_id: number | null;
}

interface Pair {
  a: ClientRow;
  b: ClientRow;
  countsA: { projects: number; budgets: number; contacts: number };
  countsB: { projects: number; budgets: number; contacts: number };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

const SUFFIX_RE = /\s+(srl|s\.r\.l\.|spa|s\.p\.a\.|sas|snc|srls|srl\s+unipersonale|sa|ltd|inc|gmbh|& c\.?|& c|sapa|s\.a\.s\.|s\.n\.c\.)$/i;

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const canonical = (raw: string) => {
  let s = stripDiacritics(raw || "").toLowerCase();
  s = s.replace(SUFFIX_RE, "");
  return s.replace(/\s+/g, " ").trim();
};

export const MergeClientsDialog = ({ open, onOpenChange, onMerged }: Props) => {
  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [keepChoice, setKeepChoice] = useState<Record<number, string>>({});
  const [nameChoice, setNameChoice] = useState<Record<number, string>>({});
  const [doneIdx, setDoneIdx] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadPairs();
  }, [open]);

  const loadPairs = async () => {
    setLoading(true);
    setDoneIdx(new Set());
    try {
      const { data: clients, error } = await supabase
        .from("clients")
        .select(
          "id, name, email, phone, notes, drive_folder_id, drive_folder_name, account_user_id, strategic_level, fic_id"
        )
        .order("name");
      if (error) throw error;

      const groups = new Map<string, ClientRow[]>();
      for (const c of (clients || []) as ClientRow[]) {
        const key = canonical(c.name);
        if (!key) continue;
        const arr = groups.get(key) || [];
        arr.push(c);
        groups.set(key, arr);
      }

      const dups: ClientRow[][] = [];
      for (const arr of groups.values()) {
        if (arr.length > 1) dups.push(arr);
      }
      
      const allIds = dups.flat().map((c) => c.id);
      const [budgetCounts, projectCounts, contactCounts] = await Promise.all([
        countByClient("budgets", allIds),
        countByClient("projects", allIds),
        countContacts(allIds),
      ]);

      const builtPairs: Pair[] = [];
      const choicesKeep: Record<number, string> = {};
      const choicesName: Record<number, string> = {};
      for (const group of dups) {
        const ranked = [...group].sort((x, y) => scoreClient(y, projectCounts, budgetCounts, contactCounts) - scoreClient(x, projectCounts, budgetCounts, contactCounts));
        const a = ranked[0];
        for (let i = 1; i < ranked.length; i++) {
          const b = ranked[i];
          const idx = builtPairs.length;
          builtPairs.push({
            a,
            b,
            countsA: {
              projects: projectCounts[a.id] || 0,
              budgets: budgetCounts[a.id] || 0,
              contacts: contactCounts[a.id] || 0,
            },
            countsB: {
              projects: projectCounts[b.id] || 0,
              budgets: budgetCounts[b.id] || 0,
              contacts: contactCounts[b.id] || 0,
            },
          });
          choicesKeep[idx] = a.id;
          choicesName[idx] = a.name.length >= b.name.length ? a.name : b.name;
        }
      }

      setPairs(builtPairs);
      setKeepChoice(choicesKeep);
      setNameChoice(choicesName);
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message || "Errore caricamento duplicati", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const scoreClient = (
    c: ClientRow,
    pc: Record<string, number>,
    bc: Record<string, number>,
    cc: Record<string, number>
  ) => {
    let s = 0;
    if (c.drive_folder_id) s += 100;
    if (c.email) s += 5;
    if (c.phone) s += 3;
    if (c.account_user_id) s += 10;
    if (c.fic_id) s += 20;
    s += (pc[c.id] || 0) * 10;
    s += (bc[c.id] || 0) * 5;
    s += (cc[c.id] || 0) * 2;
    s += c.name.length * 0.1;
    return s;
  };

  const handleMerge = async (idx: number) => {
    const pair = pairs[idx];
    if (!pair) return;
    const keepId = keepChoice[idx];
    const dropId = keepId === pair.a.id ? pair.b.id : pair.a.id;
    const finalName = nameChoice[idx];
    setMerging(idx);
    try {
      const { error } = await supabase.rpc("merge_clients", {
        keep_id: keepId,
        drop_id: dropId,
        final_name: finalName || null,
      } as any);
      if (error) throw error;
      toast({ title: "Clienti uniti", description: `"${finalName}" aggiornato.` });
      setDoneIdx((prev) => new Set(prev).add(idx));
      onMerged();
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message || "Errore unione", variant: "destructive" });
    } finally {
      setMerging(null);
    }
  };

  const remaining = pairs.length - doneIdx.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Unisci clienti duplicati
          </DialogTitle>
          <DialogDescription>
            Per ogni coppia scegli quale record mantenere e il nome finale. I collegamenti (budget, progetti,
            contatti, pagamenti) verranno spostati sul cliente mantenuto. L'altro verrà eliminato.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pairs.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Nessun duplicato rilevato.</div>
        ) : (
          <div className="flex-1 overflow-auto space-y-4">
            <div className="text-xs text-muted-foreground">
              {pairs.length} coppie totali · {remaining} da gestire · {doneIdx.size} unite
            </div>
            {pairs.map((pair, idx) => {
              const isDone = doneIdx.has(idx);
              const keepId = keepChoice[idx];
              return (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 ${isDone ? "opacity-50 bg-muted" : ""}`}
                >
                  {isDone ? (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> Unione completata
                    </div>
                  ) : (
                    <>
                      <RadioGroup
                        value={keepId || ""}
                        onValueChange={(v) => setKeepChoice((prev) => ({ ...prev, [idx]: v }))}
                        className="grid grid-cols-2 gap-3"
                      >
                        {[pair.a, pair.b].map((c) => {
                          const counts = c.id === pair.a.id ? pair.countsA : pair.countsB;
                          return (
                            <Label
                              key={c.id}
                              htmlFor={`pair-${idx}-${c.id}`}
                              className={`border rounded-md p-3 cursor-pointer hover:border-primary transition-colors ${
                                keepId === c.id ? "border-primary bg-primary/5" : ""
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <RadioGroupItem value={c.id} id={`pair-${idx}-${c.id}`} className="mt-1" />
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="font-medium text-sm break-words">{c.name}</div>
                                  <div className="flex flex-wrap gap-1">
                                    {c.drive_folder_id && (
                                      <Badge variant="secondary" className="text-[10px]">Drive</Badge>
                                    )}
                                    {c.fic_id && <Badge variant="secondary" className="text-[10px]">FIC</Badge>}
                                    {c.account_user_id && (
                                      <Badge variant="secondary" className="text-[10px]">Account</Badge>
                                    )}
                                    <Badge variant="outline" className="text-[10px]">
                                      {counts.projects} progetti
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">
                                      {counts.budgets} budget
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">
                                      {counts.contacts} contatti
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    {c.email && <div>📧 {c.email}</div>}
                                    {c.phone && <div>📞 {c.phone}</div>}
                                    {c.notes && (
                                      <div className="line-clamp-2">📝 {c.notes}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Label>
                          );
                        })}
                      </RadioGroup>

                      <div className="mt-3 flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-xs text-muted-foreground">Nome finale:</Label>
                        <div className="flex gap-1 flex-wrap">
                          {[pair.a.name, pair.b.name].map((n) => (
                            <Button
                              key={n}
                              type="button"
                              size="sm"
                              variant={nameChoice[idx] === n ? "default" : "outline"}
                              onClick={() => setNameChoice((prev) => ({ ...prev, [idx]: n }))}
                              className="h-7 text-xs"
                            >
                              {n}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDoneIdx((prev) => new Set(prev).add(idx))}
                        >
                          Salta
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleMerge(idx)}
                          disabled={!keepId || merging === idx}
                        >
                          {merging === idx && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          Unisci
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

async function countByClient(table: "budgets" | "projects", ids: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (ids.length === 0) return result;
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const { data } = await supabase.from(table).select("client_id").in("client_id", slice);
    for (const row of (data || []) as any[]) {
      const id = row.client_id;
      if (!id) continue;
      result[id] = (result[id] || 0) + 1;
    }
  }
  return result;
}

async function countContacts(ids: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (ids.length === 0) return result;
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const { data } = await supabase.from("client_contact_clients").select("client_id").in("client_id", slice);
    for (const row of (data || []) as any[]) {
      const id = row.client_id;
      if (!id) continue;
      result[id] = (result[id] || 0) + 1;
    }
  }
  return result;
}
