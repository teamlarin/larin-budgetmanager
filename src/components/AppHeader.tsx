import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FolderOpen, LogOut, User, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface AppHeaderProps {
  user: any;
  userProfile: { first_name: string; last_name: string; avatar_url?: string } | null;
  onLogout: () => void;
}

export const AppHeader = ({ user, userProfile, onLogout }: AppHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getInitials = () => {
    if (!userProfile) return 'U';
    const firstInitial = userProfile.first_name?.charAt(0) || '';
    const lastInitial = userProfile.last_name?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  };

  const getFullName = () => {
    if (!userProfile) return 'Utente';
    return `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Utente';
  };

  const menuItems = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'I Miei Budget', icon: FolderOpen, path: '/projects?view=mine' },
    { label: 'Tutti i Budget', icon: FolderOpen, path: '/projects?view=all' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground">Budget Manager</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Navigation Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Navigazione</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-6">
                {menuItems.map((item) => (
                  <Button
                    key={item.path}
                    variant={location.pathname === item.path || 
                             (item.path.includes('view=') && location.search.includes(item.path.split('?')[1]))
                             ? 'secondary' : 'ghost'}
                    className="justify-start"
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 h-auto py-2 px-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userProfile?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="font-semibold">{getFullName()}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Il Mio Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profilo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
