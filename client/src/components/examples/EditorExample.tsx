import { useEffect } from 'react';
import Editor from '@/pages/Editor';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';

export default function EditorExample() {
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
        <Editor />
      </AuthProvider>
    </ThemeProvider>
  );
}
