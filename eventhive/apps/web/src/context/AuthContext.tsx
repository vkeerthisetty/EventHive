import React, { createContext, useContext, useEffect, useState } from 'react';
import { Role } from '@eventhive/shared';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  year: number;
  roll_no?: string | null;
  bio?: string | null;
  interests?: string[];
  open_to_team?: boolean;
  skills?: Array<{ id: number; slug: string; label: string; skill_group: string; level: number }>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (body: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const post = async (path: string, body: any) => {
    const res = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Request failed');
    return data;
  };
  const login = async (email: string, password: string) => {
    const data = await post('/api/auth/login', { email, password });
    setUser(data.user);
  };
  const signup = async (b: Record<string, any>) => {
    const { fullName, role, organizerCode, ...rest } = b;
    const payload = role === 'organizer'
      ? { name: fullName, ...rest, organizerCode }
      : { name: fullName, ...rest };
    const data = await post('/api/auth/signup', payload);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
