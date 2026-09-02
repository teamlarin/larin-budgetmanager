import { ReactNode, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { MemberDashboard } from './MemberDashboard';
import { WeeklyFocusView } from './WeeklyFocusView';


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
    monthPlannedHours: number;
    monthConfirmedHours: number;
    monthlyContractHours: number;
    monthlyBillableProductivity: number;
    monthlyBillableHours: number;
    monthlyTotalHours: number;
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
  memberProjects?: any[];
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
  userId?: string | null;
  showWeeklyFocus?: boolean;
}

export const TabbedDashboard = ({
  memberData,
  roleSpecificContent,
  roleSpecificTabLabel,
  roleTabs,
  userId,
  showWeeklyFocus = true,
}: TabbedDashboardProps) => {
  const enableFocus = showWeeklyFocus && !!userId;
  const [activeTab, setActiveTab] = useState('settimana');

  // Determine tabs to render
  const hasMultipleTabs = roleTabs && roleTabs.length > 0;
  const hasSingleRoleTab = !hasMultipleTabs && !!roleSpecificContent;
  const roleTabsCount = hasMultipleTabs ? roleTabs.length : (hasSingleRoleTab ? 1 : 0);
  const totalTabs = 1 + roleTabsCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ciao{memberData.userName ? ` ${memberData.userName}` : ''}</h1>
        <p className="text-muted-foreground mt-1">La tua dashboard personale</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${totalTabs <= 4 ? 'max-w-md' : totalTabs === 5 ? 'max-w-2xl' : 'max-w-3xl'} ${totalTabs === 2 ? 'grid-cols-2' : totalTabs === 3 ? 'grid-cols-3' : totalTabs === 4 ? 'grid-cols-4' : totalTabs === 5 ? 'grid-cols-5' : 'grid-cols-6'}`}>
          <TabsTrigger value="settimana">La mia settimana</TabsTrigger>
          {hasMultipleTabs ? (
            roleTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))
          ) : hasSingleRoleTab ? (
            <TabsTrigger value="role">{roleSpecificTabLabel}</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="settimana" className="space-y-8">
          {enableFocus && (
            <WeeklyFocusView
              userId={userId!}
              userName={memberData.userName}
              capacity={{
                weekPlannedHours: memberData.stats.weekPlannedHours,
                weekConfirmedHours: memberData.stats.weekConfirmedHours,
                weeklyContractHours: memberData.stats.weeklyContractHours,
              }}
            />
          )}

          <Accordion type="single" collapsible className="border-t pt-2">
            <AccordionItem value="andamento" className="border-b-0">
              <AccordionTrigger className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Andamento
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <MemberDashboard {...memberData} hideHeader userId={userId} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {hasMultipleTabs ? (
          roleTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-6">
              {tab.content}
            </TabsContent>
          ))
        ) : hasSingleRoleTab ? (
          <TabsContent value="role" className="space-y-6">
            {roleSpecificContent}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
};

