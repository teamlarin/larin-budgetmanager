import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProductServiceCategories = () => {
  return useQuery({
    queryKey: ["product-service-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_service_categories")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
};
