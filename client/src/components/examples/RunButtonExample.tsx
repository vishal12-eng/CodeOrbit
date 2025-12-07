import { useState } from 'react';
import RunButton from '@/components/editor/RunButton';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function RunButtonExample() {
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 2000);
  };

  return (
    <ThemeProvider>
      <div className="p-6">
        <RunButton isRunning={isRunning} onClick={handleRun} />
      </div>
    </ThemeProvider>
  );
}
