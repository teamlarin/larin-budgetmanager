import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const AREAS = [
  { value: 'tech', label: 'Tech' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'branding', label: 'Branding' },
  { value: 'sales', label: 'Sales' },
  { value: 'struttura', label: 'Struttura' },
  { value: 'ai', label: 'AI' },
];

interface TeamLeaderAreasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onSave?: () => void;
}

export const TeamLeaderAreasDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
  onSave,
}: TeamLeaderAreasDialogProps) => {
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      loadAreas();
    }
  }, [open, userId]);

  const loadAreas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_leader_areas')
        .select('area')
        .eq('user_id', userId);

      if (error) throw error;
      setSelectedAreas(data?.map(d => d.area) || []);
    } catch (error) {
      console.error('Error loading team leader areas:', error);
      toast({
        title: 'Errore',
        description: 'Errore nel caricamento delle aree.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArea = (area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area)
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing areas for this user
      const { error: deleteError } = await supabase
        .from('team_leader_areas')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Insert new areas
      if (selectedAreas.length > 0) {
        const { error: insertError } = await supabase
          .from('team_leader_areas')
          .insert(
            selectedAreas.map(area => ({
              user_id: userId,
              area,
            }))
          );

        if (insertError) throw insertError;
      }

      toast({
        title: 'Aree aggiornate',
        description: 'Le aree del team leader sono state aggiornate con successo.',
      });

      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving team leader areas:', error);
      toast({
        title: 'Errore',
        description: 'Errore nel salvataggio delle aree.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aree Team Leader</DialogTitle>
          <DialogDescription>
            Seleziona le aree di cui <strong>{userName}</strong> è responsabile come Team Leader.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {AREAS.map(area => (
                <div key={area.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`area-${area.value}`}
                    checked={selectedAreas.includes(area.value)}
                    onCheckedChange={() => handleToggleArea(area.value)}
                  />
                  <Label
                    htmlFor={`area-${area.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {area.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  'Salva'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
