import { supabase } from "@/integrations/supabase/client";

// Cache per i mapping per evitare query ripetute
let mappingsCache: Record<string, string[]> | null = null;

// Funzione per ottenere i mapping dal database
export const fetchDisciplineMappings = async (): Promise<Record<string, string[]>> => {
  if (mappingsCache) {
    return mappingsCache;
  }

  const { data, error } = await supabase
    .from("discipline_area_mappings")
    .select("discipline, areas");

  if (error) {
    console.error("Error fetching discipline mappings:", error);
    return {};
  }

  const mappings: Record<string, string[]> = {};
  (data || []).forEach((item: any) => {
    mappings[item.discipline] = item.areas || [];
  });

  mappingsCache = mappings;
  return mappings;
};

// Funzione per invalidare la cache (da chiamare dopo modifiche)
export const invalidateMappingsCache = () => {
  mappingsCache = null;
};

// Funzione sincrona per ottenere le aree di una disciplina
export const getDisciplineAreas = (discipline: string): string[] => {
  if (!mappingsCache) {
    // Se la cache non è ancora caricata, restituiamo un array vuoto
    // L'applicazione dovrebbe caricare i mapping all'avvio
    return [];
  }
  return mappingsCache[discipline] || [];
};
