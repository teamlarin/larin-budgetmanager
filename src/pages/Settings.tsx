import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { ClientManagement } from "@/components/ClientManagement";
import { BudgetTemplateManagement } from "@/components/BudgetTemplateManagement";

const Settings = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Impostazioni</h1>
        <p className="text-muted-foreground">
          Gestisci utenti, clienti e template di budget
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Utenti</TabsTrigger>
          <TabsTrigger value="clients">Clienti</TabsTrigger>
          <TabsTrigger value="templates">Template Budget</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="clients">
          <ClientManagement />
        </TabsContent>

        <TabsContent value="templates">
          <BudgetTemplateManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
