import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductServiceSubcategory {
  id: string;
  name: string;
  category_id: string;
}

export interface ProductServiceCategory {
  id: string;
  name: string;
  subcategories: ProductServiceSubcategory[];
}

export const useProductServiceCategories = () => {
  return useQuery({
    queryKey: ["product-service-categories"],
    queryFn: async () => {
      const [catRes, subRes] = await Promise.all([
        supabase
          .from("product_service_categories")
          .select("id, name")
          .order("name", { ascending: true }),
        supabase
          .from("product_service_subcategories")
          .select("id, name, category_id")
          .order("name", { ascending: true }),
      ]);
      if (catRes.error) throw catRes.error;
      if (subRes.error) throw subRes.error;

      const subs = (subRes.data ?? []) as ProductServiceSubcategory[];
      return (catRes.data ?? []).map((cat) => ({
        ...cat,
        subcategories: subs.filter((s) => s.category_id === cat.id),
      })) as ProductServiceCategory[];
    },
  });
};
