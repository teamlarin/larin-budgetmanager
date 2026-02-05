import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
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

    const data = await response.json();
    if (data.error) {
      console.error("Refresh token error:", data);
      return null;
    }

    return { access_token: data.access_token, expires_in: data.expires_in };
  } catch (error) {
    console.error("Refresh token fetch error:", error);
    return null;
  }
}

Deno.serve(async (req) => {
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

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Get user's Google tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: "Not connected to Google Calendar", connected: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenData.access_token;
    const tokenExpiry = new Date(tokenData.token_expiry);

    // Refresh token if expired
    if (tokenExpiry < new Date()) {
      console.log("Token expired, refreshing...");
      const refreshed = await refreshAccessToken(tokenData.refresh_token);
      
      if (!refreshed) {
        // Token refresh failed, user needs to re-authenticate
        return new Response(JSON.stringify({ error: "Token expired, please reconnect", connected: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      // Update token in database
      await supabase
        .from("user_google_tokens")
        .update({ 
          access_token: accessToken,
          token_expiry: newExpiry,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);
    }

    if (action === "calendars") {
      // Get list of calendars
      const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Calendar list error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch calendars" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const calendars = (data.items || []).map((cal: any) => ({
        id: cal.id,
        name: cal.summary,
        primary: cal.primary || false,
        backgroundColor: cal.backgroundColor,
        selected: tokenData.selected_calendars?.includes(cal.id) || cal.primary || false,
      }));

      return new Response(JSON.stringify({ connected: true, calendars }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save-calendars") {
      const { calendarIds } = await req.json();
      
      await supabase
        .from("user_google_tokens")
        .update({ 
          selected_calendars: calendarIds,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "events") {
      const timeMin = url.searchParams.get("timeMin");
      const timeMax = url.searchParams.get("timeMax");

      if (!timeMin || !timeMax) {
        return new Response(JSON.stringify({ error: "timeMin and timeMax required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Determine which calendars to fetch
      let calendarIds = tokenData.selected_calendars || [];
      
      if (calendarIds.length === 0) {
        // If no calendars selected, get the primary calendar
        const listResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (listResponse.ok) {
          const listData = await listResponse.json();
          const primaryCal = listData.items?.find((c: any) => c.primary);
          if (primaryCal) calendarIds = [primaryCal.id];
        }
      }

      // Fetch events from all selected calendars
      const allEvents: any[] = [];
      
      for (const calendarId of calendarIds) {
        try {
          const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
            `timeMin=${encodeURIComponent(timeMin)}` +
            `&timeMax=${encodeURIComponent(timeMax)}` +
            `&singleEvents=true` +
            `&orderBy=startTime`;

          const response = await fetch(eventsUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (response.ok) {
            const data = await response.json();
            const events = (data.items || [])
              // Filter out cancelled events and events where user declined
              .filter((event: any) => {
                // Skip cancelled events
                if (event.status === 'cancelled') {
                  return false;
                }
                
                // Check if current user declined the event
                if (event.attendees && Array.isArray(event.attendees)) {
                  const userAttendee = event.attendees.find((a: any) => a.self === true);
                  if (userAttendee && userAttendee.responseStatus === 'declined') {
                    return false;
                  }
                }
                
                return true;
              })
              .map((event: any) => ({
                id: event.id,
                calendarId,
                title: event.summary || "(No title)",
                description: event.description || "",
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                allDay: !event.start?.dateTime,
                htmlLink: event.htmlLink,
                location: event.location,
              }));
            allEvents.push(...events);
          }
        } catch (err) {
          console.error(`Error fetching events for calendar ${calendarId}:`, err);
        }
      }

      return new Response(JSON.stringify({ connected: true, events: allEvents }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Google Calendar Events error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
