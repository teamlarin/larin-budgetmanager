import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface FattureInCloudSupplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  vat_number?: string;
  address_street?: string;
  address_postal_code?: string;
  address_city?: string;
  address_province?: string;
  notes?: string;
}

interface WebhookPayload {
  type: string;
  data: {
    id: number;
    entity_type: string;
    [key: string]: unknown;
  };
}

serve(async (req) => {
  console.log('Webhook received:', req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle verification requests (GET with validation token)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const validationToken = url.searchParams.get('validationToken');
    if (validationToken) {
      console.log('Webhook verification request received');
      return new Response(validationToken, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get raw body text first
    const bodyText = await req.text();
    console.log('Received webhook body:', bodyText);
    
    // If body is empty, this might be a test/verification request
    if (!bodyText || bodyText.trim() === '') {
      console.log('Empty body received - verification or test request');
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook endpoint active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse webhook payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      return new Response(
        JSON.stringify({ success: true, message: 'Invalid JSON received' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Parsed webhook payload:', JSON.stringify(payload));

    // Handle CloudEvents format - check for 'type' field that contains event type
    const eventType = payload.type || '';
    console.log('Event type:', eventType);
    
    // Check if this is a supplier-related event
    const isSupplierEvent = eventType.includes('suppliers') || payload.data?.entity_type === 'supplier';
    
    if (!isSupplierEvent) {
      console.log('Ignoring non-supplier event:', eventType);
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored - not a supplier event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FATTURE_IN_CLOUD_API_KEY');
    if (!apiKey) {
      throw new Error('FATTURE_IN_CLOUD_API_KEY not configured');
    }

    // Fetch supplier details from Fatture in Cloud API
    const supplierId = payload.data.id;
    console.log('Fetching supplier details for ID:', supplierId);
    
    const ficResponse = await fetch(
      `https://api-v2.fattureincloud.it/c/${await getCompanyId(apiKey)}/entities/suppliers/${supplierId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!ficResponse.ok) {
      // If 404, the supplier was deleted
      if (ficResponse.status === 404) {
        console.log('Supplier not found in FIC, might have been deleted');
        // Find and delete the supplier from our database
        const { error: deleteError } = await supabase
          .from('suppliers')
          .delete()
          .eq('fic_id', supplierId);
        
        if (deleteError) {
          console.error('Error deleting supplier:', deleteError);
        }
        
        return new Response(
          JSON.stringify({ success: true, message: 'Supplier deleted' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`FIC API error: ${ficResponse.status} ${await ficResponse.text()}`);
    }

    const ficData = await ficResponse.json();
    const ficSupplier: FattureInCloudSupplier = ficData.data;
    console.log('Fetched supplier from FIC:', JSON.stringify(ficSupplier));

    // Build address string
    const addressParts = [
      ficSupplier.address_street,
      ficSupplier.address_postal_code,
      ficSupplier.address_city,
      ficSupplier.address_province,
    ].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(', ') : null;

    // Upsert supplier in our database
    // First, check if we have a supplier with this fic_id
    const { data: existingSupplier } = await supabase
      .from('suppliers')
      .select('id, user_id')
      .eq('fic_id', supplierId)
      .maybeSingle();

    if (existingSupplier) {
      // Update existing supplier
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({
          name: ficSupplier.name,
          email: ficSupplier.email || null,
          phone: ficSupplier.phone || null,
          vat_number: ficSupplier.vat_number || null,
          address: address,
          notes: ficSupplier.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSupplier.id);

      if (updateError) {
        throw updateError;
      }
      
      console.log('Updated supplier:', existingSupplier.id);
    } else {
      // Get a system user to associate with the new supplier
      // We'll use the first admin user
      const { data: adminUser } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (!adminUser) {
        throw new Error('No admin user found to associate supplier with');
      }

      // Insert new supplier
      const { error: insertError } = await supabase
        .from('suppliers')
        .insert({
          fic_id: supplierId,
          name: ficSupplier.name,
          email: ficSupplier.email || null,
          phone: ficSupplier.phone || null,
          vat_number: ficSupplier.vat_number || null,
          address: address,
          notes: ficSupplier.notes || null,
          user_id: adminUser.user_id,
        });

      if (insertError) {
        throw insertError;
      }
      
      console.log('Created new supplier from FIC');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Supplier synced successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to get company ID from FIC
async function getCompanyId(apiKey: string): Promise<number> {
  const response = await fetch('https://api-v2.fattureincloud.it/user/companies', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get company ID: ${response.status}`);
  }

  const data = await response.json();
  if (!data.data?.companies?.[0]?.id) {
    throw new Error('No company found in Fatture in Cloud account');
  }

  return data.data.companies[0].id;
}
