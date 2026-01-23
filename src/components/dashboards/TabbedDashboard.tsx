import { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MemberDashboard } from './MemberDashboard';

interface MemberDashboardProps {
  stats: {
    todayPlannedHours: number;
    todayConfirmedHours: number;
    weekPlannedHours: number;
    weekConfirmedHours: number;
    weeklyContractHours: number;
    assignedProjects: number;
    pendingActivities: number;
    billableHours: number;
    totalHours: number;
    actualProductivity: number;
    targetProductivity: number;
  };
  todayActivities: any[];
  upcomingActivities: any[];
  weeklyHoursByProject: any[];
  confirmedHoursByCategory: any[];
  productivityTrend?: any[];
  monthlyHoursTrend?: any[];
  weeklyCalendar?: any[];
  weekOffset?: number;
  onWeekChange?: (offset: number) => void;
  weekDateRange?: string;
  leaderProjects?: any[];
  userName?: string;
  onLeaderProjectProgressUpdate?: (projectId: string, newProgress: number) => void;
}

interface RoleTab {
  label: string;
  value: string;
  content: ReactNode;
}

interface TabbedDashboardProps {
  memberData: MemberDashboardProps;
  roleSpecificContent?: ReactNode;
  roleSpecificTabLabel?: string;
  roleTabs?: RoleTab[];
}

export const TabbedDashboard = ({
  memberData,
  roleSpecificContent,
  roleSpecificTabLabel,
  roleTabs
}: TabbedDashboardProps) => {
  // Determine tabs to render
  const hasMultipleTabs = roleTabs && roleTabs.length > 0;
  const totalTabs = hasMultipleTabs ? 1 + roleTabs.length : 2;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ciao{memberData.userName ? ` ${memberData.userName}` : ''}</h1>
        <p className="text-muted-foreground mt-1">La tua dashboard personale</p>
      </div>

      <Tabs defaultValue="recap" className="space-y-6">
        <TabsList className={`grid w-full max-w-md ${totalTabs === 2 ? 'grid-cols-2' : totalTabs === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
          <TabsTrigger value="recap">Il mio Recap</TabsTrigger>
          {hasMultipleTabs ? (
            roleTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))
          ) : (
            <TabsTrigger value="role">{roleSpecificTabLabel}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="recap" className="space-y-6">
          <MemberDashboard {...memberData} hideHeader />
        </TabsContent>

        {hasMultipleTabs ? (
          roleTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-6">
              {tab.content}
            </TabsContent>
          ))
        ) : (
          <TabsContent value="role" className="space-y-6">
            {roleSpecificContent}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
