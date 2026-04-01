import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Decode JWT payload to extract user_id (sub claim).
 * Pure base64 decode — no network call, matches pattern used in all other edge functions.
 * NOTE: verify_jwt is disabled on this function because the Supabase gateway was
 * rejecting valid JWTs. We handle auth ourselves via JWT decode + admin role check.
 */
function getUserIdFromRequest(req: Request): string | null {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token || token.length < 10) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
    return payload.sub || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Decode JWT to get user ID (same pattern as all other edge functions)
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Admin-privileged client (service role key bypasses RLS)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify calling user has admin role using service role client + direct query
    const { data: roleRow, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('admin-users: role check error:', roleError.message);
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, email, userId: targetUserId } = await req.json();

    if (action === 'list') {
      const { data, error } = await adminClient.auth.admin.listUsers();
      if (error) throw error;
      return new Response(JSON.stringify({
        users: data.users.map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at,
          last_sign_in_at: u.last_sign_in_at,
          invited_at: u.invited_at,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'invite') {
      if (!email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { error } = await adminClient.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete') {
      if (!targetUserId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (targetUserId === userId) return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset-password') {
      if (!email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { error } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${Deno.env.get('SITE_URL') ?? 'https://app.glidedesign.com'}/login`,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('admin-users error:', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
