import { Link } from 'wouter';
import { ArrowLeft, RotateCcw, Palette, Code, Save, Play, Sparkles, Keyboard, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/layout/ThemeToggle';
import UserMenu from '@/components/layout/UserMenu';
import PageTransition from '@/components/layout/PageTransition';
import { useSettings, type Settings } from '@/hooks/use-settings';
import { useToast } from '@/hooks/use-toast';

const accentColors = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
];

const fontFamilies = [
  { value: 'Inter', label: 'Inter' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'Source Code Pro', label: 'Source Code Pro' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono' },
];

const languages = [
  { value: 'node-js', label: 'Node.js' },
  { value: 'python', label: 'Python' },
  { value: 'react', label: 'React' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'static', label: 'Static HTML' },
];

const aiModels = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
  { value: 'grok-2', label: 'Grok 2' },
];

const keyboardShortcuts = [
  { action: 'Save file', shortcut: 'Ctrl/Cmd + S' },
  { action: 'Run code', shortcut: 'Ctrl/Cmd + Enter' },
  { action: 'Toggle terminal', shortcut: 'Ctrl/Cmd + `' },
  { action: 'Search files', shortcut: 'Ctrl/Cmd + P' },
  { action: 'Find in file', shortcut: 'Ctrl/Cmd + F' },
  { action: 'Find and replace', shortcut: 'Ctrl/Cmd + H' },
  { action: 'Toggle sidebar', shortcut: 'Ctrl/Cmd + B' },
  { action: 'Comment line', shortcut: 'Ctrl/Cmd + /' },
  { action: 'Duplicate line', shortcut: 'Alt + Shift + Down' },
  { action: 'Delete line', shortcut: 'Ctrl/Cmd + Shift + K' },
  { action: 'Go to line', shortcut: 'Ctrl/Cmd + G' },
  { action: 'Format document', shortcut: 'Alt + Shift + F' },
  { action: 'Toggle AI panel', shortcut: 'Ctrl/Cmd + Shift + A' },
  { action: 'New file', shortcut: 'Ctrl/Cmd + N' },
  { action: 'Close file', shortcut: 'Ctrl/Cmd + W' },
];

function SettingRow({ 
  label, 
  description, 
  children 
}: { 
  label: string; 
  description?: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="flex-1 min-w-[200px]">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
  );
}

export default function Settings() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { toast } = useToast();

  const handleResetAll = () => {
    resetSettings();
    toast({
      title: 'Settings reset',
      description: 'All settings have been restored to defaults.',
    });
  };

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold">Settings</h1>
              <p className="text-muted-foreground mt-1">
                Customize your NovaCode IDE experience
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleResetAll} 
              className="gap-2"
              data-testid="button-reset-all"
            >
              <RotateCcw className="h-4 w-4" />
              Reset All
            </Button>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Appearance</CardTitle>
                </div>
                <CardDescription>
                  Customize the look and feel of the IDE
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <SettingRow label="Theme" description="Choose your preferred color scheme">
                  <Select
                    value={settings.appearance.theme}
                    onValueChange={(value: 'light' | 'dark' | 'system') => 
                      updateSettings('appearance', { theme: value })
                    }
                  >
                    <SelectTrigger className="w-[140px]" data-testid="select-theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="h-4 w-4" />
                          Light
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          Dark
                        </div>
                      </SelectItem>
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          System
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Accent Color" description="Primary color for buttons and highlights">
                  <Select
                    value={settings.appearance.accentColor}
                    onValueChange={(value) => 
                      updateSettings('appearance', { accentColor: value })
                    }
                  >
                    <SelectTrigger className="w-[140px]" data-testid="select-accent-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accentColors.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${color.class}`} />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Font Family" description="Font used throughout the interface">
                  <Select
                    value={settings.appearance.fontFamily}
                    onValueChange={(value) => 
                      updateSettings('appearance', { fontFamily: value })
                    }
                  >
                    <SelectTrigger className="w-[180px]" data-testid="select-font-family">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontFamilies.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="UI Density" description="Spacing between elements">
                  <Select
                    value={settings.appearance.uiDensity}
                    onValueChange={(value: 'comfortable' | 'compact') => 
                      updateSettings('appearance', { uiDensity: value })
                    }
                  >
                    <SelectTrigger className="w-[140px]" data-testid="select-ui-density">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Editor</CardTitle>
                </div>
                <CardDescription>
                  Configure the code editor behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <SettingRow label="Font Size" description={`${settings.editor.fontSize}px`}>
                  <div className="w-[200px]">
                    <Slider
                      value={[settings.editor.fontSize]}
                      onValueChange={([value]) => 
                        updateSettings('editor', { fontSize: value })
                      }
                      min={10}
                      max={24}
                      step={1}
                      data-testid="slider-font-size"
                    />
                  </div>
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Tab Size" description="Number of spaces per tab">
                  <Select
                    value={String(settings.editor.tabSize)}
                    onValueChange={(value) => 
                      updateSettings('editor', { tabSize: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-[100px]" data-testid="select-tab-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 spaces</SelectItem>
                      <SelectItem value="4">4 spaces</SelectItem>
                      <SelectItem value="8">8 spaces</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Word Wrap" description="Wrap long lines of code">
                  <Switch
                    checked={settings.editor.wordWrap}
                    onCheckedChange={(checked) => 
                      updateSettings('editor', { wordWrap: checked })
                    }
                    data-testid="switch-word-wrap"
                  />
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Line Numbers" description="Show line numbers in gutter">
                  <Switch
                    checked={settings.editor.lineNumbers}
                    onCheckedChange={(checked) => 
                      updateSettings('editor', { lineNumbers: checked })
                    }
                    data-testid="switch-line-numbers"
                  />
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Minimap" description="Show minimap on the right side">
                  <Switch
                    checked={settings.editor.minimap}
                    onCheckedChange={(checked) => 
                      updateSettings('editor', { minimap: checked })
                    }
                    data-testid="switch-minimap"
                  />
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Auto-complete" description="Enable intelligent code suggestions">
                  <Switch
                    checked={settings.editor.autoComplete}
                    onCheckedChange={(checked) => 
                      updateSettings('editor', { autoComplete: checked })
                    }
                    data-testid="switch-auto-complete"
                  />
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Bracket Matching" description="Highlight matching brackets">
                  <Switch
                    checked={settings.editor.bracketMatching}
                    onCheckedChange={(checked) => 
                      updateSettings('editor', { bracketMatching: checked })
                    }
                    data-testid="switch-bracket-matching"
                  />
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Format on Save" description="Automatically format code when saving">
                  <Switch
                    checked={settings.editor.formatOnSave}
                    onCheckedChange={(checked) => 
                      updateSettings('editor', { formatOnSave: checked })
                    }
                    data-testid="switch-format-on-save"
                  />
                </SettingRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Save className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Auto-save</CardTitle>
                </div>
                <CardDescription>
                  Configure automatic file saving
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <SettingRow label="Enable Auto-save" description="Automatically save files">
                  <Switch
                    checked={settings.autoSave.enabled}
                    onCheckedChange={(checked) => 
                      updateSettings('autoSave', { enabled: checked })
                    }
                    data-testid="switch-auto-save"
                  />
                </SettingRow>
                
                <Separator />
                
                <SettingRow 
                  label="Auto-save Delay" 
                  description={`Save after ${settings.autoSave.delay} second${settings.autoSave.delay !== 1 ? 's' : ''} of inactivity`}
                >
                  <div className="w-[200px]">
                    <Slider
                      value={[settings.autoSave.delay]}
                      onValueChange={([value]) => 
                        updateSettings('autoSave', { delay: value })
                      }
                      min={1}
                      max={10}
                      step={1}
                      disabled={!settings.autoSave.enabled}
                      data-testid="slider-auto-save-delay"
                    />
                  </div>
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Save on Focus Loss" description="Save when switching windows">
                  <Switch
                    checked={settings.autoSave.onFocusLoss}
                    onCheckedChange={(checked) => 
                      updateSettings('autoSave', { onFocusLoss: checked })
                    }
                    disabled={!settings.autoSave.enabled}
                    data-testid="switch-save-on-focus-loss"
                  />
                </SettingRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Language & Execution</CardTitle>
                </div>
                <CardDescription>
                  Configure code execution settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <SettingRow label="Default Language" description="Default project type for new projects">
                  <Select
                    value={settings.languageExecution.defaultLanguage}
                    onValueChange={(value) => 
                      updateSettings('languageExecution', { defaultLanguage: value })
                    }
                  >
                    <SelectTrigger className="w-[140px]" data-testid="select-default-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                
                <Separator />
                
                <SettingRow 
                  label="Default Timeout" 
                  description={`Scripts timeout after ${settings.languageExecution.defaultTimeout} seconds`}
                >
                  <div className="w-[200px]">
                    <Slider
                      value={[settings.languageExecution.defaultTimeout]}
                      onValueChange={([value]) => 
                        updateSettings('languageExecution', { defaultTimeout: value })
                      }
                      min={5}
                      max={120}
                      step={5}
                      data-testid="slider-default-timeout"
                    />
                  </div>
                </SettingRow>
                
                <Separator />
                
                <div className="py-4">
                  <Label className="text-sm font-medium">Enabled Runners</Label>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Choose which runners are available for execution
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between gap-2 p-3 rounded-md border">
                      <Label className="text-sm">Node.js</Label>
                      <Switch
                        checked={settings.languageExecution.enabledRunners.nodejs}
                        onCheckedChange={(checked) => 
                          updateSettings('languageExecution', { 
                            enabledRunners: { 
                              ...settings.languageExecution.enabledRunners, 
                              nodejs: checked 
                            } 
                          })
                        }
                        data-testid="switch-runner-nodejs"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3 rounded-md border">
                      <Label className="text-sm">Python</Label>
                      <Switch
                        checked={settings.languageExecution.enabledRunners.python}
                        onCheckedChange={(checked) => 
                          updateSettings('languageExecution', { 
                            enabledRunners: { 
                              ...settings.languageExecution.enabledRunners, 
                              python: checked 
                            } 
                          })
                        }
                        data-testid="switch-runner-python"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3 rounded-md border">
                      <Label className="text-sm">React</Label>
                      <Switch
                        checked={settings.languageExecution.enabledRunners.react}
                        onCheckedChange={(checked) => 
                          updateSettings('languageExecution', { 
                            enabledRunners: { 
                              ...settings.languageExecution.enabledRunners, 
                              react: checked 
                            } 
                          })
                        }
                        data-testid="switch-runner-react"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3 rounded-md border">
                      <Label className="text-sm">Next.js</Label>
                      <Switch
                        checked={settings.languageExecution.enabledRunners.nextjs}
                        onCheckedChange={(checked) => 
                          updateSettings('languageExecution', { 
                            enabledRunners: { 
                              ...settings.languageExecution.enabledRunners, 
                              nextjs: checked 
                            } 
                          })
                        }
                        data-testid="switch-runner-nextjs"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3 rounded-md border">
                      <Label className="text-sm">Static HTML</Label>
                      <Switch
                        checked={settings.languageExecution.enabledRunners.static}
                        onCheckedChange={(checked) => 
                          updateSettings('languageExecution', { 
                            enabledRunners: { 
                              ...settings.languageExecution.enabledRunners, 
                              static: checked 
                            } 
                          })
                        }
                        data-testid="switch-runner-static"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">AI Settings</CardTitle>
                </div>
                <CardDescription>
                  Configure AI-powered features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <SettingRow label="Enable AI Features" description="Use AI for code suggestions and chat">
                  <Switch
                    checked={settings.ai.enabled}
                    onCheckedChange={(checked) => 
                      updateSettings('ai', { enabled: checked })
                    }
                    data-testid="switch-ai-enabled"
                  />
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="Default AI Model" description="Model used for AI interactions">
                  <Select
                    value={settings.ai.defaultModel}
                    onValueChange={(value) => 
                      updateSettings('ai', { defaultModel: value })
                    }
                    disabled={!settings.ai.enabled}
                  >
                    <SelectTrigger className="w-[180px]" data-testid="select-ai-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiModels.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                
                <Separator />
                
                <SettingRow label="AI Context Mode" description="What context AI uses for suggestions">
                  <Select
                    value={settings.ai.contextMode}
                    onValueChange={(value: 'current-file' | 'project-wide') => 
                      updateSettings('ai', { contextMode: value })
                    }
                    disabled={!settings.ai.enabled}
                  >
                    <SelectTrigger className="w-[160px]" data-testid="select-ai-context">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current-file">Current File</SelectItem>
                      <SelectItem value="project-wide">Project-wide</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Keyboard Shortcuts</CardTitle>
                </div>
                <CardDescription>
                  Reference for available keyboard shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Shortcut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keyboardShortcuts.map((shortcut, index) => (
                      <TableRow key={index} data-testid={`row-shortcut-${index}`}>
                        <TableCell>{shortcut.action}</TableCell>
                        <TableCell className="text-right">
                          <code className="px-2 py-1 rounded bg-muted text-sm font-mono">
                            {shortcut.shortcut}
                          </code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
