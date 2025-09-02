import { ProjectType } from '@/types/budget';

export const projectTypes: ProjectType[] = [
  {
    id: 'website-creation',
    name: 'Creazione Sito Web',
    activities: [
      {
        id: 'project-management',
        name: 'Project Management',
        category: 'Management',
        estimatedHours: 16,
        description: 'Gestione e coordinamento del progetto'
      },
      {
        id: 'ui-analysis',
        name: 'Analisi e struttura sito: UI Concept',
        category: 'Design',
        estimatedHours: 8,
        description: 'Analisi dei requisiti e definizione della struttura UI'
      },
      {
        id: 'graphic-mockup',
        name: 'Realizzazione bozza grafica',
        category: 'Design',
        estimatedHours: 20,
        description: 'Creazione dei mockup grafici e design del sito'
      },
      {
        id: 'website-development',
        name: 'Sviluppo sito web',
        category: 'Dev',
        estimatedHours: 60,
        description: 'Sviluppo frontend e backend del sito web'
      },
      {
        id: 'content-creation',
        name: 'Creazione contenuti',
        category: 'Content',
        estimatedHours: 12,
        description: 'Redazione testi e ottimizzazione SEO'
      },
      {
        id: 'testing-launch',
        name: 'Testing e lancio',
        category: 'Support',
        estimatedHours: 8,
        description: 'Test finali e messa online del sito'
      }
    ]
  },
  {
    id: 'operational-marketing',
    name: 'Marketing Operativo',
    activities: [
      {
        id: 'marketing-strategy',
        name: 'Strategia marketing',
        category: 'Management',
        estimatedHours: 12,
        description: 'Definizione strategia e obiettivi marketing'
      },
      {
        id: 'campaign-design',
        name: 'Design campagne pubblicitarie',
        category: 'Design',
        estimatedHours: 16,
        description: 'Creazione visual e creative delle campagne'
      },
      {
        id: 'landing-pages',
        name: 'Sviluppo landing pages',
        category: 'Dev',
        estimatedHours: 24,
        description: 'Sviluppo pagine di atterraggio ottimizzate'
      },
      {
        id: 'copywriting',
        name: 'Copywriting e contenuti',
        category: 'Content',
        estimatedHours: 20,
        description: 'Redazione testi persuasivi e contenuti marketing'
      },
      {
        id: 'campaign-management',
        name: 'Gestione campagne',
        category: 'Support',
        estimatedHours: 30,
        description: 'Monitoraggio e ottimizzazione campagne'
      }
    ]
  },
  {
    id: 'social-media-management',
    name: 'Gestione Social Media',
    activities: [
      {
        id: 'social-strategy',
        name: 'Strategia social media',
        category: 'Management',
        estimatedHours: 8,
        description: 'Pianificazione strategia e calendario editoriale'
      },
      {
        id: 'visual-content',
        name: 'Creazione contenuti visual',
        category: 'Design',
        estimatedHours: 24,
        description: 'Design grafiche, video e contenuti visual'
      },
      {
        id: 'content-writing',
        name: 'Redazione post e copy',
        category: 'Content',
        estimatedHours: 16,
        description: 'Scrittura post, didascalie e contenuti testuali'
      },
      {
        id: 'community-management',
        name: 'Community management',
        category: 'Support',
        estimatedHours: 20,
        description: 'Gestione community e interazione con utenti'
      },
      {
        id: 'social-ads',
        name: 'Advertising social',
        category: 'Support',
        estimatedHours: 12,
        description: 'Gestione campagne pubblicitarie sui social'
      }
    ]
  }
];