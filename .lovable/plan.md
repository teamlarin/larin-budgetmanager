

# Integrazione Lovable AI in TimeTrap — Piano

## Situazione attuale

TimeTrap ha già un **AiChatWidget** che permette query in linguaggio naturale sul database tramite l'edge function `ai-agent`. L'infrastruttura AI (Lovable AI Gateway, streaming SSE, `execute_readonly_query`) è già funzionante.

## Proposta: AI Insights Panel

Creare un sistema di **suggerimenti proattivi** che analizza i dati e genera consigli azionabili. L'AI non aspetta domande, ma propone insight contestuali.

### Funzionalità proposte

**1. Suggerimenti sulla pianificazione settimanale**
- Analizza le scadenze dei progetti e le attività pianificate per la settimana
- Segnala conflitti di scheduling (sovrapposizioni, ore non allocate)
- Suggerisce priorità basate su deadline imminenti e progress attuale

**2. Ottimizzazione risorse per Team Leader**
- Analizza il carico di lavoro di ogni membro del team
- Suggerisce riallocazioni quando ci sono persone sovraccariche e altre sottoutilizzate
- Considera le competenze (area) per suggerimenti pertinenti

**3. Alert intelligenti su margini e budget**
- Segnala progetti dove le ore confermate superano la proiezione
- Calcola il margine atteso vs reale e avvisa su scostamenti significativi

**4. Riepilogo settimanale AI**
- Sintesi automatica dello stato dei progetti
- Evidenzia rischi, blocchi e milestone raggiunte

**5. Suggerimenti per il completamento attività**
- Basandosi sullo storico, stima durate realistiche per nuove attività
- Suggerisce assignee ottimali considerando expertise e disponibilità

---

### Implementazione tecnica

**Nuova Edge Function: `ai-insights`**
- Riceve il contesto dell'utente (ruolo, progetti assegnati)
- Esegue query predefinite per raccogliere dati rilevanti (scadenze, workload, budget)
- Invia i dati a Lovable AI per generare suggerimenti strutturati (via tool calling)
- Restituisce un array di insight tipizzati

**Nuovo componente: `AiInsightsPanel`**
- Card nella dashboard che mostra i suggerimenti AI
- Caricamento on-demand (pulsante "Genera suggerimenti") per controllare i costi
- Suggerimenti raggruppati per categoria (pianificazione, risorse, budget)
- Ogni suggerimento ha: titolo, descrizione, azione suggerita, priorità

**Integrazione nel chatbot esistente**
- Arricchire il system prompt dell'`ai-agent` con contesto sul ruolo utente
- Aggiungere prompt suggeriti nel widget ("Come ottimizzare il carico del team?", "Quali progetti sono a rischio?")

### Struttura dei file

```text
supabase/functions/ai-insights/index.ts    ← nuova edge function
src/components/AiInsightsPanel.tsx         ← componente dashboard
src/components/AiChatWidget.tsx            ← aggiunta prompt suggeriti
src/components/dashboards/*Dashboard.tsx   ← integrazione panel
```

### Flusso dati

```text
Dashboard → AiInsightsPanel → fetch ai-insights
                                    ↓
                          Query predefinite (workload, scadenze, budget)
                                    ↓
                          Lovable AI (tool calling → structured output)
                                    ↓
                          Array di insight tipizzati → render card
```

### Costi e ottimizzazione
- Insight generati **on-demand** (non automatici) per evitare consumi eccessivi
- Cache dei risultati per 30 minuti (localStorage)
- Uso di `gemini-3-flash-preview` per bilanciare qualità e costo

---

### Ordine di implementazione suggerito

1. **Edge function `ai-insights`** con query predefinite e structured output
2. **Componente `AiInsightsPanel`** nella dashboard
3. **Prompt suggeriti** nel chatbot esistente
4. **Differenziazione per ruolo** (admin vede tutto, team leader vede il suo team, member vede i suoi progetti)

