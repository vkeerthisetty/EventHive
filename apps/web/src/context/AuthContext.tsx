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
  skills?: Array<{
    id: number;
    slug: string;
    label: string;
    skill_group: string;
    level: number;
  }>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (body: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const STORAGE_KEY = 'eventhive_demo_user';

const DEMO_USERS: Array<User & { password: string }> = [
  {
    id: 'demo-student-riya',
    name: 'Riya Sharma',
    email: 'riya@eventhive.test',
    password: 'Student@123',
    role: 'student' as Role,
    department: 'CSE',
    year: 3,
  },
  {
    id: 'demo-organizer-priya',
    name: 'Priya Nair',
    email: 'tech@eventhive.test',
    password: 'Organizer@123',
    role: 'organizer' as Role,
    department: 'CSE',
    year: 3,
  },
  {
    id: 'demo-admin',
    name: 'EventHive Admin',
    email: 'admin@eventhive.test',
    password: 'Admin@123',
    role: 'admin' as Role,
    department: 'Administration',
    year: 1,
  },
];

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY);

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        setUser(null);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const foundUser = DEMO_USERS.find(
      (u) =>
        u.email.toLowerCase() === email.trim().toLowerCase() &&
        u.password === password
    );

    if (!foundUser) {
      throw new Error(
        'Invalid demo login. Please use one of the Quick Demo Login buttons.'
      );
    }

    const { password: _password, ...safeUser } = foundUser;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser));
    setUser(safeUser);
  };

  const signup = async (body: Record<string, any>) => {
    const newUser: User = {
      id: `demo-user-${Date.now()}`,
      name: body.fullName || body.name || 'New User',
      email: body.email,
      role: body.role || ('student' as Role),
      department: body.department || 'CSE',
      year: body.year || 1,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);

    // Use SPA navigation instead of relying on the backend
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);