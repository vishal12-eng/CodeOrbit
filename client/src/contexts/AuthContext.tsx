import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const login = () => {
    // Open in top frame to break out of iframe for OAuth redirect
    window.open('/api/login', '_top');
  };

  const logout = () => {
    // Open in top frame to break out of iframe for OAuth redirect
    window.open('/api/logout', '_top');
  };

  return (
    <AuthContext.Provider value={{ 
      user: user ?? null, 
      isAuthenticated: !!user, 
      isLoading, 
      login, 
      logout 
    }}>
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
