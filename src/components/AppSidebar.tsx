import { NavLink } from 'react-router-dom';
import { Home, FolderOpen, Settings, User } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface AppSidebarProps {
  userProfile: { first_name: string; last_name: string; avatar_url?: string } | null;
  isAdmin: boolean;
}

export const AppSidebar = ({ userProfile, isAdmin }: AppSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const getInitials = () => {
    if (!userProfile) return 'U';
    const firstInitial = userProfile.first_name?.charAt(0) || '';
    const lastInitial = userProfile.last_name?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  };

  const menuItems = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'I Miei Budget', icon: FolderOpen, path: '/projects?view=mine' },
    { label: 'Tutti i Budget', icon: FolderOpen, path: '/projects?view=all' },
  ];

  const bottomItems = [
    ...(isAdmin ? [{ label: 'Impostazioni', icon: Settings, path: '/settings' }] : []),
    { label: 'Profilo', icon: User, path: '/profile' },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        isActive ? 'bg-secondary' : ''
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Separator className="mb-2" />
        <SidebarMenu>
          {bottomItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton asChild tooltip={item.label}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    isActive ? 'bg-secondary' : ''
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src={userProfile?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {userProfile?.first_name} {userProfile?.last_name}
                  </span>
                </div>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
