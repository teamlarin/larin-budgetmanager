import { useState } from "react";
import { ExternalLink, Link as LinkIcon, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProjectBriefLinkProps {
  projectId: string;
  briefLink?: string | null;
  onUpdate: () => void;
}

export const ProjectBriefLink = ({ projectId, briefLink, onUpdate }: ProjectBriefLinkProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [link, setLink] = useState(briefLink || "");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ brief_link: link || null })
        .eq("id", projectId);

      if (error) throw error;

      toast({
        title: "Link salvato",
        description: "Il link al brief è stato aggiornato con successo.",
      });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error saving brief link:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del link.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLink(briefLink || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">Brief:</span>
        <Input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://drive.google.com/..."
          className="h-8 text-sm flex-1"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 px-2"
        >
          Salva
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-8 px-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (briefLink) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LinkIcon className="h-4 w-4" />
        <span>Brief:</span>
        <a
          href={briefLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          Visualizza documento
          <ExternalLink className="h-3 w-3" />
        </a>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          className="h-6 px-2"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <LinkIcon className="h-4 w-4" />
      <span>Brief:</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsEditing(true)}
        className="h-7 text-xs"
      >
        Aggiungi link
      </Button>
    </div>
  );
};
