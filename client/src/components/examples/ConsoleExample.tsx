import { useState } from 'react';
import Console from '@/components/editor/Console';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function ConsoleExample() {
  const [output, setOutput] = useState<string[]>([
    'Hello, Developer!',
    'Welcome to CodeOrbit.',
    '',
    'Your code ran successfully!',
    'Count: 1',
    'Count: 2',
    'Count: 3',
  ]);
  const [errors, setErrors] = useState<string[]>([]);

  return (
    <ThemeProvider>
      <div className="w-full max-w-2xl border rounded-lg overflow-hidden">
        <Console
          output={output}
          errors={errors}
          isRunning={false}
          onClear={() => {
            setOutput([]);
            setErrors([]);
          }}
        />
      </div>
    </ThemeProvider>
  );
}
