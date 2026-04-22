export interface SearchEntry {
  id: string; // anchor id in /help
  title: string;
  section: string; // breadcrumb / parent
  keywords: string[];
  snippet: string;
}

export const docSearchIndex: SearchEntry[] = [
  // Novità
  { id: 'novita', title: '🆕 Novità', section: 'Changelog', keywords: ['changelog', 'novità', 'aggiornamenti', 'release', 'rilascio'], snippet: 'Timeline degli ultimi rilasci e aggiornamenti di TimeTrap.' },

  // Quick Start
  { id: 'qs-primo-accesso', title: 'Primo accesso', section: 'Quick Start', keywords: ['login', 'accesso', 'registrazione', 'password', 'approvazione'], snippet: 'Come accedere la prima volta, creare account e attendere approvazione admin.' },
  { id: 'qs-panoramica', title: 'Panoramica interfaccia', section: 'Quick Start', keywords: ['interfaccia', 'menu', 'sidebar', 'dashboard', 'navigazione'], snippet: 'Struttura della sidebar, header e aree principali della piattaforma.' },
  { id: 'qs-primo-budget', title: 'Il primo budget', section: 'Quick Start', keywords: ['budget', 'creare', 'preventivo', 'attività', 'cliente'], snippet: 'Come creare il tuo primo budget partendo da un cliente e disciplina.' },
  { id: 'qs-calendario', title: 'Pianifica nel calendario', section: 'Quick Start', keywords: ['calendario', 'pianificazione', 'attività', 'drag', 'timesheet'], snippet: 'Trascina le attività sul calendario per pianificare le ore.' },

  // Manuale
  { id: 'man-dashboard', title: 'Dashboard', section: 'Manuale', keywords: ['dashboard', 'kpi', 'panoramica', 'widget', 'admin', 'team leader'], snippet: 'Dashboard differenziate per ruolo: Admin, Team Leader, Account, Member.' },
  { id: 'man-budget', title: 'Budget', section: 'Manuale', keywords: ['budget', 'attività', 'data chiusura', 'servizi', 'allocazioni', 'discipline', 'alert', 'soglia', '50', '75', '90'], snippet: 'Gestione budget: creazione, attività, data chiusura attesa, link servizi, alert progressivi 50/75/90/100%.' },
  { id: 'man-preventivi', title: 'Preventivi', section: 'Manuale', keywords: ['preventivi', 'quote', 'simulatore margine', 'multi-budget', 'fatture in cloud', 'fic', 'pdf', 'sconto'], snippet: 'Preventivi multi-budget, simulatore margine bidirezionale 30%, integrazione Fatture in Cloud.' },
  { id: 'man-progetti', title: 'Progetti', section: 'Manuale', keywords: ['progetti', 'project leader', 'team', 'maggiorazioni', 'timesheet', 'target 70%', 'progress', 'canvas'], snippet: 'Gestione progetti: project leader, maggiorazioni timesheet, budget target 70%, progress automatico.' },
  { id: 'man-approved-projects', title: 'Progetti Approvati', section: 'Manuale', keywords: ['approvati', 'criticità', 'semaforo', 'monitor', 'rischio', 'deadline', 'sforamento'], snippet: 'Monitor progetti approvati: alert su >85% budget, <7gg deadline, margine basso.' },
  { id: 'man-calendario', title: 'Calendario e Timesheet', section: 'Manuale', keywords: ['calendario', 'timesheet', 'pubblica', 'multi-utente', 'ricorrenza', 'token'], snippet: 'Pianificazione, timesheet pubblica con token, viste multi-utente, attività ricorrenti.' },
  { id: 'man-workload', title: 'Workload', section: 'Manuale', keywords: ['workload', 'carico', 'team', 'capacità', 'previsionale'], snippet: 'Vista del carico di lavoro del team con previsione capacità.' },
  { id: 'man-workflows', title: 'Workflows', section: 'Manuale', keywords: ['workflow', 'flussi', 'task', 'dipendenze', 'commenti', 'scadenze', 'depends'], snippet: 'Flussi di lavoro v2 con dipendenze tra task, commenti contestuali e scadenze individuali.' },
  { id: 'man-performance', title: 'Performance Reviews', section: 'Manuale', keywords: ['performance', 'review', 'obiettivi', 'bonus', 'note', 'trimestrali', 'leadership', 'sales'], snippet: 'Schede performance: obiettivi annuali, note trimestrali, bonus %, leadership e sales.' },
  { id: 'man-hours-bank', title: 'Banca Ore', section: 'Manuale', keywords: ['banca ore', 'saldo', 'ytd', 'previsionale', 'riporti', 'ferie', 'larin off'], snippet: 'Saldo annuale ore, riporti, dettaglio mensile, calcolo previsionale.' },
  { id: 'man-impostazioni', title: 'Impostazioni', section: 'Manuale', keywords: ['impostazioni', 'utenti', 'livelli', 'aree', 'contratti', 'external', 'slack', 'fic', 'sheet'], snippet: 'Configurazione utenti, contratti dinamici, livelli/aree, External users, Slack, FIC, Google Sheet.' },

  // Ruoli
  { id: 'ruoli-permessi', title: 'Ruoli e Permessi', section: 'Ruoli', keywords: ['ruoli', 'permessi', 'admin', 'account', 'team leader', 'coordinator', 'member', 'external', 'finance'], snippet: 'Matrice ruoli: Admin, Account, Finance, Team Leader, Coordinator, Member, External.' },

  // AI
  { id: 'ai-automazioni', title: 'AI e Automazioni', section: 'AI', keywords: ['ai', 'automazioni', 'insights', 'slack', 'webhook', 'make', 'cron', 'reminder', 'promemoria'], snippet: 'AI Insights, riepilogo settimanale, Slack su 3 scenari, webhook Make, promemoria automatici.' },

  // Best Practices
  { id: 'best-practices', title: 'Best Practices', section: 'Best Practices', keywords: ['best practice', 'consigli', 'workflow', 'organizzazione'], snippet: 'Linee guida per usare TimeTrap in modo efficace.' },

  // FAQ
  { id: 'faq', title: 'FAQ', section: 'FAQ', keywords: ['faq', 'domande', 'risposte', 'banca ore', 'performance', 'simulazione', 'criticità'], snippet: 'Domande frequenti su schede performance, banca ore, notifiche, simulazione ruolo.' },

  // Troubleshooting
  { id: 'troubleshooting', title: 'Troubleshooting', section: 'Supporto', keywords: ['troubleshooting', 'problemi', 'errori', 'notifiche', 'sync', 'progetto non visibile'], snippet: 'Risoluzione problemi: notifiche mancanti, progetti non visibili, sync, banca ore errata.' },
];
