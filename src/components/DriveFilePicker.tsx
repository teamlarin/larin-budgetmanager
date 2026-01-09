import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Folder, ChevronRight, HardDrive, FileText, Loader2 } from "lucide-react";

interface DriveFilePickerProps {
  onSelect: (file: { id: string; name: string; url: string }) => void;
  trigger?: React.ReactNode;
}

interface SharedDrive {
  id: string;
  name: string;
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

export const DriveFilePicker = ({ onSelect, trigger }: DriveFilePickerProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<SharedDrive | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [needsReauth, setNeedsReauth] = useState(false);

  const fetchSharedDrives = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Errore", description: "Non autenticato", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("google-drive-folders", {
        body: { action: "list-shared-drives" },
      });

      if (error) throw error;

      if (data.needsReauth) {
        setNeedsReauth(true);
        return;
      }

      if (data.error) {
        if (data.needsAuth || data.needsReauth) {
          setNeedsReauth(true);
          return;
        }
        throw new Error(data.error);
      }

      setSharedDrives(data.drives || []);
    } catch (err: any) {
      console.error("Error fetching shared drives:", err);
      toast({ title: "Errore", description: err.message || "Impossibile caricare i Drive condivisi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (driveId: string, folderId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-folders", {
        body: { action: "list-files", driveId, folderId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setItems(data.files || []);
    } catch (err: any) {
      console.error("Error fetching items:", err);
      toast({ title: "Errore", description: err.message || "Impossibile caricare i file", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSharedDrives();
      setSelectedDrive(null);
      setBreadcrumbs([]);
      setItems([]);
      setNeedsReauth(false);
    }
  }, [open]);

  const handleDriveSelect = (drive: SharedDrive) => {
    setSelectedDrive(drive);
    setBreadcrumbs([{ id: drive.id, name: drive.name }]);
    fetchItems(drive.id);
  };

  const handleFolderClick = (folder: DriveItem) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    fetchItems(selectedDrive!.id, folder.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    
    if (index === 0) {
      fetchItems(selectedDrive!.id);
    } else {
      fetchItems(selectedDrive!.id, newBreadcrumbs[newBreadcrumbs.length - 1].id);
    }
  };

  const handleSelectFile = (item: DriveItem) => {
    const url = item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`;
    onSelect({ id: item.id, name: item.name, url });
    setOpen(false);
  };

  const handleReauth = async () => {
    try {
      const origin = window.location.origin;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({ title: "Errore", description: "Non autenticato", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "authorize", state: origin + "/settings" },
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err: any) {
      toast({ title: "Errore", description: "Impossibile avviare la riautenticazione", variant: "destructive" });
    }
  };

  const isFolder = (item: DriveItem) => item.mimeType === "application/vnd.google-apps.folder";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Folder className="h-4 w-4" />
            Seleziona da Drive
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Seleziona file da Drive</DialogTitle>
          <DialogDescription>
            Naviga nei Drive condivisi e seleziona un file o una cartella
          </DialogDescription>
        </DialogHeader>

        {needsReauth ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              È necessario riconnettere Google con i permessi per Drive.
            </p>
            <Button onClick={handleReauth}>
              Riconnetti Google
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !selectedDrive ? (
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {sharedDrives.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nessun Drive condiviso trovato
                </p>
              ) : (
                sharedDrives.map((drive) => (
                  <Button
                    key={drive.id}
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={() => handleDriveSelect(drive)}
                  >
                    <HardDrive className="h-4 w-4" />
                    {drive.name}
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          <>
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 text-sm flex-wrap">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.id} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <button
                    className="hover:underline text-primary"
                    onClick={() => handleBreadcrumbClick(index)}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {items.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nessun file trovato
                  </p>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1 justify-start gap-2"
                        onClick={() => isFolder(item) ? handleFolderClick(item) : handleSelectFile(item)}
                      >
                        {isFolder(item) ? (
                          <Folder className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        {item.name}
                        {isFolder(item) && <ChevronRight className="h-4 w-4 ml-auto" />}
                      </Button>
                      {!isFolder(item) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSelectFile(item)}
                        >
                          Seleziona
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <Button variant="outline" onClick={() => setSelectedDrive(null)}>
              ← Torna ai Drive
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
