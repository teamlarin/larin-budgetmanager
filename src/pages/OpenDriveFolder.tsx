import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";

const DRIVE_FOLDER_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;

const OpenDriveFolder = () => {
  const { folderId = "" } = useParams<{ folderId: string }>();
  const driveUrl = useMemo(() => {
    if (!DRIVE_FOLDER_ID_PATTERN.test(folderId)) return null;
    return `https://drive.google.com/drive/folders/${folderId}`;
  }, [folderId]);

  useEffect(() => {
    if (!driveUrl) return;
    window.location.replace(driveUrl);
  }, [driveUrl]);

  if (!driveUrl) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Collegamento Drive non valido</h1>
          <p className="text-sm text-muted-foreground">La cartella richiesta non può essere aperta.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Apertura della cartella Google Drive…</p>
    </main>
  );
};

export default OpenDriveFolder;