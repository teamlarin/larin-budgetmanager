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
import { ScrollArea } from '@/components/ui/scroll-area';

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
  ];

  return (
    <Sidebar collapsible="icon" className="flex flex-col h-screen">
      <ScrollArea className="flex-1">
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
      </ScrollArea>

      <SidebarFooter className="mt-auto border-t">
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
            <SidebarMenuButton asChild tooltip="Profilo" className="h-auto py-2">
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  isActive ? 'bg-secondary' : ''
                }
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={userProfile?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <span className="text-sm font-medium truncate">
                    {userProfile?.first_name} {userProfile?.last_name}
                  </span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
