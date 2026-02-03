import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Folder, ChevronRight, HardDrive, ExternalLink, Unlink, Loader2, Link, Search, X } from "lucide-react";
import { DEFAULT_DRIVE_NAME, DEFAULT_FOLDER_NAME } from "@/lib/driveDefaults";

interface ProjectDriveFolderSelectorProps {
  projectId: string;
  currentFolderId: string | null;
  currentFolderName: string | null;
  clientFolderId?: string | null;
  onFolderLinked: () => void;
}

interface SharedDrive {
  id: string;
  name: string;
}

interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

export const ProjectDriveFolderSelector = ({
  projectId,
  currentFolderId,
  currentFolderName,
  clientFolderId,
  onFolderLinked,
}: ProjectDriveFolderSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<SharedDrive | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [startedFromClient, setStartedFromClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DriveFolder[]>([]);

  const fetchSharedDrives = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Errore", description: "Non autenticato", variant: "destructive" });
        return;
      }

      const response = await supabase.functions.invoke("google-drive-folders", {
        body: { action: "list-shared-drives" },
      });

      const data = response.data;
      const error = response.error;

      // Check data first - even with HTTP errors, data might contain needsAuth flag
      if (data?.needsReauth || data?.needsAuth) {
        setNeedsReauth(true);
        return;
      }

      // Check error message and context for auth issues
      if (error) {
        const errorMessage = error.message || "";
        const errorContext = typeof error.context === "string" ? error.context : JSON.stringify(error.context || "");
        
        if (
          errorMessage.includes("Google account not connected") || 
          errorMessage.includes("needsAuth") ||
          errorContext.includes("needsAuth") ||
          errorContext.includes("Google account not connected") ||
          errorMessage.includes("non-2xx")
        ) {
          // Assume it's an auth issue when we get non-2xx from this function
          setNeedsReauth(true);
          return;
        }
        throw error;
      }

      if (data?.error) {
        if (data.needsAuth || data.needsReauth) {
          setNeedsReauth(true);
          return;
        }
        throw new Error(data.error);
      }

      const drives = data?.drives || [];
      setSharedDrives(drives);

      // Auto-navigate to default drive and folder
      const defaultDrive = drives.find((d: SharedDrive) => d.name === DEFAULT_DRIVE_NAME);
      if (defaultDrive) {
        await navigateToDefaultFolder(defaultDrive);
      }
    } catch (err: any) {
      console.error("Error fetching shared drives:", err);
      // Check if error contains auth-related messages
      const errMsg = err.message || "";
      if (errMsg.includes("non-2xx") || errMsg.includes("Google account")) {
        setNeedsReauth(true);
        return;
      }
      toast({ title: "Errore", description: err.message || "Impossibile caricare i Drive condivisi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const navigateToDefaultFolder = async (drive: SharedDrive) => {
    try {
      setSelectedDrive(drive);
      setBreadcrumbs([{ id: drive.id, name: drive.name }]);
      
      // Fetch folders to find "Clienti"
      const { data, error } = await supabase.functions.invoke("google-drive-folders", {
        body: { action: "list-folders", driveId: drive.id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const allFolders = data.folders || [];
      const clientiFolder = allFolders.find((f: DriveFolder) => f.name === DEFAULT_FOLDER_NAME);

      if (clientiFolder) {
        setBreadcrumbs([
          { id: drive.id, name: drive.name },
          { id: clientiFolder.id, name: clientiFolder.name }
        ]);
        
        // Fetch contents of Clienti folder
        const { data: folderData, error: folderError } = await supabase.functions.invoke("google-drive-folders", {
          body: { action: "list-folders", driveId: drive.id, folderId: clientiFolder.id },
        });

        if (folderError) throw folderError;
        if (folderData.error) throw new Error(folderData.error);

        setFolders(folderData.folders || []);
      } else {
        setFolders(allFolders);
      }
    } catch (err: any) {
      console.error("Error navigating to default folder:", err);
      fetchFolders(drive.id);
    }
  };

  const fetchFolders = async (driveId: string, folderId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-folders", {
        body: { action: "list-folders", driveId, folderId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setFolders(data.folders || []);
    } catch (err: any) {
      console.error("Error fetching folders:", err);
      toast({ title: "Errore", description: err.message || "Impossibile caricare le cartelle", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsFromFolder = async (folderId: string) => {
    setLoading(true);
    try {
      // First get folder info
      const { data: folderInfo, error: folderError } = await supabase.functions.invoke("google-drive-folders", {
        body: { action: "get-folder-info", folderId },
      });

      if (folderError) throw folderError;
      if (folderInfo.error) {
        if (folderInfo.needsReauth) {
          setNeedsReauth(true);
          return;
        }
        throw new Error(folderInfo.error);
      }

      // Set breadcrumbs with folder info
      setBreadcrumbs([{ id: folderId, name: folderInfo.folder?.name || "Cartella" }]);
      setStartedFromClient(true);

      // Fetch subfolders
      const { data, error } = await supabase.functions.invoke("google-drive-folders", {
        body: { action: "list-folders", folderId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setFolders(data.folders || []);
    } catch (err: any) {
      console.error("Error fetching folder items:", err);
      // Fallback to shared drives
      fetchSharedDrives();
    } finally {
      setLoading(false);
    }
  };

  const searchFolders = async (query: string) => {
    if (!query.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-folders", {
        body: { 
          action: "search-folders", 
          driveId: selectedDrive?.id,
          searchQuery: query 
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setSearchResults(data.folders || []);
    } catch (err: any) {
      console.error("Error searching folders:", err);
      toast({ title: "Errore", description: err.message || "Impossibile cercare le cartelle", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Debounced search - require at least 3 characters
  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    
    // Only search if query has at least 3 characters
    if (searchQuery.trim().length < 3) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(() => {
      searchFolders(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, selectedDrive]);

  useEffect(() => {
    if (open) {
      setSelectedDrive(null);
      setBreadcrumbs([]);
      setFolders([]);
      setNeedsReauth(false);
      setStartedFromClient(false);
      setSearchQuery("");
      setIsSearching(false);
      setSearchResults([]);

      // Start from client folder if available
      if (clientFolderId) {
        fetchItemsFromFolder(clientFolderId);
      } else {
        fetchSharedDrives();
      }
    }
  }, [open, clientFolderId]);

  const handleDriveSelect = (drive: SharedDrive) => {
    setSelectedDrive(drive);
    setBreadcrumbs([{ id: drive.id, name: drive.name }]);
    fetchFolders(drive.id);
  };

  const handleFolderClick = (folder: DriveFolder) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    if (selectedDrive) {
      fetchFolders(selectedDrive.id, folder.id);
    } else {
      // Started from client folder
      fetchFolders(folder.id);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    
    if (selectedDrive) {
      if (index === 0) {
        fetchFolders(selectedDrive.id);
      } else {
        fetchFolders(selectedDrive.id, newBreadcrumbs[newBreadcrumbs.length - 1].id);
      }
    } else {
      // Started from client folder
      const folderId = newBreadcrumbs[newBreadcrumbs.length - 1].id;
      fetchFolders(folderId);
    }
  };

  const handleSelectFolder = async (folder: DriveFolder) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          drive_folder_id: folder.id,
          drive_folder_name: folder.name,
        })
        .eq("id", projectId);

      if (error) throw error;

      toast({ title: "Successo", description: `Cartella "${folder.name}" collegata al progetto` });
      setOpen(false);
      onFolderLinked();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message || "Impossibile collegare la cartella", variant: "destructive" });
    }
  };

  const handleUnlink = async () => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          drive_folder_id: null,
          drive_folder_name: null,
        })
        .eq("id", projectId);

      if (error) throw error;

      toast({ title: "Successo", description: "Cartella scollegata" });
      onFolderLinked();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message || "Impossibile scollegare la cartella", variant: "destructive" });
    }
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

  const openDriveFolder = () => {
    if (currentFolderId) {
      window.open(`https://drive.google.com/drive/folders/${currentFolderId}`, "_blank");
    }
  };

  const handleBackToSharedDrives = () => {
    setSelectedDrive(null);
    setBreadcrumbs([]);
    setFolders([]);
    setStartedFromClient(false);
    fetchSharedDrives();
  };

  return (
    <div className="flex items-center gap-2">
      {currentFolderId ? (
        <>
          <Button variant="outline" size="sm" onClick={openDriveFolder} className="gap-2">
            <Folder className="h-4 w-4" />
            {currentFolderName || "Cartella Drive"}
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleUnlink} title="Scollega cartella">
            <Unlink className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Link className="h-4 w-4" />
              Collega cartella Drive
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Seleziona cartella Drive</DialogTitle>
              <DialogDescription>
                Seleziona una cartella dal Drive condiviso da collegare a questo progetto
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
            ) : !selectedDrive && !startedFromClient ? (
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
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca cartella (min 3 caratteri)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSearchQuery("");
                        setIsSearching(false);
                        setSearchResults([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Breadcrumbs - hide when searching */}
                {!isSearching && (
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
                )}

                {/* Search results or folder list */}
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1">
                    {isSearching ? (
                      // Search results
                      searchResults.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          {loading ? "Ricerca in corso..." : "Nessuna cartella trovata"}
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground mb-2">
                            {searchResults.length} risultati trovati
                          </p>
                          {searchResults.map((folder) => (
                            <div key={folder.id} className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                className="flex-1 justify-start gap-2"
                                onClick={() => {
                                  setSearchQuery("");
                                  setIsSearching(false);
                                  setSearchResults([]);
                                  handleFolderClick(folder);
                                }}
                              >
                                <Folder className="h-4 w-4" />
                                {folder.name}
                                <ChevronRight className="h-4 w-4 ml-auto" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleSelectFolder(folder)}
                              >
                                Seleziona
                              </Button>
                            </div>
                          ))}
                        </>
                      )
                    ) : (
                      // Normal folder list
                      folders.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nessuna sottocartella trovata
                        </p>
                      ) : (
                        folders.map((folder) => (
                          <div key={folder.id} className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              className="flex-1 justify-start gap-2"
                              onClick={() => handleFolderClick(folder)}
                            >
                              <Folder className="h-4 w-4" />
                              {folder.name}
                              <ChevronRight className="h-4 w-4 ml-auto" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSelectFolder(folder)}
                            >
                              Seleziona
                            </Button>
                          </div>
                        ))
                      )
                    )}
                  </div>
                </ScrollArea>

                {/* Option to select current folder - hide when searching */}
                {!isSearching && breadcrumbs.length >= 1 && (
                  <Button
                    className="w-full"
                    onClick={() =>
                      handleSelectFolder({
                        id: breadcrumbs[breadcrumbs.length - 1].id,
                        name: breadcrumbs[breadcrumbs.length - 1].name,
                      })
                    }
                  >
                    Seleziona questa cartella
                  </Button>
                )}

                <Button variant="outline" onClick={handleBackToSharedDrives}>
                  ← Torna ai Drive
                </Button>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
