import { useProductServiceCategories } from "@/hooks/useProductServiceCategories";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const CategorySelect = ({ value, onChange }: CategorySelectProps) => {
  const { data: categories = [] } = useProductServiceCategories();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Seleziona categoria" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((cat) =>
          cat.subcategories.length > 0 ? (
            <SelectGroup key={cat.id}>
              <SelectLabel>{cat.name}</SelectLabel>
              {cat.subcategories.map((sub) => (
                <SelectItem key={sub.id} value={`${cat.name} > ${sub.name}`}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            <SelectItem key={cat.id} value={cat.name}>
              {cat.name}
            </SelectItem>
          )
        )}
      </SelectContent>
    </Select>
  );
};
