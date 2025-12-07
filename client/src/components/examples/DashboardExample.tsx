import { useState, useEffect } from 'react';
import Dashboard from '@/pages/Dashboard';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';

export default function DashboardExample() {
  useEffect(() => {
    // Mock user for demo purposes
    const mockUser = {
      id: '1',
      email: 'demo@codeorbit.dev',
      username: 'DemoUser',
      role: 'user',
      preferences: {
        theme: 'dark',
        editorFontSize: 14,
        autoSave: true,
      },
    };
    localStorage.setItem('codeorbit-user', JSON.stringify(mockUser));
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </ThemeProvider>
  );
}
