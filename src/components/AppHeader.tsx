import { NavLink } from 'react-router-dom';
import { LogOut, Home, FolderOpen, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppHeaderProps {
  onLogout: () => void;
  userProfile: { first_name: string; last_name: string; avatar_url?: string } | null;
  isAdmin: boolean;
}

export const AppHeader = ({ onLogout, userProfile, isAdmin }: AppHeaderProps) => {
  const getInitials = () => {
    if (!userProfile) return 'U';
    const firstInitial = userProfile.first_name?.charAt(0) || '';
    const lastInitial = userProfile.last_name?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Settings (only for admins) */}
        <div>
          {isAdmin && (
            <Button variant="ghost" asChild>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  isActive ? 'bg-secondary' : ''
                }
              >
                <Settings className="h-5 w-5 mr-2" />
                Impostazioni
              </NavLink>
            </Button>
          )}
        </div>

        {/* Center: Navigation Menu */}
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'bg-secondary' : ''
              }
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </NavLink>
          </Button>
          <Button variant="ghost" asChild>
            <NavLink
              to="/projects?view=mine"
              className={({ isActive }) =>
                isActive ? 'bg-secondary' : ''
              }
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              I Miei Budget
            </NavLink>
          </Button>
          <Button variant="ghost" asChild>
            <NavLink
              to="/projects?view=all"
              className={({ isActive }) =>
                isActive ? 'bg-secondary' : ''
              }
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Tutti i Budget
            </NavLink>
          </Button>
        </nav>

        {/* Right: User Profile & Logout */}
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userProfile?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {userProfile?.first_name} {userProfile?.last_name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <NavLink to="/profile" className="cursor-pointer">
                  Profilo
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
