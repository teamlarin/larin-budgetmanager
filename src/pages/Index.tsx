import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen, Plus } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="text-center space-y-6 py-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Budget Manager</h1>
            <p className="text-xl text-muted-foreground">
              Gestisci budget e costi di progetti in modo professionale
            </p>
          </div>

          <div className="max-w-2xl mx-auto grid gap-4 md:grid-cols-2">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects')}>
              <CardHeader className="text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>I Miei Progetti</CardTitle>
                <CardDescription>
                  Visualizza e gestisci tutti i tuoi progetti esistenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Vai ai Progetti
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects')}>
              <CardHeader className="text-center">
                <Plus className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>Nuovo Progetto</CardTitle>
                <CardDescription>
                  Crea un nuovo progetto e inizia a gestire il budget
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  Crea Progetto
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
