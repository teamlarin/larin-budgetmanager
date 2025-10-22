import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import logo from '@/assets/logo.png';

interface AppHeaderProps {
  onLogout: () => void;
  userProfile: { first_name: string; last_name: string; avatar_url?: string } | null;
}

export const AppHeader = ({ onLogout, userProfile }: AppHeaderProps) => {
  const getInitials = () => {
    if (!userProfile) return 'U';
    const firstInitial = userProfile.first_name?.charAt(0) || '';
    const lastInitial = userProfile.last_name?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Logo and App Name - Clickable to Home */}
        <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={logo} alt="Logo" className="h-8 w-8" />
          <span className="text-lg font-semibold text-foreground">Budget Manager</span>
        </NavLink>

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
