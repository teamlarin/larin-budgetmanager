import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface AppHeaderProps {
  onLogout: () => void;
}

export const AppHeader = ({ onLogout }: AppHeaderProps) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <h1 className="text-xl font-bold text-foreground">Budget Manager</h1>
        </div>

        <Button variant="ghost" size="icon" onClick={onLogout} title="Esci">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};
