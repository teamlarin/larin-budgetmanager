import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Calendar, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ContractType = "full-time" | "part-time" | "freelance" | "consuntivo";
type ContractHoursPeriod = "daily" | "weekly" | "monthly";

interface ContractPeriod {
  id: string;
  user_id: string;
  hourly_rate: number;
  contract_type: string;
  contract_hours: number;
  contract_hours_period: string;
  target_productivity_percentage: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

interface UserContractPeriodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentContractData: {
    hourly_rate: number;
    contract_type: ContractType;
    contract_hours: number;
    contract_hours_period: ContractHoursPeriod;
    target_productivity_percentage: number;
  };
  onContractUpdated: () => void;
}

export const UserContractPeriodsDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
  currentContractData,
  onContractUpdated,
}: UserContractPeriodsDialogProps) => {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<ContractPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<ContractPeriod | null>(null);
  const [deletePeriodId, setDeletePeriodId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    hourly_rate: currentContractData.hourly_rate,
    contract_type: currentContractData.contract_type as ContractType,
    contract_hours: currentContractData.contract_hours,
    contract_hours_period: currentContractData.contract_hours_period as ContractHoursPeriod,
    target_productivity_percentage: currentContractData.target_productivity_percentage,
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
  });

  useEffect(() => {
    if (open) {
      loadPeriods();
    }
  }, [open, userId]);

  const loadPeriods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_contract_periods")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false });

    if (error) {
      console.error("Error loading contract periods:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i periodi contrattuali",
        variant: "destructive",
      });
    } else {
      setPeriods(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      hourly_rate: currentContractData.hourly_rate,
      contract_type: currentContractData.contract_type,
      contract_hours: currentContractData.contract_hours,
      contract_hours_period: currentContractData.contract_hours_period,
      target_productivity_percentage: currentContractData.target_productivity_percentage,
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: "",
    });
    setShowAddForm(false);
    setEditingPeriod(null);
  };

  const handleSavePeriod = async () => {
    if (!formData.start_date) {
      toast({
        title: "Errore",
        description: "La data di inizio è obbligatoria",
        variant: "destructive",
      });
      return;
    }

    // If there's a current period without end_date, close it
    const currentActivePeriod = periods.find(p => !p.end_date && p.id !== editingPeriod?.id);
    if (currentActivePeriod && !editingPeriod) {
      const newEndDate = new Date(formData.start_date);
      newEndDate.setDate(newEndDate.getDate() - 1);
      
      await supabase
        .from("user_contract_periods")
        .update({ end_date: format(newEndDate, "yyyy-MM-dd") })
        .eq("id", currentActivePeriod.id);
    }

    const periodData = {
      user_id: userId,
      hourly_rate: formData.hourly_rate,
      contract_type: formData.contract_type,
      contract_hours: formData.contract_hours,
      contract_hours_period: formData.contract_hours_period,
      target_productivity_percentage: formData.target_productivity_percentage,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
    };

    let error;
    if (editingPeriod) {
      const { error: updateError } = await supabase
        .from("user_contract_periods")
        .update(periodData)
        .eq("id", editingPeriod.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("user_contract_periods")
        .insert(periodData);
      error = insertError;
    }

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare il periodo contrattuale",
        variant: "destructive",
      });
      return;
    }

    // Update the current profile data with the latest period values if this is a new/current period
    if (!formData.end_date) {
      await supabase
        .from("profiles")
        .update({
          hourly_rate: formData.hourly_rate,
          contract_type: formData.contract_type,
          contract_hours: formData.contract_hours,
          contract_hours_period: formData.contract_hours_period,
          target_productivity_percentage: formData.target_productivity_percentage,
        })
        .eq("id", userId);
    }

    toast({
      title: editingPeriod ? "Periodo aggiornato" : "Periodo creato",
      description: "Le modifiche sono state salvate",
    });

    resetForm();
    loadPeriods();
    onContractUpdated();
  };

  const handleDeletePeriod = async () => {
    if (!deletePeriodId) return;

    const { error } = await supabase
      .from("user_contract_periods")
      .delete()
      .eq("id", deletePeriodId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il periodo",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Periodo eliminato",
        description: "Il periodo contrattuale è stato rimosso",
      });
      loadPeriods();
    }
    setDeletePeriodId(null);
  };

  const handleEditPeriod = (period: ContractPeriod) => {
    setFormData({
      hourly_rate: period.hourly_rate,
      contract_type: period.contract_type as ContractType,
      contract_hours: period.contract_hours,
      contract_hours_period: period.contract_hours_period as ContractHoursPeriod,
      target_productivity_percentage: period.target_productivity_percentage,
      start_date: period.start_date,
      end_date: period.end_date || "",
    });
    setEditingPeriod(period);
    setShowAddForm(true);
  };

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case "full-time": return "Full-time";
      case "part-time": return "Part-time";
      case "freelance": return "Freelance";
      case "consuntivo": return "Consuntivo";
      default: return type;
    }
  };

  const getHoursPeriodLabel = (period: string) => {
    switch (period) {
      case "daily": return "giornaliere";
      case "weekly": return "settimanali";
      case "monthly": return "mensili";
      default: return period;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Storico Contratti - {userName}
            </DialogTitle>
            <DialogDescription>
              Gestisci i periodi contrattuali dell'utente. Le variazioni non incidono sulle ore già registrate.
            </DialogDescription>
          </DialogHeader>

          {!showAddForm ? (
            <>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Periodo
                </Button>
              </div>

              {loading ? (
                <p className="text-center text-muted-foreground py-8">Caricamento...</p>
              ) : periods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun periodo contrattuale registrato.</p>
                  <p className="text-sm">Aggiungi un nuovo periodo per iniziare a tracciare le variazioni.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Costo orario</TableHead>
                      <TableHead>Contratto</TableHead>
                      <TableHead>Ore</TableHead>
                      <TableHead>Target prod.</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((period) => (
                      <TableRow key={period.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">
                              {format(parseISO(period.start_date), "dd MMM yyyy", { locale: it })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {period.end_date 
                                ? `→ ${format(parseISO(period.end_date), "dd MMM yyyy", { locale: it })}`
                                : <Badge variant="outline" className="text-xs">Attivo</Badge>
                              }
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>€{period.hourly_rate}/h</TableCell>
                        <TableCell>{getContractTypeLabel(period.contract_type)}</TableCell>
                        <TableCell>
                          {period.contract_hours} {getHoursPeriodLabel(period.contract_hours_period)}
                        </TableCell>
                        <TableCell>{period.target_productivity_percentage}%</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEditPeriod(period)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setDeletePeriodId(period.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">
                  {editingPeriod ? "Modifica Periodo" : "Nuovo Periodo Contrattuale"}
                </h3>
                <Button variant="outline" onClick={resetForm}>
                  Annulla
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Data Inizio *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">Data Fine</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lascia vuoto se è il contratto attuale
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hourly_rate">Costo orario (€/h)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contract_type">Tipo contratto</Label>
                  <Select
                    value={formData.contract_type}
                    onValueChange={(value) => setFormData({ ...formData, contract_type: value as ContractType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="freelance">Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="contract_hours">Ore da contratto</Label>
                <Input
                  id="contract_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.contract_hours}
                  onChange={(e) => setFormData({ ...formData, contract_hours: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div>
                <Label>Periodo ore contrattuali</Label>
                <RadioGroup
                  value={formData.contract_hours_period}
                  onValueChange={(value) => setFormData({ ...formData, contract_hours_period: value as ContractHoursPeriod })}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="daily" id="period_daily" />
                    <Label htmlFor="period_daily" className="cursor-pointer font-normal">Giornaliere</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weekly" id="period_weekly" />
                    <Label htmlFor="period_weekly" className="cursor-pointer font-normal">Settimanali</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="monthly" id="period_monthly" />
                    <Label htmlFor="period_monthly" className="cursor-pointer font-normal">Mensili</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="target_productivity">Produttività target (%)</Label>
                <Input
                  id="target_productivity"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={formData.target_productivity_percentage}
                  onChange={(e) => setFormData({ ...formData, target_productivity_percentage: parseFloat(e.target.value) || 80 })}
                />
              </div>

              <Button onClick={handleSavePeriod} className="w-full">
                {editingPeriod ? "Aggiorna Periodo" : "Crea Periodo"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePeriodId} onOpenChange={() => setDeletePeriodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo periodo?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Il periodo contrattuale verrà eliminato permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePeriod} className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
