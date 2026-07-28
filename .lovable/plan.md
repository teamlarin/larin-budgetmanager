# Piano: migliorare l'analisi dati del chatbot in-app con Gemini Pro

## Obiettivo
Sostituire il modello attuale del chatbot TimeTrap AI (`google/gemini-3-flash-preview`) con `google/gemini-3.1-pro-preview` per ottenere risposte più accurate sulle analisi dati (ore, progetti, margini, budget).

## Nota su Claude
Claude (Anthropic) non è disponibile nel catalogo modelli del Lovable AI Gateway, che supporta solo modelli OpenAI e Google. Per questo motivo il piano usa il modello Gemini più potente per l'analisi.

## File interessati
- `supabase/functions/ai-agent/index.ts` — Edge Function che chiama il gateway AI
- `src/components/AiChatWidget.tsx` — widget chat in-app (parser SSE, UI)

## Implementazione

1. **Aggiornare il modello nella Edge Function**
   - Sostituire `model: "google/gemini-3-flash-preview"` con `model: "google/gemini-3.1-pro-preview"` in entrambe le chiamate a `/v1/chat/completions` (pianificazione query e risposta finale).

2. **(Opzionale) Abilitare il reasoning per trasparenza**
   - Aggiungere il campo `reasoning` nel body della richiesta (formato OpenRouter) per far mostrare al modello il "ragionamento" prima della risposta.
   - Se abilitato, aggiornare il parser SSE in `AiChatWidget.tsx` per gestire eventuali delta di reasoning e renderizzarli sopra la risposta finale.

3. **Mantenere la logica esistente**
   - Schema SQL e knowledge base già presenti in `ai-agent/index.ts` restano invariati.
   - Validazione read-only (`SELECT`/`WITH`) e autenticazione utente restano invariate.

4. **Gestione errori gateway**
   - Verificare che la funzione gestisca correttamente 402 (crediti esauriti), 429 (rate limit) e 400 (schema/modello non valido).

5. **Verifica chiave AI**
   - Controllare che `LOVABLE_API_KEY` sia configurato; se mancante, provvedere alla creazione.

6. **Test**
   - Eseguire test con query di analisi dati, ad esempio:
     - "Quali progetti sono a rischio?"
     - "Quante ore confermate ha Francesco Ferrari questo mese?"
     - "Mostrami il margine del progetto X"
   - Verificare che lo streaming funzioni e che il formato della risposta rimanga compatibile con il parser esistente.

## Alternative considerata
- `google/gemini-3.6-flash` per query più veloci e leggere; scartata perché l'obiettivo è la qualità dell'analisi.

## Stima impatto
- Modifica concentrata in un'unica Edge Function.
- Nessuna modifica al database o alle policy RLS.
- Frontend coinvolto solo se si decide di abilitare il reasoning.