import { useState, useEffect, useMemo } from "react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Shield, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  role: z.enum(["admin", "editor", "subscriber"]),
});

type UserRole = "admin" | "editor" | "subscriber";

interface UserWithRole {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  approved: boolean;
  roles: UserRole[];
}

export const UserManagement = () => {
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState<UserWithRole[]>([]);
  const [allPendingUsers, setAllPendingUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("approved");
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});
  const [currentPageApproved, setCurrentPageApproved] = useState(1);
  const [currentPagePending, setCurrentPagePending] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "subscriber" as UserRole,
  });

  const totalPagesApproved = Math.ceil(allUsers.length / ITEMS_PER_PAGE);
  const totalPagesPending = Math.ceil(allPendingUsers.length / ITEMS_PER_PAGE);
  
  const users = useMemo(() => {
    const startIndex = (currentPageApproved - 1) * ITEMS_PER_PAGE;
    return allUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allUsers, currentPageApproved]);
  
  const pendingUsers = useMemo(() => {
    const startIndex = (currentPagePending - 1) * ITEMS_PER_PAGE;
    return allPendingUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allPendingUsers, currentPagePending]);

  useEffect(() => {
    loadUsers();
  }, []);

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
      roles: userRoles
        .filter(ur => ur.user_id === profile.id)
        .map(ur => ur.role as UserRole),
    }));

    const approved = usersWithRoles.filter(u => u.approved);
    const pending = usersWithRoles.filter(u => !u.approved);

    setAllUsers(approved);
    setAllPendingUsers(pending);
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

    toast({
      title: "Ruolo aggiornato",
      description: "Il ruolo dell'utente è stato modificato con successo",
    });

    loadUsers();
  };

  const handleApproveUser = async (userId: string, role: UserRole) => {
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

    // Update role if not subscriber
    if (role !== "subscriber") {
      await supabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", userId)
        .eq("role", "subscriber");
    }

    toast({
      title: "Utente approvato",
      description: "L'utente può ora accedere al sistema",
    });

    loadUsers();
  };

  const handleRejectUser = async (userId: string) => {
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

    toast({
      title: "Utente rifiutato",
      description: "La registrazione è stata rifiutata",
    });

    loadUsers();
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: deleteUserId }
      });

      if (error) {
        console.error('Delete user error:', error);
        toast({
          title: "Errore",
          description: error.message || "Impossibile eliminare l'utente",
          variant: "destructive",
        });
      } else if (data?.error) {
        console.error('Delete user error:', data.error);
        toast({
          title: "Errore",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Utente eliminato",
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

    setDeleteUserId(null);
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

    // Approve user immediately when created by admin
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ approved: true })
        .eq("id", data.user.id);
    }

    if (data.user && result.data.role !== "subscriber") {
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: result.data.role })
        .eq("user_id", data.user.id)
        .eq("role", "subscriber");

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
      role: "subscriber",
    });
    
    loadUsers();
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "editor":
        return "default";
      case "subscriber":
        return "secondary";
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
                Gestione Utenti
              </CardTitle>
              <CardDescription>
                Visualizza e gestisci gli utenti e i loro ruoli
              </CardDescription>
            </div>
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
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="subscriber">Subscriber</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">
                    Crea Utente
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="approved">
                Utenti Approvati ({allUsers.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Utenti in Attesa ({allPendingUsers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="approved" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ruolo</TableHead>
                    <TableHead>Data registrazione</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.roles[0] || "subscriber"}
                          onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <Badge variant={getRoleBadgeVariant("admin")}>Admin</Badge>
                            </SelectItem>
                            <SelectItem value="editor">
                              <Badge variant={getRoleBadgeVariant("editor")}>Editor</Badge>
                            </SelectItem>
                            <SelectItem value="subscriber">
                              <Badge variant={getRoleBadgeVariant("subscriber")}>Subscriber</Badge>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString("it-IT")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteUserId(user.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="subscriber">Subscriber</SelectItem>
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
                              onClick={() => handleApproveUser(user.id, selectedRoles[user.id] || "subscriber")}
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
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. L'utente verrà eliminato permanentemente dal sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
