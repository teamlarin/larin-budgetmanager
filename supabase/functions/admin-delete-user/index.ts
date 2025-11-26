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

    // Get the user ID to delete from request body
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId in request body' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Admin user', user.id, 'deleting user', userId)

    // Manually delete user data from public tables in the correct order
    // to avoid foreign key constraint issues
    
    // Delete activity_time_tracking (no FK dependencies)
    await supabaseAdmin
      .from('activity_time_tracking')
      .delete()
      .eq('user_id', userId)

    // Delete notifications (no FK dependencies)
    await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', userId)

    // Delete project_members (no FK dependencies)
    await supabaseAdmin
      .from('project_members')
      .delete()
      .eq('user_id', userId)

    // Delete project_audit_log entries
    await supabaseAdmin
      .from('project_audit_log')
      .delete()
      .eq('user_id', userId)

    // Delete budget_items for user's projects
    const { data: userProjects } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('user_id', userId)

    if (userProjects && userProjects.length > 0) {
      const projectIds = userProjects.map(p => p.id)
      
      await supabaseAdmin
        .from('budget_items')
        .delete()
        .in('project_id', projectIds)
    }

    // Update projects to remove account_user_id references
    await supabaseAdmin
      .from('projects')
      .update({ account_user_id: null })
      .eq('account_user_id', userId)

    // Update projects to remove user_id references
    await supabaseAdmin
      .from('projects')
      .update({ user_id: null })
      .eq('user_id', userId)

    // Delete quotes
    await supabaseAdmin
      .from('quotes')
      .delete()
      .eq('user_id', userId)

    // Delete user-owned data
    await supabaseAdmin
      .from('activity_categories')
      .delete()
      .eq('user_id', userId)

    await supabaseAdmin
      .from('levels')
      .delete()
      .eq('user_id', userId)

    await supabaseAdmin
      .from('products')
      .delete()
      .eq('user_id', userId)

    await supabaseAdmin
      .from('services')
      .delete()
      .eq('user_id', userId)

    await supabaseAdmin
      .from('budget_templates')
      .delete()
      .eq('user_id', userId)

    // Update clients to remove user_id (preserve client data)
    await supabaseAdmin
      .from('clients')
      .update({ user_id: null })
      .eq('user_id', userId)

    // Delete user_roles
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    // Delete profile
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    // Finally, delete the user from auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Delete user error:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Successfully deleted user:', userId)

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
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
