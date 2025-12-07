import Landing from '@/pages/Landing';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';

export default function LandingExample() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Landing />
      </AuthProvider>
    </ThemeProvider>
  );
}
