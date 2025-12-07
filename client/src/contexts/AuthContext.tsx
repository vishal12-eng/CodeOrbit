import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // todo: remove mock functionality - replace with real API calls
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('codeorbit-user');
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, _password: string) => {
    setIsLoading(true);
    // todo: remove mock functionality - implement real API call
    await new Promise(resolve => setTimeout(resolve, 800));
    const mockUser: User = {
      id: '1',
      email,
      username: email.split('@')[0],
      role: 'user',
      preferences: {
        theme: 'dark',
        editorFontSize: 14,
        autoSave: true,
      },
    };
    setUser(mockUser);
    localStorage.setItem('codeorbit-user', JSON.stringify(mockUser));
    setIsLoading(false);
  };

  const signup = async (email: string, username: string, _password: string) => {
    setIsLoading(true);
    // todo: remove mock functionality - implement real API call
    await new Promise(resolve => setTimeout(resolve, 800));
    const mockUser: User = {
      id: '1',
      email,
      username,
      role: 'user',
      preferences: {
        theme: 'dark',
        editorFontSize: 14,
        autoSave: true,
      },
    };
    setUser(mockUser);
    localStorage.setItem('codeorbit-user', JSON.stringify(mockUser));
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('codeorbit-user');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
