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
  signup: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  demoLogin: (role: UserRole) => void;
  hasAccess: (requiredRoles: UserRole[]) => boolean;
}

// Demo users for quick access (fallback when no real auth)
const demoUsers: Record<UserRole, AuthUser> = {
  admin: {
    id: 'demo-admin',
    name: 'Prof. Aisha Mohammed',
    email: 'registrar@futech.edu.ng',
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
          setSession(currentSession);
          const prof = await fetchProfile(currentSession.user.id);
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

  // Real email/password signup
  const signup = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole
  ): Promise<{ error: string | null }> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (error) {
        setIsLoading(false);
        return { error: error.message };
      }

      if (data.user && data.session) {
        // Profile is auto-created by the DB trigger
        // Wait a moment for the trigger to execute
        await new Promise(resolve => setTimeout(resolve, 500));
        const prof = await fetchProfile(data.user.id);
        if (prof) {
          setProfile(prof);
          setUser(profileToAuthUser(prof));
          setSession(data.session);
          setIsDemoMode(false);
        }
        setIsLoading(false);
        return { error: null };
      }

      // If email confirmation is required
      if (data.user && !data.session) {
        setIsLoading(false);
        return { error: null }; // Success but needs email confirmation
      }

      setIsLoading(false);
      return { error: 'Signup failed. Please try again.' };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err.message || 'Signup failed' };
    }
  }, [fetchProfile, profileToAuthUser]);

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
      signup,
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
