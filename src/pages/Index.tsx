import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen, Plus } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      <div className="text-center space-y-6 py-12">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Budget Manager</h1>
          <p className="text-xl text-muted-foreground">
            Gestisci budget e costi in modo professionale
          </p>
        </div>

        <div className="max-w-3xl mx-auto grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects?view=mine')}>
            <CardHeader className="text-center">
              <FolderOpen className="h-12 w-12 mx-auto text-primary mb-2" />
              <CardTitle>I Miei Budget</CardTitle>
              <CardDescription>
                Visualizza e gestisci solo i tuoi budget
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                I Miei Budget
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects?view=all')}>
            <CardHeader className="text-center">
              <FolderOpen className="h-12 w-12 mx-auto text-secondary mb-2" />
              <CardTitle>Tutti i Budget</CardTitle>
              <CardDescription>
                Visualizza tutti i budget di tutti gli utenti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                Tutti i Budget
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects?view=mine')}>
            <CardHeader className="text-center">
              <Plus className="h-12 w-12 mx-auto text-primary mb-2" />
              <CardTitle>Nuovo Budget</CardTitle>
              <CardDescription>
                Crea un nuovo budget e inizia a gestire i costi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Crea Budget
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
