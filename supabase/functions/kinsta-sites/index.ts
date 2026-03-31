import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const KINSTA_API_KEY = Deno.env.get('KINSTA_API_KEY');
    if (!KINSTA_API_KEY) {
      return new Response(JSON.stringify({ error: 'KINSTA_API_KEY not configured' }), { status: 500, headers: corsHeaders });
    }

    const KINSTA_COMPANY_ID = Deno.env.get('KINSTA_COMPANY_ID');
    if (!KINSTA_COMPANY_ID) {
      return new Response(JSON.stringify({ error: 'KINSTA_COMPANY_ID not configured' }), { status: 500, headers: corsHeaders });
    }

    const kinstaHeaders = { 'Authorization': `Bearer ${KINSTA_API_KEY}` };

    // Fetch sites list
    const sitesResponse = await fetch(`https://api.kinsta.com/v2/sites?company=${KINSTA_COMPANY_ID}`, {
      headers: kinstaHeaders,
    });

    if (!sitesResponse.ok) {
      const errorText = await sitesResponse.text();
      console.error(`Kinsta API error [${sitesResponse.status}]: ${errorText}`);
      return new Response(JSON.stringify({ error: `Kinsta API error: ${sitesResponse.status}` }), {
        status: sitesResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sitesData = await sitesResponse.json();
    const sites = sitesData?.company?.sites || [];

    // Fetch environment details for each site to get primary_domain
    const enrichedSites = await Promise.all(
      sites.map(async (site: any) => {
        try {
          const envResponse = await fetch(`https://api.kinsta.com/v2/sites/${site.id}/environments`, {
            headers: kinstaHeaders,
          });
          if (envResponse.ok) {
            const envData = await envResponse.json();
            return { ...site, environments: envData?.site?.environments || [] };
          }
        } catch (e) {
          console.error(`Failed to fetch environments for site ${site.id}:`, e);
        }
        return site;
      })
    );

    return new Response(JSON.stringify({ company: { sites: enrichedSites } }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in kinsta-sites function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
