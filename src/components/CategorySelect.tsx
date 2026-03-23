import { useProductServiceCategories } from "@/hooks/useProductServiceCategories";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.name}>
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
