import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/types';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  student_id?: string;
  lecturer_id?: string;
  avatar_url?: string;
  matric_no?: string;
  staff_id?: string;
  // Set by the Superadministrator. Null means active.
  suspended_at?: string | null;
  suspension_reason?: string | null;
}

/**
 * A suspended account is refused here as well as at the auth layer.
 *
 * The real enforcement is the ban applied to the auth user by
 * /api/admin/suspend, which stops Supabase issuing or refreshing a token at
 * all. This check is the second line: it closes the window between the profile
 * being flagged and an existing token expiring, and it means a suspension
 * applied directly in SQL — without going through the route — still takes
 * effect at the next page load rather than at the next token refresh.
 */
const SUSPENDED_MESSAGE =
  'This account is suspended. Contact the Superadministrator at superadmin@iguc.net.';

function isSuspended(p: Profile | null): boolean {
  return !!p?.suspended_at;
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  matricNo?: string;
  staffId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  demoLogin: (role: UserRole) => void;
  hasAccess: (requiredRoles: UserRole[]) => boolean;
}

// Demo users for quick access (fallback when no real auth)
const demoUsers: Record<UserRole, AuthUser> = {
  superadmin: {
    id: 'demo-superadmin',
    name: 'Demo Superadministrator',
    email: 'superadmin@iguc.net',
    role: 'superadmin',
    avatar: 'SA',
  },
  admin: {
    id: 'demo-admin',
    name: 'Demo Administrator',
    email: 'admin@iguc.net',
    role: 'admin',
    avatar: '/images/site-icon.png',
  },
  student: {
    id: 'demo-student',
    name: 'Adebayo Oluwaseun',
    email: 'adebayo.o@uni.edu',
    role: 'student',
    matricNo: 'UNI/2022/CS/001',
    avatar: '/images/site-icon.png',
  },
  lecturer: {
    id: 'demo-lecturer',
    name: 'Dr. James Okonkwo',
    email: 'j.okonkwo@uni.edu',
    role: 'lecturer',
    staffId: 'STF/2020/001',
    avatar: '/images/site-icon.png',
  },
  finance: {
    id: 'demo-finance',
    name: 'Demo Finance Officer',
    email: 'finance@iguc.net',
    role: 'finance',
    avatar: 'FO',
  },
  registrar: {
    id: 'demo-registrar',
    name: 'Demo Registrar',
    email: 'registrar@iguc.net',
    role: 'registrar',
    avatar: 'RG',
  },
  applicant: {
    id: 'demo-applicant',
    name: 'Demo Applicant',
    email: 'applicant@example.com',
    role: 'applicant',
    avatar: 'AP',
  },
  'academic-office': {
    id: 'demo-academic-office',
    name: 'Demo Academic Office',
    email: 'academic@iguc.net',
    role: 'academic-office',
    avatar: 'AO',
  },
  dean: {
    id: 'demo-dean',
    name: 'Demo Faculty Dean',
    email: 'dean@iguc.net',
    role: 'dean',
    avatar: 'FD',
  },
  chancellor: {
    id: 'demo-chancellor',
    name: 'Demo Chancellor',
    email: 'chancellor@iguc.net',
    role: 'chancellor',
    avatar: 'CH',
  },
  'vice-chancellor': {
    id: 'demo-vice-chancellor',
    name: 'Demo Vice Chancellor',
    email: 'vice-chancellor@iguc.net',
    role: 'vice-chancellor',
    avatar: 'VC',
  },
  'finance-director': {
    id: 'demo-finance-director',
    name: 'Demo Finance Director',
    email: 'finance-director@iguc.net',
    role: 'finance-director',
    avatar: 'FD',
  },
  hod: {
    id: 'demo-hod',
    name: 'Demo Head of Department',
    email: 'hod@iguc.net',
    role: 'hod',
    avatar: 'HD',
  },
  'programme-coordinator': {
    id: 'demo-programme-coordinator',
    name: 'Demo Programme Coordinator',
    email: 'programme-coordinator@iguc.net',
    role: 'programme-coordinator',
    avatar: 'PC',
  },
  'admissions-officer': {
    id: 'demo-admissions-officer',
    name: 'Demo Admissions Officer',
    email: 'admissions-officer@iguc.net',
    role: 'admissions-officer',
    avatar: 'AO',
  },
  'library-staff': {
    id: 'demo-library-staff',
    name: 'Demo Library Staff',
    email: 'library-staff@iguc.net',
    role: 'library-staff',
    avatar: 'LB',
  },
  'student-affairs': {
    id: 'demo-student-affairs',
    name: 'Demo Student Affairs',
    email: 'student-affairs@iguc.net',
    role: 'student-affairs',
    avatar: 'SA',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Fetch profile from Supabase
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error || !data) return null;
      return data as Profile;
    } catch {
      return null;
    }
  }, []);

  // Convert profile to AuthUser
  const profileToAuthUser = useCallback((p: Profile): AuthUser => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
    role: p.role,
    avatar: p.avatar_url || undefined,
    matricNo: p.matric_no || undefined,
    staffId: p.staff_id || undefined,
  }), []);

  // Initialize auth state from existing session
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user && mounted) {
          const prof = await fetchProfile(currentSession.user.id);
          // Suspended between page loads: end the session rather than restore
          // it. Restoring first and checking later would show the console, and
          // a suspended administrator seeing the console for even one render is
          // a suspension that did not happen.
          if (isSuspended(prof)) {
            await supabase.auth.signOut();
            if (mounted) {
              setSession(null);
              setProfile(null);
              setUser(null);
            }
            return;
          }
          setSession(currentSession);
          if (prof && mounted) {
            setProfile(prof);
            setUser(profileToAuthUser(prof));
            setIsDemoMode(false);
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const prof = await fetchProfile(newSession.user.id);
          if (isSuspended(prof)) {
            await supabase.auth.signOut();
            return;
          }
          if (prof && mounted) {
            setProfile(prof);
            setUser(profileToAuthUser(prof));
            setIsDemoMode(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setIsDemoMode(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, profileToAuthUser]);

  // Real email/password login
  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        setIsLoading(false);
        return { error: error.message };
      }

      if (data.user) {
        const prof = await fetchProfile(data.user.id);
        if (isSuspended(prof)) {
          await supabase.auth.signOut();
          setIsLoading(false);
          return { error: SUSPENDED_MESSAGE };
        }
        if (prof) {
          setProfile(prof);
          setUser(profileToAuthUser(prof));
          setSession(data.session);
          setIsDemoMode(false);
        } else {
          setIsLoading(false);
          return { error: 'Profile not found. Please contact administrator.' };
        }
      }

      setIsLoading(false);
      return { error: null };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err.message || 'Login failed' };
    }
  }, [fetchProfile, profileToAuthUser]);

  /**
   * Self-registration is not part of this system, and the function that
   * performed it has been removed rather than left unused.
   *
   * It called supabase.auth.signUp with a role taken from its own argument. It
   * was already unreachable from the interface — the sign-up form went when the
   * admissions pipeline was built — but an exported function that mints
   * accounts is not made safe by nobody currently calling it. It is one import
   * away from being called again, and the role parameter meant the caller
   * chose the privilege level.
   *
   * Accounts are created in exactly two places, both server-side and both
   * holding the service-role key: the Registrar's approve route, which requires
   * a paid application, and /api/admin/staff, which requires the
   * Superadministrator. Migration 002 enforces the same rule at the database:
   * the browser roles have no UPDATE privilege on profiles.role, so even a
   * successful self-signup could not raise itself above 'student'.
   */

  // Logout
  const logout = useCallback(async () => {
    if (isDemoMode) {
      setUser(null);
      setProfile(null);
      setIsDemoMode(false);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setIsDemoMode(false);
  }, [isDemoMode]);

  // Demo login (no real auth, for testing)
  const demoLogin = useCallback((role: UserRole) => {
    setUser(demoUsers[role]);
    setProfile(null);
    setSession(null);
    setIsDemoMode(true);
  }, []);

  // Switch role (demo mode only)
  const switchRole = useCallback((role: UserRole) => {
    if (isDemoMode) {
      setUser(demoUsers[role]);
    }
    // In real auth mode, role switching is not allowed
  }, [isDemoMode]);

  // Role-based access check
  const hasAccess = useCallback((requiredRoles: UserRole[]): boolean => {
    if (!user) return false;
    return requiredRoles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      switchRole,
      demoLogin,
      hasAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
