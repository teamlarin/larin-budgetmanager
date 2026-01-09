import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Helper to refresh access token
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error("Failed to refresh token:", await response.text());
    return null;
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's Google tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: "Google account not connected", needsAuth: true }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenData.access_token;

    // Check if token is expired and refresh if needed
    if (new Date(tokenData.token_expiry) <= new Date()) {
      console.log("Token expired, refreshing...");
      const newTokens = await refreshAccessToken(tokenData.refresh_token);
      
      if (!newTokens) {
        return new Response(JSON.stringify({ error: "Failed to refresh Google token", needsAuth: true }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      accessToken = newTokens.access_token;
      const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      // Update tokens in database
      await supabase
        .from("user_google_tokens")
        .update({
          access_token: accessToken,
          token_expiry: newExpiry,
        })
        .eq("user_id", user.id);
    }

    const body = await req.json();
    const { action, driveId, folderId, parentFolderId, folderName, sharedDriveId } = body;
    console.log("Action:", action, "DriveId:", driveId, "FolderId:", folderId);

    if (action === "list-shared-drives") {
      // List all shared drives the user has access to
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/drives?pageSize=100",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", response.status, errorText);
        
        if (response.status === 403 && errorText.includes("insufficientPermissions")) {
          return new Response(JSON.stringify({ 
            error: "Permessi insufficienti. Riconnetti Google con gli scope Drive.", 
            needsReauth: true 
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        return new Response(JSON.stringify({ error: "Failed to list shared drives" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      console.log("Shared drives found:", data.drives?.length || 0);

      return new Response(JSON.stringify({ drives: data.drives || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-folders") {
      // List folders in a shared drive or folder
      let query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
      let url = "https://www.googleapis.com/drive/v3/files";
      
      // If we have a driveId but no folderId, show root-level folders of the shared drive
      let parentQuery = "";
      if (folderId) {
        parentQuery = `'${folderId}' in parents`;
      } else if (driveId) {
        // Root level of shared drive - parent is the drive itself
        parentQuery = `'${driveId}' in parents`;
      }
      
      const fullQuery = parentQuery ? `${parentQuery} and ${query}` : query;
      
      const params = new URLSearchParams({
        q: fullQuery,
        fields: "files(id,name,parents)",
        pageSize: "100",
        orderBy: "name",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });

      if (driveId) {
        params.set("driveId", driveId);
        params.set("corpora", "drive");
      }

      console.log("Fetching folders with query:", fullQuery);

      const response = await fetch(`${url}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", response.status, errorText);
        return new Response(JSON.stringify({ error: "Failed to list folders" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      console.log("Folders found:", data.files?.length || 0);

      return new Response(JSON.stringify({ folders: data.files || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-folder-info") {
      // Get info about a specific folder
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,webViewLink&supportsAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", response.status, errorText);
        return new Response(JSON.stringify({ error: "Failed to get folder info" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const folder = await response.json();
      return new Response(JSON.stringify({ folder }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-folder") {
      console.log("Creating folder:", folderName, "in parent:", parentFolderId || sharedDriveId);

      if (!folderName) {
        return new Response(JSON.stringify({ error: "Folder name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const metadata: any = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      };

      // Set parent folder
      if (parentFolderId) {
        metadata.parents = [parentFolderId];
      } else if (sharedDriveId) {
        metadata.parents = [sharedDriveId];
      }

      const params = new URLSearchParams({
        supportsAllDrives: "true",
      });

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", response.status, errorText);
        return new Response(JSON.stringify({ error: "Failed to create folder", details: errorText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newFolder = await response.json();
      console.log("Folder created:", newFolder.id, newFolder.name);

      return new Response(JSON.stringify({ folder: newFolder }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Google Drive error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
