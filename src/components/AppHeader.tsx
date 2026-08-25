import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, FileSignature, Receipt, RefreshCcw, Gavel, TrendingUp, FolderKanban, CheckCircle2, Calendar, HelpCircle, Eye, EyeOff, UserCog, BookOpen, GitBranch, Plug, Wallet, ChevronDown, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { NotificationBell } from '@/components/NotificationBell';
import { QuickTaskButton } from '@/components/project-tasks/QuickTaskButton';

import { ThemeToggle } from '@/components/ThemeToggle';
import { useRoleSimulation } from '@/contexts/RoleSimulationContext';
import { getRolePermissions } from '@/lib/permissions';
import { useUnreadChangelog } from '@/hooks/useUnreadChangelog';
import logo from '@/assets/logo-tt.svg';

type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | 'external';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  account: 'Account',
  finance: 'Finance',
  team_leader: 'Team Leader',
  coordinator: 'Coordinator',
  member: 'Member',
  external: 'External',
};

const AVAILABLE_ROLES: UserRole[] = ['admin', 'account', 'finance', 'team_leader', 'coordinator', 'member', 'external'];

interface AppHeaderProps {
  onLogout: () => void;
  userProfile: { first_name: string; last_name: string; avatar_url?: string } | null;
  userRole: 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | 'external' | null;
  onStartTour?: () => void;
}

export const AppHeader = ({ onLogout, userProfile, userRole, onStartTour }: AppHeaderProps) => {
  const { getEffectiveRole, simulatedRole, isSimulating, startSimulation, stopSimulation } = useRoleSimulation();
  const effectiveRole = getEffectiveRole(userRole);
  const isRealAdmin = userRole === 'admin';
  const { data: unreadChangelog } = useUnreadChangelog();
  const unreadCount = unreadChangelog?.count ?? 0;
  
  const permissions = getRolePermissions(effectiveRole);
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'account';
  const canViewProjects = effectiveRole !== null;
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isActivePath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);
  const financePaths = ['/sales', '/offers', '/tenders', '/invoices', '/subscriptions', '/staff-cost'];
  const isFinanceActive = financePaths.some(isActivePath);
  const canViewFinanceMenu = isAdmin || effectiveRole === 'finance';
  const canViewStaffCost = effectiveRole === 'admin' || effectiveRole === 'finance';



  // Debug log - remove after fixing
  console.log('[AppHeader] Debug permissions:', { userRole, effectiveRole, canEditBudget: permissions.canEditBudget, permissions });

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const mobileNavigate = (path: string) => {
    closeMobileMenu();
    navigate(path);
  };
  
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
          
          {/* Navigation Links - Desktop */}
          <nav className="hidden lg:flex items-center gap-4">
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
            {permissions.canEditBudget && (
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
            {effectiveRole !== 'external' && (
              <NavLink
                to="/workflows"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`
                }
              >
                <GitBranch className="h-4 w-4" />
                Flussi
              </NavLink>
            )}
            {canViewFinanceMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isFinanceActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Wallet className="h-4 w-4" />
                    Finanza
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {(isAdmin || effectiveRole === 'finance') && (
                    <DropdownMenuItem
                      onClick={() => navigate('/sales')}
                      className={`cursor-pointer ${isActivePath('/sales') ? 'bg-accent' : ''}`}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Cruscotto
                    </DropdownMenuItem>
                  )}
                  {canViewFinanceMenu && (
                    <DropdownMenuItem
                      onClick={() => navigate('/offers')}
                      className={`cursor-pointer ${isActivePath('/offers') ? 'bg-accent' : ''}`}
                    >
                      <FileSignature className="h-4 w-4 mr-2" />
                      Offerte
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => navigate('/tenders')}
                      className={`cursor-pointer ${isActivePath('/tenders') ? 'bg-accent' : ''}`}
                    >
                      <Gavel className="h-4 w-4 mr-2" />
                      Gare
                    </DropdownMenuItem>
                  )}
                  {(isAdmin || effectiveRole === 'finance') && (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate('/invoices')}
                        className={`cursor-pointer ${isActivePath('/invoices') ? 'bg-accent' : ''}`}
                      >
                        <Receipt className="h-4 w-4 mr-2" />
                        Fatture
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate('/subscriptions')}
                        className={`cursor-pointer ${isActivePath('/subscriptions') ? 'bg-accent' : ''}`}
                      >
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Abbonamenti
                      </DropdownMenuItem>
                    </>
                  )}
                  {canViewStaffCost && (
                    <DropdownMenuItem
                      onClick={() => navigate('/staff-cost')}
                      className={`cursor-pointer ${isActivePath('/staff-cost') ? 'bg-accent' : ''}`}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Costo personale
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>

              </DropdownMenu>
            )}
          </nav>

          {/* Mobile menu trigger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Apri menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <img src={logo} alt="Logo" className="h-6 w-6" />
                  TimeTrap
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col p-2">
                <SheetClose asChild>
                  <NavLink
                    to="/calendar"
                    onClick={closeMobileMenu}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`
                    }
                  >
                    <Calendar className="h-4 w-4" />
                    Calendario
                  </NavLink>
                </SheetClose>
                {canViewProjects && (
                  <SheetClose asChild>
                    <NavLink
                      to="/approved-projects"
                      onClick={closeMobileMenu}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Progetti
                    </NavLink>
                  </SheetClose>
                )}
                {permissions.canEditBudget && (
                  <SheetClose asChild>
                    <NavLink
                      to="/budgets"
                      onClick={closeMobileMenu}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`
                      }
                    >
                      <FolderKanban className="h-4 w-4" />
                      Budget
                    </NavLink>
                  </SheetClose>
                )}
                {effectiveRole !== 'external' && (
                  <SheetClose asChild>
                    <NavLink
                      to="/workflows"
                      onClick={closeMobileMenu}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`
                      }
                    >
                      <GitBranch className="h-4 w-4" />
                      Flussi
                    </NavLink>
                  </SheetClose>
                )}
                {canViewFinanceMenu && (
                  <div className="flex flex-col">
                    <div className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium ${isFinanceActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                      <Wallet className="h-4 w-4" />
                      Finanza
                    </div>
                    <div className="flex flex-col pl-4 border-l border-border ml-5">
                      {(isAdmin || effectiveRole === 'finance') && (
                        <SheetClose asChild>
                          <button
                            onClick={() => mobileNavigate('/sales')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left transition-colors ${
                              isActivePath('/sales')
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                          >
                            <TrendingUp className="h-4 w-4" />
                            Cruscotto
                          </button>
                        </SheetClose>
                      )}
                      {canViewFinanceMenu && (
                        <SheetClose asChild>
                          <button
                            onClick={() => mobileNavigate('/offers')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left transition-colors ${
                              isActivePath('/offers')
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                          >
                            <FileSignature className="h-4 w-4" />
                            Offerte
                          </button>
                        </SheetClose>
                      )}
                      {isAdmin && (
                        <SheetClose asChild>
                          <button
                            onClick={() => mobileNavigate('/tenders')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left transition-colors ${
                              isActivePath('/tenders')
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                          >
                            <Gavel className="h-4 w-4" />
                            Gare
                          </button>
                        </SheetClose>
                      )}
                      {(isAdmin || effectiveRole === 'finance') && (
                        <>
                          <SheetClose asChild>
                            <button
                              onClick={() => mobileNavigate('/invoices')}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left transition-colors ${
                                isActivePath('/invoices')
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                              }`}
                            >
                              <Receipt className="h-4 w-4" />
                              Fatture
                            </button>
                          </SheetClose>
                          <SheetClose asChild>
                            <button
                              onClick={() => mobileNavigate('/subscriptions')}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left transition-colors ${
                                isActivePath('/subscriptions')
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                              }`}
                            >
                              <RefreshCcw className="h-4 w-4" />
                              Abbonamenti
                            </button>
                          </SheetClose>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>

        </div>

        {/* Right: User Profile & Logout */}
        <div className="flex items-center gap-2">
          {/* Simulation Badge */}
          {isSimulating && (
            <Badge 
              variant="outline" 
              className="bg-warning/10 text-warning border-warning/30 animate-pulse"
            >
              <Eye className="h-3 w-3 mr-1" />
              {ROLE_LABELS[simulatedRole as UserRole]}
            </Badge>
          )}
          
          {effectiveRole && effectiveRole !== 'external' && (
            <QuickTaskButton className="hidden sm:inline-flex" />
          )}
          <ThemeToggle />

          <div data-tour="notifications">
            <NotificationBell />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative flex items-center gap-2" data-tour="profile-menu">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userProfile?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {userProfile?.first_name} {userProfile?.last_name}
                </span>
                {unreadCount > 0 && (
                  <span
                    className="absolute top-1 left-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background"
                    aria-label={`${unreadCount} novità non lette`}
                  />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <NavLink to="/profile" className="cursor-pointer">
                  Profilo
                </NavLink>
              </DropdownMenuItem>
              
              {/* Role Simulation - Only for real admins */}
              {isRealAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <UserCog className="h-4 w-4 mr-2" />
                      Simula ruolo
                      {isSimulating && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Attivo
                        </Badge>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      <DropdownMenuLabel>Visualizza come</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {AVAILABLE_ROLES.map((role) => (
                        <DropdownMenuItem
                          key={role}
                          onClick={() => startSimulation(role)}
                          className={`cursor-pointer ${simulatedRole === role ? 'bg-accent' : ''}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {ROLE_LABELS[role]}
                          {simulatedRole === role && (
                            <span className="ml-auto text-xs text-muted-foreground">✓</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                      {isSimulating && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={stopSimulation}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <EyeOff className="h-4 w-4 mr-2" />
                            Termina simulazione
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              
              {onStartTour && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onStartTour} className="cursor-pointer">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Guida interattiva
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to="/connect" className="cursor-pointer">
                  <Plug className="h-4 w-4 mr-2" />
                  Collega assistente AI
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavLink to="/help" className="cursor-pointer">
                  <BookOpen className="h-4 w-4 mr-2" />
                  <span className="flex-1">Guida e Aiuto</span>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </NavLink>
              </DropdownMenuItem>
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
