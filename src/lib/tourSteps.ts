import { TourStep } from '@/components/InteractiveTour';
import { 
  Calendar, 
  FolderKanban, 
  FileText, 
  CheckCircle2, 
  Settings, 
  Bell, 
  User,
  LayoutDashboard,
  Clock,
  Users
} from 'lucide-react';
import React from 'react';

type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member';

// Helper to create icon element
const createIcon = (Icon: any) => React.createElement(Icon, { className: 'h-5 w-5 text-primary' });

// Welcome step shared by all roles
const welcomeStep: TourStep = {
  title: 'Benvenuto in TimeTrap!',
  description: 'Questa guida ti mostrerà le principali funzionalità dell\'applicazione in base al tuo ruolo. Segui i passaggi per scoprire tutte le potenzialità a tua disposizione.',
  position: 'center',
};

// Common steps
const calendarStep: TourStep = {
  target: 'nav a[href="/calendar"]',
  title: 'Calendario',
  description: 'Il calendario è il cuore di TimeTrap. Qui puoi visualizzare e gestire le tue attività pianificate, tracciare il tempo lavorato e organizzare la tua settimana.',
  position: 'bottom',
  icon: createIcon(Calendar),
};

const notificationsStep: TourStep = {
  target: '[data-tour="notifications"]',
  title: 'Notifiche',
  description: 'Qui troverai tutte le notifiche importanti: promemoria scadenze, aggiornamenti sui progetti e altre comunicazioni del team.',
  position: 'bottom',
  icon: createIcon(Bell),
};

const profileStep: TourStep = {
  target: '[data-tour="profile-menu"]',
  title: 'Menu Profilo',
  description: 'Dal menu profilo puoi accedere alle tue impostazioni personali, visualizzare il tuo profilo e ripetere questa guida quando vuoi.',
  position: 'bottom',
  icon: createIcon(User),
};

const dashboardStep: TourStep = {
  target: '[data-tour="dashboard"]',
  title: 'Dashboard',
  description: 'La dashboard ti offre una panoramica completa: le tue attività in programma, i progetti a cui partecipi e le statistiche del tuo lavoro.',
  position: 'bottom',
  icon: createIcon(LayoutDashboard),
};

// Admin specific steps
const adminTourSteps: TourStep[] = [
  welcomeStep,
  dashboardStep,
  calendarStep,
  {
    target: 'nav a[href="/budgets"]',
    title: 'Gestione Budget',
    description: 'Come admin, hai accesso completo alla gestione dei budget. Puoi creare, modificare e approvare budget per tutti i progetti.',
    position: 'bottom',
    icon: createIcon(FolderKanban),
  },
  {
    target: 'nav a[href="/quotes"]',
    title: 'Preventivi',
    description: 'Gestisci tutti i preventivi: creane di nuovi, modifica quelli esistenti e genera PDF professionali per i clienti.',
    position: 'bottom',
    icon: createIcon(FileText),
  },
  {
    target: 'nav a[href="/approved-projects"]',
    title: 'Progetti Approvati',
    description: 'Visualizza tutti i progetti approvati, monitora il loro avanzamento e accedi ai dettagli di ciascuno.',
    position: 'bottom',
    icon: createIcon(CheckCircle2),
  },
  notificationsStep,
  {
    target: '[data-tour="settings-button"]',
    title: 'Impostazioni',
    description: 'Accedi alle impostazioni per gestire utenti, clienti, prodotti, servizi, livelli tariffari e molto altro.',
    position: 'left',
    icon: createIcon(Settings),
  },
  profileStep,
  {
    title: 'Pronto a iniziare!',
    description: 'Hai completato la guida introduttiva. Come admin, hai accesso completo a tutte le funzionalità di TimeTrap. Buon lavoro!',
    position: 'center',
  },
];

// Account specific steps
const accountTourSteps: TourStep[] = [
  welcomeStep,
  dashboardStep,
  calendarStep,
  {
    target: 'nav a[href="/budgets"]',
    title: 'Gestione Budget',
    description: 'Come Account, puoi creare e gestire i budget dei progetti. Questa è la tua area principale per la pianificazione delle risorse.',
    position: 'bottom',
    icon: createIcon(FolderKanban),
  },
  {
    target: 'nav a[href="/quotes"]',
    title: 'Preventivi',
    description: 'Crea preventivi professionali per i clienti, gestisci le revisioni e genera documenti PDF.',
    position: 'bottom',
    icon: createIcon(FileText),
  },
  {
    target: 'nav a[href="/approved-projects"]',
    title: 'Progetti',
    description: 'Monitora tutti i progetti attivi, verifica l\'avanzamento e gestisci il team assegnato.',
    position: 'bottom',
    icon: createIcon(CheckCircle2),
  },
  notificationsStep,
  profileStep,
  {
    title: 'Pronto a iniziare!',
    description: 'Hai completato la guida. Come Account, sei il punto di riferimento per la gestione dei progetti e dei clienti. Buon lavoro!',
    position: 'center',
  },
];

// Finance specific steps
const financeTourSteps: TourStep[] = [
  welcomeStep,
  dashboardStep,
  calendarStep,
  {
    target: 'nav a[href="/approved-projects"]',
    title: 'Progetti',
    description: 'Visualizza tutti i progetti per monitorare i costi, i margini e lo stato di fatturazione.',
    position: 'bottom',
    icon: createIcon(CheckCircle2),
  },
  notificationsStep,
  profileStep,
  {
    title: 'Pronto a iniziare!',
    description: 'Hai completato la guida. Come Finance, il tuo focus è sul monitoraggio finanziario dei progetti. Buon lavoro!',
    position: 'center',
  },
];

// Team Leader specific steps
const teamLeaderTourSteps: TourStep[] = [
  welcomeStep,
  dashboardStep,
  calendarStep,
  {
    target: 'nav a[href="/approved-projects"]',
    title: 'Progetti del Team',
    description: 'Monitora i progetti del tuo team, verifica l\'avanzamento delle attività e gestisci le risorse assegnate.',
    position: 'bottom',
    icon: createIcon(CheckCircle2),
  },
  {
    title: 'Gestione Team',
    description: 'Come Team Leader, puoi assegnare attività ai membri del team, monitorare le ore lavorate e garantire il rispetto delle scadenze.',
    position: 'center',
    icon: createIcon(Users),
  },
  notificationsStep,
  profileStep,
  {
    title: 'Pronto a iniziare!',
    description: 'Hai completato la guida. Come Team Leader, sei responsabile del successo del tuo team. Buon lavoro!',
    position: 'center',
  },
];

// Coordinator specific steps
const coordinatorTourSteps: TourStep[] = [
  welcomeStep,
  dashboardStep,
  calendarStep,
  {
    target: 'nav a[href="/approved-projects"]',
    title: 'Progetti',
    description: 'Visualizza i progetti a cui sei assegnato e monitora l\'avanzamento delle attività.',
    position: 'bottom',
    icon: createIcon(CheckCircle2),
  },
  {
    title: 'Coordinamento Attività',
    description: 'Come Coordinator, puoi modificare le attività dei progetti e supportare il team nel raggiungimento degli obiettivi.',
    position: 'center',
    icon: createIcon(Clock),
  },
  notificationsStep,
  profileStep,
  {
    title: 'Pronto a iniziare!',
    description: 'Hai completato la guida. Come Coordinator, il tuo contributo è fondamentale per il successo dei progetti. Buon lavoro!',
    position: 'center',
  },
];

// Member specific steps
const memberTourSteps: TourStep[] = [
  welcomeStep,
  dashboardStep,
  calendarStep,
  {
    title: 'Tracciamento Ore',
    description: 'Usa il calendario per registrare le ore lavorate sulle attività a te assegnate. Puoi aggiungere note e dettagli per ogni sessione.',
    position: 'center',
    icon: createIcon(Clock),
  },
  {
    target: 'nav a[href="/approved-projects"]',
    title: 'I Tuoi Progetti',
    description: 'Qui trovi i progetti a cui sei assegnato. Puoi vedere le attività da completare e il tuo avanzamento.',
    position: 'bottom',
    icon: createIcon(CheckCircle2),
  },
  notificationsStep,
  profileStep,
  {
    title: 'Pronto a iniziare!',
    description: 'Hai completato la guida. Ricorda di tracciare le tue ore regolarmente per mantenere aggiornato il progresso dei progetti. Buon lavoro!',
    position: 'center',
  },
];

export const getTourStepsForRole = (role: UserRole | null): TourStep[] => {
  switch (role) {
    case 'admin':
      return adminTourSteps;
    case 'account':
      return accountTourSteps;
    case 'finance':
      return financeTourSteps;
    case 'team_leader':
      return teamLeaderTourSteps;
    case 'coordinator':
      return coordinatorTourSteps;
    case 'member':
      return memberTourSteps;
    default:
      return memberTourSteps;
  }
};

export const getTourId = (role: UserRole | null): string => {
  return `tour_${role || 'member'}_v1`;
};