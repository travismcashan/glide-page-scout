import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Shield, Users, Crown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type UserRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { navigate('/'); return; }
    fetchUsers();
  }, [isAdmin, authLoading]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url, created_at');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');

    const roleMap = new Map<string, string[]>();
    (roles || []).forEach(r => {
      const existing = roleMap.get(r.user_id) || [];
      existing.push(r.role);
      roleMap.set(r.user_id, existing);
    });

    setUsers((profiles || []).map(p => ({
      ...p,
      roles: roleMap.get(p.id) || [],
    })));
    setLoading(false);
  };

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Admin · User Management</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Team Members</h2>
            <p className="text-sm text-muted-foreground mt-1">{users.length} user{users.length !== 1 ? 's' : ''} registered</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Manage roles and access
          </div>
        </div>

        <div className="space-y-3">
          {users.map(user => {
            const userIsAdmin = user.roles.includes('admin');
            return (
              <Card key={user.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-sm">
                        {(user.display_name || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{user.display_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {userIsAdmin && (
                      <Badge variant="default" className="gap-1">
                        <Crown className="h-3 w-3" /> Admin
                      </Badge>
                    )}
                    <Button
                      variant={userIsAdmin ? 'outline' : 'secondary'}
                      size="sm"
                      disabled={toggling === user.id}
                      onClick={() => toggleAdmin(user.id, userIsAdmin)}
                    >
                      {toggling === user.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : userIsAdmin ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
