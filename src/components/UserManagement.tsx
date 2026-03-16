import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Shield, Plus, Pencil, Key, RotateCcw, Archive, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, History, MapPin, FileText } from "lucide-react";
import { TeamLeaderAreasDialog } from "./TeamLeaderAreasDialog";
import { UserContractPeriodsDialog } from "./UserContractPeriodsDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { z } from "zod";
import { useActionLogger } from "@/hooks/useActionLogger";

const createUserSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "Il nome è obbligatorio")
    .max(50, "Il nome è troppo lungo")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Il nome contiene caratteri non validi"),
  last_name: z
    .string()
    .trim()
    .min(1, "Il cognome è obbligatorio")
    .max(50, "Il cognome è troppo lungo")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Il cognome contiene caratteri non validi"),
  email: z.string().trim().email("Indirizzo email non valido").max(255),
  password: z
    .string()
    .min(8, "La password deve contenere almeno 8 caratteri")
    .regex(/[A-Z]/, "La password deve contenere almeno una lettera maiuscola")
    .regex(/[a-z]/, "La password deve contenere almeno una lettera minuscola")
    .regex(/[0-9]/, "La password deve contenere almeno un numero"),
  role: z.enum(["admin", "account", "finance", "team_leader", "coordinator", "member", "external"]),
  hourly_rate: z.number().min(0, "Il costo orario deve essere positivo"),
  contract_type: z.enum(["full-time", "part-time", "freelance"]),
  contract_hours: z.number().min(0, "Le ore devono essere positive"),
  contract_hours_period: z.enum(["daily", "weekly", "monthly"]),
  target_productivity_percentage: z.number().min(0).max(100, "La percentuale deve essere tra 0 e 100"),
});

type UserRole = "admin" | "account" | "finance" | "team_leader" | "coordinator" | "member" | "external";
type ContractType = "full-time" | "part-time" | "freelance";
type ContractHoursPeriod = "daily" | "weekly" | "monthly";

type UserArea = "tech" | "marketing" | "branding" | "sales" | "struttura" | "ai";

interface UserWithRole {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  approved: boolean;
  roles: UserRole[];
  hourly_rate: number;
  contract_type: ContractType;
  contract_hours: number;
  contract_hours_period: ContractHoursPeriod;
  deleted_at: string | null;
  target_productivity_percentage: number;
  title: string | null;
  area: UserArea | null;
}

export const UserManagement = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { logAction } = useActionLogger();
  const [allUsers, setAllUsers] = useState<UserWithRole[]>([]);
  const [allPendingUsers, setAllPendingUsers] = useState<UserWithRole[]>([]);
  const [allDeletedUsers, setAllDeletedUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [hardDeleteUserId, setHardDeleteUserId] = useState<string | null>(null);
  const [restoreUserId, setRestoreUserId] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [contractPeriodsDialogOpen, setContractPeriodsDialogOpen] = useState(false);
  const [contractPeriodsUser, setContractPeriodsUser] = useState<UserWithRole | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [activeTab, setActiveTab] = useState("approved");
  const [teamLeaderAreasDialogOpen, setTeamLeaderAreasDialogOpen] = useState(false);
  const [teamLeaderAreasUser, setTeamLeaderAreasUser] = useState<UserWithRole | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});
  const [currentPageApproved, setCurrentPageApproved] = useState(1);
  const [currentPagePending, setCurrentPagePending] = useState(1);
  const [currentPageDeleted, setCurrentPageDeleted] = useState(1);
  const [overheadsAmount, setOverheadsAmount] = useState(0);
  
  // Sorting and filtering state
  const [sortField, setSortField] = useState<'name' | 'role' | 'hourly_rate' | null>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  
  const ITEMS_PER_PAGE = 20;
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "member" as UserRole,
    hourly_rate: 0,
    contract_type: "full-time" as ContractType,
    contract_hours: 0,
    contract_hours_period: "monthly" as ContractHoursPeriod,
    target_productivity_percentage: 80,
    title: "",
    area: "" as UserArea | "",
  });

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...allUsers];
    
    // Apply contract filter
    if (contractFilter !== 'all') {
      result = result.filter(u => u.contract_type === contractFilter);
    }

    // Apply area filter
    if (areaFilter !== 'all') {
      result = result.filter(u => u.area === areaFilter);
    }
    
    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'name':
            const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
            const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
            comparison = nameA.localeCompare(nameB);
            break;
          case 'role':
            const roleA = a.roles[0] || 'member';
            const roleB = b.roles[0] || 'member';
            comparison = roleA.localeCompare(roleB);
            break;
          case 'hourly_rate':
            comparison = (a.hourly_rate || 0) - (b.hourly_rate || 0);
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    return result;
  }, [allUsers, sortField, sortDirection, contractFilter, areaFilter]);

  const totalPagesApproved = Math.ceil(filteredAndSortedUsers.length / ITEMS_PER_PAGE);
  const totalPagesPending = Math.ceil(allPendingUsers.length / ITEMS_PER_PAGE);
  const totalPagesDeleted = Math.ceil(allDeletedUsers.length / ITEMS_PER_PAGE);
  
  const users = useMemo(() => {
    const startIndex = (currentPageApproved - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedUsers, currentPageApproved]);
  
  const pendingUsers = useMemo(() => {
    const startIndex = (currentPagePending - 1) * ITEMS_PER_PAGE;
    return allPendingUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allPendingUsers, currentPagePending]);

  const deletedUsers = useMemo(() => {
    const startIndex = (currentPageDeleted - 1) * ITEMS_PER_PAGE;
    return allDeletedUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allDeletedUsers, currentPageDeleted]);

  const handleSort = (field: 'name' | 'role' | 'hourly_rate') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPageApproved(1);
  };

  const getSortIcon = (field: 'name' | 'role' | 'hourly_rate') => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  useEffect(() => {
    loadUsers();
    loadOverheads();
  }, []);

  const loadOverheads = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'overheads')
        .maybeSingle();
      
      if (data?.setting_value && typeof data.setting_value === 'object' && 'amount' in data.setting_value) {
        setOverheadsAmount(Number((data.setting_value as { amount: number }).amount) || 0);
      }
    } catch (error) {
      console.error('Error loading overheads:', error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      toast({
        title: "Errore",
        description: "Impossibile caricare gli utenti",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");

    if (rolesError) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i ruoli",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const usersWithRoles: UserWithRole[] = profiles.map(profile => ({
      ...profile,
      area: (profile.area as UserArea | null) || null,
      roles: userRoles
        .filter(ur => ur.user_id === profile.id)
        .map(ur => ur.role as UserRole),
    }));

    const approved = usersWithRoles.filter(u => u.approved && !u.deleted_at);
    const pending = usersWithRoles.filter(u => !u.approved && !u.deleted_at);
    const deleted = usersWithRoles.filter(u => u.deleted_at);

    setAllUsers(approved);
    setAllPendingUsers(pending);
    setAllDeletedUsers(deleted);
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il ruolo",
        variant: "destructive",
      });
      return;
    }

    const { error: insertError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole });

    if (insertError) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il ruolo",
        variant: "destructive",
      });
      return;
    }

    logAction({
      actionType: 'update',
      actionDescription: `Ruolo utente modificato a "${newRole}"`,
      entityType: 'user',
      entityId: userId,
    });
    toast({
      title: "Ruolo aggiornato",
      description: "Il ruolo dell'utente è stato modificato con successo",
    });

    loadUsers();
  };

  const handleApproveUser = async (userId: string, role: UserRole) => {
    const userToApprove = allPendingUsers.find(u => u.id === userId);
    
    const { error } = await supabase
      .from("profiles")
      .update({ approved: true })
      .eq("id", userId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile approvare l'utente",
        variant: "destructive",
      });
      return;
    }

    // Update role if not member
    if (role !== "member") {
      await supabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", userId)
        .eq("role", "member");
    }

    logAction({
      actionType: 'approve',
      actionDescription: `Utente "${userToApprove?.email || userId}" approvato con ruolo "${role}"`,
      entityType: 'user',
      entityId: userId,
    });
    toast({
      title: "Utente approvato",
      description: "L'utente può ora accedere al sistema",
    });

    loadUsers();
  };

  const handleRejectUser = async (userId: string) => {
    const userToReject = allPendingUsers.find(u => u.id === userId);
    
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile rifiutare l'utente",
        variant: "destructive",
      });
      return;
    }

    logAction({
      actionType: 'reject',
      actionDescription: `Registrazione utente "${userToReject?.email || userId}" rifiutata`,
      entityType: 'user',
      entityId: userId,
    });
    toast({
      title: "Utente rifiutato",
      description: "La registrazione è stata rifiutata",
    });

    loadUsers();
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    const userToDelete = allUsers.find(u => u.id === deleteUserId);

    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: deleteUserId, action: 'soft_delete' }
      });

      if (error) {
        console.error('Soft delete user error:', error);
        toast({
          title: "Errore",
          description: error.message || "Impossibile disattivare l'utente",
          variant: "destructive",
        });
      } else if (data?.error) {
        console.error('Soft delete user error:', data.error);
        toast({
          title: "Errore",
          description: data.error,
          variant: "destructive",
        });
      } else {
        logAction({
          actionType: 'delete',
          actionDescription: `Utente "${userToDelete?.email || deleteUserId}" disattivato`,
          entityType: 'user',
          entityId: deleteUserId,
        });
        toast({
          title: "Utente disattivato",
          description: "L'utente è stato disattivato e può essere ripristinato",
        });
        loadUsers();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore imprevisto",
        variant: "destructive",
      });
    }

    setDeleteUserId(null);
  };

  const handleRestoreUser = async () => {
    if (!restoreUserId) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: restoreUserId, action: 'restore' }
      });

      if (error) {
        console.error('Restore user error:', error);
        toast({
          title: "Errore",
          description: error.message || "Impossibile ripristinare l'utente",
          variant: "destructive",
        });
      } else if (data?.error) {
        console.error('Restore user error:', data.error);
        toast({
          title: "Errore",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Utente ripristinato",
          description: "L'utente è stato ripristinato con successo",
        });
        loadUsers();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore imprevisto",
        variant: "destructive",
      });
    }

    setRestoreUserId(null);
  };

  const handleHardDeleteUser = async () => {
    if (!hardDeleteUserId) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: hardDeleteUserId, action: 'hard_delete' }
      });

      if (error) {
        console.error('Hard delete user error:', error);
        toast({
          title: "Errore",
          description: error.message || "Impossibile eliminare definitivamente l'utente",
          variant: "destructive",
        });
      } else if (data?.error) {
        console.error('Hard delete user error:', data.error);
        toast({
          title: "Errore",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Utente eliminato definitivamente",
          description: "L'utente è stato rimosso completamente dal sistema",
        });
        loadUsers();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Errore",
        description: "Si è verificato un errore imprevisto",
        variant: "destructive",
      });
    }

    setHardDeleteUserId(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = createUserSchema.safeParse(formData);
    if (!result.success) {
      const errors = result.error.errors.map((e) => e.message).join(", ");
      toast({
        title: "Errore di validazione",
        description: errors,
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        data: {
          first_name: result.data.first_name,
          last_name: result.data.last_name,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Approve user immediately when created by admin and set contract details
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ 
          approved: true,
          hourly_rate: result.data.hourly_rate,
          contract_type: result.data.contract_type,
          contract_hours: result.data.contract_hours,
          contract_hours_period: result.data.contract_hours_period,
          target_productivity_percentage: result.data.target_productivity_percentage,
          title: formData.title || null,
          area: formData.area || null,
        })
        .eq("id", data.user.id);
    }

    if (data.user && result.data.role !== "member") {
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: result.data.role })
        .eq("user_id", data.user.id)
        .eq("role", "member");

      if (roleError) {
        toast({
          title: "Avviso",
          description: "Utente creato ma errore nell'assegnazione del ruolo",
          variant: "destructive",
        });
      }
    }

    toast({
      title: "Utente creato",
      description: "L'utente è stato creato con successo",
    });

    setDialogOpen(false);
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      role: "member",
      hourly_rate: 0,
      contract_type: "full-time",
      contract_hours: 0,
      contract_hours_period: "monthly",
      target_productivity_percentage: 80,
      title: "",
      area: "",
    });
    
    loadUsers();
  };

  const getRoleBadgeVariant = (role: UserRole): "admin" | "account" | "finance" | "team_leader" | "coordinator" | "member" => {
    return role;
  };

  const getContractTypeLabel = (type: ContractType) => {
    switch (type) {
      case "full-time":
        return "Full-time";
      case "part-time":
        return "Part-time";
      case "freelance":
        return "Freelance";
    }
  };

  const getHoursPeriodLabel = (period: ContractHoursPeriod) => {
    switch (period) {
      case "daily":
        return "giornaliere";
      case "weekly":
        return "settimanali";
      case "monthly":
        return "mensili";
    }
  };

  const getAreaLabel = (area: UserArea | null) => {
    if (!area) return "-";
    switch (area) {
      case "tech":
        return "Tech";
      case "marketing":
        return "Marketing";
      case "branding":
        return "Branding";
      case "sales":
        return "Sales";
      case "struttura":
        return "Struttura";
      case "ai":
        return "AI";
      default:
        return area;
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        hourly_rate: editingUser.hourly_rate,
        contract_type: editingUser.contract_type,
        contract_hours: editingUser.contract_hours,
        contract_hours_period: editingUser.contract_hours_period,
        target_productivity_percentage: editingUser.target_productivity_percentage,
        title: editingUser.title || null,
        area: editingUser.area || null,
      })
      .eq("id", editingUser.id);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'utente",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Utente aggiornato",
      description: "I dati dell'utente sono stati aggiornati con successo",
    });

    setEditDialogOpen(false);
    setEditingUser(null);
    loadUsers();
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId) return;

    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId: resetPasswordUserId }
      });

      if (error) {
        toast({
          title: "Errore",
          description: error.message || "Impossibile reimpostare la password",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Password reimpostata",
        description: "Email di reset password inviata con successo all'utente",
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il reset della password",
        variant: "destructive",
      });
    } finally {
      setResetPasswordUserId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-center text-muted-foreground">Caricamento utenti...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Gestione utenti
              </CardTitle>
              <CardDescription>
                Visualizza e gestisci gli utenti e i loro ruoli
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/user-action-logs')}
              >
                <FileText className="mr-2 h-4 w-4" />
                Log
              </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Utente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crea Nuovo Utente</DialogTitle>
                  <DialogDescription>
                    Inserisci i dati per creare un nuovo utente
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <Label htmlFor="first_name">Nome *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Cognome *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Ruolo</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                   <SelectItem value="member">Member</SelectItem>
                   <SelectItem value="external">External</SelectItem>
                      </SelectContent>
                    </Select>
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
                        <RadioGroupItem value="daily" id="daily" />
                        <Label htmlFor="daily" className="cursor-pointer font-normal">Giornaliere</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="weekly" id="weekly" />
                        <Label htmlFor="weekly" className="cursor-pointer font-normal">Settimanali</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="monthly" id="monthly" />
                        <Label htmlFor="monthly" className="cursor-pointer font-normal">Mensili</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="target_productivity">Produttività target (%)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Percentuale ore su progetti fatturabili rispetto al totale
                    </p>
                    <Input
                      id="target_productivity"
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={formData.target_productivity_percentage}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setFormData({ ...formData, target_productivity_percentage: isNaN(value) ? 0 : value });
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">Titolo</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Es. Operations Manager, CEO..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="area">Area</Label>
                      <Select
                        value={formData.area}
                        onValueChange={(value) => setFormData({ ...formData, area: value as UserArea })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona area" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tech">Tech</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="branding">Branding</SelectItem>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="struttura">Struttura</SelectItem>
                          <SelectItem value="ai">AI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Crea Utente
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="approved">
                Utenti Approvati ({allUsers.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Utenti in Attesa ({allPendingUsers.length})
              </TabsTrigger>
              <TabsTrigger value="deleted">
                Eliminati ({allDeletedUsers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="approved" className="mt-4 space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Contratto:</Label>
                  <Select value={contractFilter} onValueChange={(value) => { setContractFilter(value); setCurrentPageApproved(1); }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Tutti" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="freelance">Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Area:</Label>
                  <Select value={areaFilter} onValueChange={(value) => { setAreaFilter(value); setCurrentPageApproved(1); }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Tutte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="tech">Tech</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="branding">Branding</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="struttura">Struttura</SelectItem>
                      <SelectItem value="ai">AI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(contractFilter !== 'all' || areaFilter !== 'all') && (
                  <Badge variant="secondary">
                    {filteredAndSortedUsers.length} risultati
                  </Badge>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => handleSort('name')}>
                        Nome {getSortIcon('name')}
                      </Button>
                    </TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => handleSort('role')}>
                        Ruolo {getSortIcon('role')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => handleSort('hourly_rate')}>
                        Costo orario {getSortIcon('hourly_rate')}
                      </Button>
                    </TableHead>
                    <TableHead>Costo effettivo</TableHead>
                    <TableHead>Contratto</TableHead>
                    <TableHead>Ore</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getAreaLabel(user.area)}</Badge>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.roles[0] || "member"}
                          onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <Badge variant={getRoleBadgeVariant("admin")}>Admin</Badge>
                            </SelectItem>
                            <SelectItem value="account">
                              <Badge variant={getRoleBadgeVariant("account")}>Account</Badge>
                            </SelectItem>
                            <SelectItem value="finance">
                              <Badge variant={getRoleBadgeVariant("finance")}>Finance</Badge>
                            </SelectItem>
                            <SelectItem value="team_leader">
                              <Badge variant={getRoleBadgeVariant("team_leader")}>Team Leader</Badge>
                            </SelectItem>
                            <SelectItem value="coordinator">
                              <Badge variant={getRoleBadgeVariant("coordinator")}>Coordinator</Badge>
                            </SelectItem>
                            <SelectItem value="member">
                              <Badge variant={getRoleBadgeVariant("member")}>Member</Badge>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>€{user.hourly_rate || 0}/h</TableCell>
                      <TableCell className="font-medium text-primary">
                        €{((user.hourly_rate || 0) + overheadsAmount).toFixed(2)}/h
                      </TableCell>
                      <TableCell>{getContractTypeLabel(user.contract_type || "full-time")}</TableCell>
                      <TableCell>
                        {user.contract_hours || 0} {getHoursPeriodLabel(user.contract_hours_period || "monthly")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingUser(user);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setContractPeriodsUser(user);
                                setContractPeriodsDialogOpen(true);
                              }}
                            >
                              <History className="h-4 w-4 mr-2" />
                              Storico Contratti
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setResetPasswordUserId(user.id)}>
                              <Key className="h-4 w-4 mr-2" />
                              Reimposta password
                            </DropdownMenuItem>
                            {user.roles.includes('team_leader') && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setTeamLeaderAreasUser(user);
                                  setTeamLeaderAreasDialogOpen(true);
                                }}
                              >
                                <MapPin className="h-4 w-4 mr-2" />
                                Gestisci Aree
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => setDeleteUserId(user.id)}
                              className="text-destructive"
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Disattiva
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {totalPagesApproved > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPageApproved(p => Math.max(1, p - 1))}
                          className={currentPageApproved === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {[...Array(totalPagesApproved)].map((_, i) => {
                        const page = i + 1;
                        if (page === 1 || page === totalPagesApproved || (page >= currentPageApproved - 1 && page <= currentPageApproved + 1)) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPageApproved(page)}
                                isActive={currentPageApproved === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        } else if (page === currentPageApproved - 2 || page === currentPageApproved + 2) {
                          return <PaginationEllipsis key={page} />;
                        }
                        return null;
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPageApproved(p => Math.min(totalPagesApproved, p + 1))}
                          className={currentPageApproved === totalPagesApproved ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ruolo da Assegnare</TableHead>
                    <TableHead>Data richiesta</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nessun utente in attesa di approvazione
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Select
                            value={selectedRoles[user.id] || "subscriber"}
                            onValueChange={(value) => 
                              setSelectedRoles(prev => ({ ...prev, [user.id]: value as UserRole }))
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString("it-IT")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleApproveUser(user.id, selectedRoles[user.id] || "member")}
                            >
                              Approva
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectUser(user.id)}
                            >
                              Rifiuta
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {totalPagesPending > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPagePending(p => Math.max(1, p - 1))}
                          className={currentPagePending === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {[...Array(totalPagesPending)].map((_, i) => {
                        const page = i + 1;
                        if (page === 1 || page === totalPagesPending || (page >= currentPagePending - 1 && page <= currentPagePending + 1)) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPagePending(page)}
                                isActive={currentPagePending === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        } else if (page === currentPagePending - 2 || page === currentPagePending + 2) {
                          return <PaginationEllipsis key={page} />;
                        }
                        return null;
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPagePending(p => Math.min(totalPagesPending, p + 1))}
                          className={currentPagePending === totalPagesPending ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </TabsContent>

            <TabsContent value="deleted" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ruolo</TableHead>
                    <TableHead>Eliminato il</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nessun utente eliminato
                      </TableCell>
                    </TableRow>
                  ) : (
                    deletedUsers.map((user) => (
                      <TableRow key={user.id} className="opacity-60">
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {user.roles[0] || "member"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.deleted_at ? new Date(user.deleted_at).toLocaleDateString("it-IT") : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRestoreUserId(user.id)}
                              title="Ripristina utente"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Ripristina
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setHardDeleteUserId(user.id)}
                              title="Elimina definitivamente"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Elimina
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {totalPagesDeleted > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPageDeleted(p => Math.max(1, p - 1))}
                          className={currentPageDeleted === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {[...Array(totalPagesDeleted)].map((_, i) => {
                        const page = i + 1;
                        if (page === 1 || page === totalPagesDeleted || (page >= currentPageDeleted - 1 && page <= currentPageDeleted + 1)) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPageDeleted(page)}
                                isActive={currentPageDeleted === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        } else if (page === currentPageDeleted - 2 || page === currentPageDeleted + 2) {
                          return <PaginationEllipsis key={page} />;
                        }
                        return null;
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPageDeleted(p => Math.min(totalPagesDeleted, p + 1))}
                          className={currentPageDeleted === totalPagesDeleted ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Dati Utente</DialogTitle>
            <DialogDescription>
              Modifica i dati contrattuali dell'utente
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_hourly_rate">Costo orario (€/h)</Label>
                  <Input
                    id="edit_hourly_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingUser.hourly_rate}
                    onChange={(e) => setEditingUser({ ...editingUser, hourly_rate: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_contract_type">Tipo contratto</Label>
                  <Select
                    value={editingUser.contract_type}
                    onValueChange={(value) => setEditingUser({ ...editingUser, contract_type: value as ContractType })}
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
                <Label htmlFor="edit_contract_hours">Ore da contratto</Label>
                <Input
                  id="edit_contract_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={editingUser.contract_hours}
                  onChange={(e) => setEditingUser({ ...editingUser, contract_hours: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div>
                <Label>Periodo ore contrattuali</Label>
                <RadioGroup
                  value={editingUser.contract_hours_period}
                  onValueChange={(value) => setEditingUser({ ...editingUser, contract_hours_period: value as ContractHoursPeriod })}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="daily" id="edit_daily" />
                    <Label htmlFor="edit_daily" className="cursor-pointer font-normal">Giornaliere</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weekly" id="edit_weekly" />
                    <Label htmlFor="edit_weekly" className="cursor-pointer font-normal">Settimanali</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="monthly" id="edit_monthly" />
                    <Label htmlFor="edit_monthly" className="cursor-pointer font-normal">Mensili</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="edit_target_productivity">Produttività target (%)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Percentuale ore su progetti fatturabili rispetto al totale
                </p>
                <Input
                  id="edit_target_productivity"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={editingUser.target_productivity_percentage ?? 80}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setEditingUser({ ...editingUser, target_productivity_percentage: isNaN(value) ? 0 : value });
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_title">Titolo</Label>
                  <Input
                    id="edit_title"
                    value={editingUser.title || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, title: e.target.value })}
                    placeholder="Es. Operations Manager, CEO..."
                  />
                </div>
                <div>
                  <Label htmlFor="edit_area">Area</Label>
                  <Select
                    value={editingUser.area || ""}
                    onValueChange={(value) => setEditingUser({ ...editingUser, area: value as UserArea })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tech">Tech</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="branding">Branding</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="struttura">Struttura</SelectItem>
                      <SelectItem value="ai">AI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full">
                Salva Modifiche
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disattivare questo utente?</AlertDialogTitle>
            <AlertDialogDescription>
              L'utente verrà disattivato e non potrà più accedere al sistema. Potrai ripristinarlo in qualsiasi momento dalla sezione "Eliminati".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>Disattiva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreUserId} onOpenChange={() => setRestoreUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ripristinare questo utente?</AlertDialogTitle>
            <AlertDialogDescription>
              L'utente verrà ripristinato e sarà nuovamente visibile nella lista utenti. Dovrà essere approvato nuovamente per accedere al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreUser}>Ripristina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hardDeleteUserId} onOpenChange={() => setHardDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. L'utente e tutti i suoi dati verranno eliminati permanentemente dal sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleHardDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Elimina Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetPasswordUserId} onOpenChange={() => setResetPasswordUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reimposta password utente</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà inviata un'email all'utente con le istruzioni per reimpostare la password. Vuoi continuare?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>
              Invia Email di Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {contractPeriodsUser && (
        <UserContractPeriodsDialog
          open={contractPeriodsDialogOpen}
          onOpenChange={setContractPeriodsDialogOpen}
          userId={contractPeriodsUser.id}
          userName={`${contractPeriodsUser.first_name} ${contractPeriodsUser.last_name}`}
          currentContractData={{
            hourly_rate: contractPeriodsUser.hourly_rate,
            contract_type: contractPeriodsUser.contract_type,
            contract_hours: contractPeriodsUser.contract_hours,
            contract_hours_period: contractPeriodsUser.contract_hours_period,
            target_productivity_percentage: contractPeriodsUser.target_productivity_percentage,
          }}
          onContractUpdated={loadUsers}
        />
      )}

      {teamLeaderAreasUser && (
        <TeamLeaderAreasDialog
          open={teamLeaderAreasDialogOpen}
          onOpenChange={setTeamLeaderAreasDialogOpen}
          userId={teamLeaderAreasUser.id}
          userName={`${teamLeaderAreasUser.first_name} ${teamLeaderAreasUser.last_name}`}
          onSave={loadUsers}
        />
      )}
    </>
  );
};
