import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify the caller is an admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin
      .rpc('is_admin', { _user_id: user.id })

    if (roleError) {
      console.error('Role check error:', roleError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin status' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!isAdmin) {
      console.warn('Non-admin user attempted deletion:', user.id)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the user ID and action from request body
    const { userId, action = 'soft_delete' } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId in request body' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Admin user', user.id, action === 'restore' ? 'restoring' : 'soft deleting', 'user', userId)

    if (action === 'restore') {
      // Restore soft-deleted user
      const { error: restoreError } = await supabaseAdmin.rpc('restore_user', {
        _user_id: userId
      })

      if (restoreError) {
        console.error('Restore user error:', restoreError)
        return new Response(
          JSON.stringify({ error: restoreError.message || 'Failed to restore user' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('Successfully restored user:', userId)
      return new Response(
        JSON.stringify({ success: true, action: 'restored' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else if (action === 'hard_delete') {
      // Permanently delete user (use existing function)
      const { error: deleteError } = await supabaseAdmin.rpc('delete_user_completely', {
        _user_id: userId
      })

      if (deleteError) {
        console.error('Hard delete user error:', deleteError)
        return new Response(
          JSON.stringify({ error: deleteError.message || 'Failed to delete user permanently' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('Successfully hard deleted user:', userId)
      return new Response(
        JSON.stringify({ success: true, action: 'hard_deleted' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      // Soft delete user (default)
      const { error: softDeleteError } = await supabaseAdmin.rpc('soft_delete_user', {
        _user_id: userId
      })

      if (softDeleteError) {
        console.error('Soft delete user error:', softDeleteError)
        return new Response(
          JSON.stringify({ error: softDeleteError.message || 'Failed to soft delete user' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('Successfully soft deleted user:', userId)
      return new Response(
        JSON.stringify({ success: true, action: 'soft_deleted' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    console.error('Unexpected error in admin-delete-user:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
