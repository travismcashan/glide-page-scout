import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, Users, Crown, Loader2, UserPlus, Trash2, KeyRound, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import { toast } from 'sonner';
import { format } from 'date-fns';

type UserRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  roles: string[];
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { user: currentUser, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { navigate('/'); return; }
    fetchUsers();
  }, [isAdmin, authLoading]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, created_at')
      .order('created_at', { ascending: true });

    const { data: roles } = await supabase.from('user_roles').select('user_id, role');

    // Fetch emails via the admin-users edge function (returns list with emails)
    const { data: authUsers } = await supabase.functions.invoke('admin-users', {
      body: { action: 'list' },
    }).catch(() => ({ data: null }));

    const emailMap = new Map<string, string>();
    if (authUsers?.users) {
      authUsers.users.forEach((u: any) => emailMap.set(u.id, u.email));
    }

    const roleMap = new Map<string, string[]>();
    (roles || []).forEach(r => {
      const existing = roleMap.get(r.user_id) || [];
      existing.push(r.role);
      roleMap.set(r.user_id, existing);
    });

    setUsers((profiles || []).map(p => ({
      ...p,
      email: emailMap.get(p.id) ?? null,
      roles: roleMap.get(p.id) || [],
    })));
    setLoading(false);
  };

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    // Prevent removing your own admin
    if (userId === currentUser?.id && currentlyAdmin) {
      toast.error('Cannot remove your own admin role');
      return;
    }
    setToggling(userId);
    try {
      if (currentlyAdmin) {
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
        toast.success('Admin role removed');
      } else {
        await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' } as any);
        toast.success('Admin role granted');
      }
      await fetchUsers();
    } catch {
      toast.error('Failed to update role');
    }
    setToggling(null);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'invite', email: inviteEmail.trim() },
      });
      if (error) throw error;
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send invite');
    }
    setInviting(false);
  };

  const handleResetPassword = async (user: UserRow) => {
    if (!user.email) { toast.error('No email on file for this user'); return; }
    setResettingId(user.id);
    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'reset-password', email: user.email },
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send reset email');
    }
    setResettingId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId: deleteTarget.id },
      });
      if (error) throw error;
      toast.success(`Deleted ${deleteTarget.display_name || deleteTarget.email || 'user'}`);
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete user');
    }
    setDeleting(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" /> Admin
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {users.length} user{users.length !== 1 ? 's' : ''} · Manage access and accounts
            </p>
          </div>
        </div>

        {/* Invite user */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite User
          </h2>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="name@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              className="max-w-sm"
            />
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="gap-2">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send Invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">An invite email will be sent. They'll set their own password.</p>
        </div>

        {/* User list */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Users
          </h2>
          {users.map(user => {
            const userIsAdmin = user.roles.includes('admin');
            const isSelf = user.id === currentUser?.id;
            return (
              <Card key={user.id} className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-sm">
                      {(user.display_name || user.email || '?')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{user.display_name || 'Unknown'}</p>
                      {isSelf && <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>}
                      {userIsAdmin && (
                        <Badge variant="default" className="gap-1 text-xs">
                          <Crown className="h-2.5 w-2.5" /> Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">Joined {format(new Date(user.created_at), 'MMM d, yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Send password reset"
                      disabled={resettingId === user.id}
                      onClick={() => handleResetPassword(user)}
                      className="gap-1.5 text-muted-foreground"
                    >
                      {resettingId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                      Reset
                    </Button>
                    <Button
                      variant={userIsAdmin ? 'outline' : 'secondary'}
                      size="sm"
                      disabled={toggling === user.id || isSelf}
                      title={isSelf ? 'Cannot change your own role' : undefined}
                      onClick={() => toggleAdmin(user.id, userIsAdmin)}
                    >
                      {toggling === user.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : userIsAdmin ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive/60 hover:text-destructive"
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.display_name || deleteTarget?.email}</strong> and all their data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {deleting ? 'Deleting…' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
