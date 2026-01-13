import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Folder, ChevronRight, HardDrive, FileText, Loader2, Search, X } from "lucide-react";

interface DriveFilePickerProps {
  onSelect?: (file: { id: string; name: string; url: string }) => void;
  onFileSelected?: (fileUrl: string) => void;
  trigger?: React.ReactNode;
  initialFolderId?: string | null;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
  triggerSize?: "default" | "sm" | "lg" | "icon";
  triggerIcon?: React.ReactNode;
  currentBriefLink?: string | null;
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

export const DriveFilePicker = ({ 
  onSelect, 
  onFileSelected,
  trigger, 
  initialFolderId,
  triggerLabel = "Seleziona da Drive",
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerIcon
}: DriveFilePickerProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<SharedDrive | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [startedFromFolder, setStartedFromFolder] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

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

  const fetchItemsFromFolder = async (folderId: string, search?: string) => {
    setLoading(true);
    try {
      // First get folder info to set breadcrumb
      const { data: folderData, error: folderError } = await supabase.functions.invoke("google-drive-folders", {
        body: { action: "get-folder-info", folderId },
      });

      if (folderError) throw folderError;

      // Set the folder as starting point
      setBreadcrumbs([{ id: folderId, name: folderData.folder?.name || "Cartella progetto" }]);
      setStartedFromFolder(true);

      // Fetch files in the folder (without driveId, just use folderId)
      const { data, error } = await supabase.functions.invoke("google-drive-folders", {
        body: { action: "list-files", folderId, searchQuery: search },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setItems(data.files || []);
      setNextPageToken(data.nextPageToken || null);
      // Set a dummy drive to show the file list view
      setSelectedDrive({ id: "from-folder", name: "Cartella progetto" });
    } catch (err: any) {
      console.error("Error fetching items from folder:", err);
      // Fallback to shared drives list
      fetchSharedDrives();
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (driveId: string, folderId?: string, search?: string, append?: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-folders", {
        body: { 
          action: "list-files", 
          driveId: driveId === "from-folder" ? undefined : driveId, 
          folderId,
          searchQuery: search,
          pageToken: append ? nextPageToken : undefined
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (append) {
        setItems(prev => [...prev, ...(data.files || [])]);
      } else {
        setItems(data.files || []);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (err: any) {
      console.error("Error fetching items:", err);
      toast({ title: "Errore", description: err.message || "Impossibile caricare i file", variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (open) {
      setNeedsReauth(false);
      setStartedFromFolder(false);
      setSearchQuery("");
      setNextPageToken(null);
      
      if (initialFolderId) {
        // Start from the client/project folder
        fetchItemsFromFolder(initialFolderId);
      } else {
        // Start from shared drives list
        fetchSharedDrives();
        setSelectedDrive(null);
        setBreadcrumbs([]);
        setItems([]);
      }
    }
  }, [open, initialFolderId]);

  // Debounced search
  useEffect(() => {
    if (!selectedDrive) return;
    
    const timer = setTimeout(() => {
      if (startedFromFolder && initialFolderId) {
        fetchItemsFromFolder(initialFolderId, searchQuery);
      } else {
        const currentFolderId = breadcrumbs.length > 1 
          ? breadcrumbs[breadcrumbs.length - 1].id 
          : undefined;
        fetchItems(selectedDrive.id, currentFolderId, searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLoadMore = () => {
    if (!nextPageToken || loadingMore || !selectedDrive) return;
    
    const currentFolderId = breadcrumbs.length > 1 
      ? breadcrumbs[breadcrumbs.length - 1].id 
      : undefined;
    fetchItems(selectedDrive.id, currentFolderId, searchQuery, true);
  };

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
    
    if (index === 0 && !startedFromFolder) {
      fetchItems(selectedDrive!.id);
    } else {
      fetchItems(selectedDrive!.id, newBreadcrumbs[newBreadcrumbs.length - 1].id);
    }
  };

  const handleSelectFile = (item: DriveItem) => {
    const url = item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`;
    if (onSelect) {
      onSelect({ id: item.id, name: item.name, url });
    }
    if (onFileSelected) {
      onFileSelected(url);
    }
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

  const handleBackToDrives = () => {
    setSelectedDrive(null);
    setStartedFromFolder(false);
    setBreadcrumbs([]);
    setItems([]);
    fetchSharedDrives();
  };

  const isFolder = (item: DriveItem) => item.mimeType === "application/vnd.google-apps.folder";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={triggerVariant} size={triggerSize} className="gap-2">
            {triggerIcon || <Folder className="h-4 w-4" />}
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Seleziona file da Drive</DialogTitle>
          <DialogDescription>
            {initialFolderId 
              ? "Seleziona un file dalla cartella del progetto o naviga in altri Drive" 
              : "Naviga nei Drive condivisi e seleziona un file o una cartella"}
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
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

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
                    {searchQuery ? "Nessun risultato trovato" : "Nessun file trovato"}
                  </p>
                ) : (
                  <>
                    {items.map((item) => (
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
                          <span className="truncate">{item.name}</span>
                          {isFolder(item) && <ChevronRight className="h-4 w-4 ml-auto flex-shrink-0" />}
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
                    ))}
                    {nextPageToken && (
                      <Button
                        variant="ghost"
                        className="w-full mt-2"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Carica altri..."
                        )}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{items.length} elementi</span>
              <Button variant="outline" size="sm" onClick={handleBackToDrives}>
                ← Sfoglia altri Drive
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
