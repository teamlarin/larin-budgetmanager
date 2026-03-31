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
    // Validate JWT
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

    const response = await fetch(`https://api.kinsta.com/v2/sites?company=${KINSTA_COMPANY_ID}`, {
      headers: {
        'Authorization': `Bearer ${KINSTA_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Kinsta API error [${response.status}]: ${errorText}`);
      return new Response(JSON.stringify({ error: `Kinsta API error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
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
