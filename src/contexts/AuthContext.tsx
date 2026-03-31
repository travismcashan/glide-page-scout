import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,  // true until both session AND role are resolved
  isAdmin: false,
  profile: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fetch profile and role; keep loading=true until role resolves
        setTimeout(() => {
          supabase.from('profiles').select('display_name, avatar_url').eq('id', session.user.id).single()
            .then(({ data }) => {
              if (data) {
                setProfile(data);
                // Sync Google avatar if missing in profile but available in user metadata
                if (!data.avatar_url) {
                  const metaAvatar = session.user.user_metadata?.avatar_url
                    || session.user.user_metadata?.picture;
                  if (metaAvatar) {
                    supabase.from('profiles').update({ avatar_url: metaAvatar }).eq('id', session.user.id)
                      .then(() => setProfile(prev => prev ? { ...prev, avatar_url: metaAvatar } : prev));
                  }
                }
              }
            });
          supabase.rpc('has_role', { _user_id: session.user.id, _role: 'admin' })
            .then(({ data }) => {
              setIsAdmin(!!data);
              setLoading(false);
            });
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    // Then check existing session (only sets loading=false if no user — role check handles it otherwise)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
