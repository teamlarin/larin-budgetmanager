import { NavLink } from 'react-router-dom';
import { LogOut, FileText, FolderKanban, CheckCircle2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/NotificationBell';
import logo from '@/assets/logo-tt.svg';

interface AppHeaderProps {
  onLogout: () => void;
  userProfile: { first_name: string; last_name: string; avatar_url?: string } | null;
  userRole: 'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null;
}

export const AppHeader = ({ onLogout, userProfile, userRole }: AppHeaderProps) => {
  const isAdmin = userRole === 'admin' || userRole === 'account';
  const canViewProjects = userRole !== null; // All authenticated users can see projects
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
        <div className="flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={logo} alt="Logo" className="h-8 w-8" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-foreground leading-tight">TimeTrap</span>
              <span className="text-xs text-muted-foreground">Make smartworking smarter</span>
            </div>
          </NavLink>
          
          {/* Navigation Links */}
          <nav className="flex items-center gap-4">
            <NavLink 
              to="/calendar" 
              className={({ isActive }) => 
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              <Calendar className="h-4 w-4" />
              Calendario
            </NavLink>
            {isAdmin && (
              <NavLink 
                to="/budgets" 
                className={({ isActive }) => 
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`
                }
              >
                <FolderKanban className="h-4 w-4" />
                Budget
              </NavLink>
            )}
            {isAdmin && (
              <NavLink 
                to="/quotes" 
                className={({ isActive }) => 
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`
                }
              >
                <FileText className="h-4 w-4" />
                Preventivi
              </NavLink>
            )}
            {canViewProjects && (
              <NavLink 
                to="/approved-projects" 
                className={({ isActive }) => 
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                Progetti
              </NavLink>
            )}
          </nav>
        </div>

        {/* Right: User Profile & Logout */}
        <div className="flex items-center gap-2">
          <NotificationBell />
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
