import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Eye, EyeOff, Pencil, Trash2, Key, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import type { EnvVars } from '@shared/schema';

interface EnvVarsPanelProps {
  projectId: string;
  className?: string;
}

export default function EnvVarsPanel({ projectId, className }: EnvVarsPanelProps) {
  const { toast } = useToast();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const { data: envVars = {}, isLoading } = useQuery<EnvVars>({
    queryKey: ['/api/projects', projectId, 'env'],
  });

  const setEnvVarMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await apiRequest('POST', `/api/projects/${projectId}/env`, { key, value });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'env'] });
      setIsAddDialogOpen(false);
      setEditingKey(null);
      setNewKey('');
      setNewValue('');
      toast({
        title: 'Environment variable saved',
        description: 'Your environment variable has been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save',
        description: error.message || 'Failed to save environment variable.',
        variant: 'destructive',
      });
    },
  });

  const deleteEnvVarMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await apiRequest('DELETE', `/api/projects/${projectId}/env/${encodeURIComponent(key)}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'env'] });
      setDeleteKey(null);
      toast({
        title: 'Environment variable deleted',
        description: 'The environment variable has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete',
        description: error.message || 'Failed to delete environment variable.',
        variant: 'destructive',
      });
    },
  });

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleAddNew = () => {
    setNewKey('');
    setNewValue('');
    setIsAddDialogOpen(true);
  };

  const handleEdit = (key: string) => {
    setEditingKey(key);
    setNewKey(key);
    setNewValue(envVars[key] || '');
  };

  const handleSave = () => {
    if (!newKey.trim()) {
      toast({
        title: 'Invalid key',
        description: 'Environment variable key cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    setEnvVarMutation.mutate({ key: newKey.trim(), value: newValue });
  };

  const handleDelete = () => {
    if (deleteKey) {
      deleteEnvVarMutation.mutate(deleteKey);
    }
  };

  const maskValue = (value: string) => {
    if (value.length <= 4) return '••••••••';
    return value.slice(0, 2) + '••••••' + value.slice(-2);
  };

  const envVarEntries = Object.entries(envVars);

  if (isLoading) {
    return (
      <Card className={cn('flex items-center justify-center min-h-[200px]', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" data-testid="loader-env-vars" />
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            Environment Variables
          </CardTitle>
          <Button size="sm" onClick={handleAddNew} data-testid="button-add-env-var">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {envVarEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-env-vars">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No environment variables yet</p>
              <p className="text-xs mt-1">Click Add to create your first variable</p>
            </div>
          ) : (
            envVarEntries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                data-testid={`env-var-row-${key}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium truncate" data-testid={`text-env-key-${key}`}>
                    {key}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground truncate" data-testid={`text-env-value-${key}`}>
                    {visibleKeys.has(key) ? value : maskValue(value)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleVisibility(key)}
                    data-testid={`button-toggle-visibility-${key}`}
                  >
                    {visibleKeys.has(key) ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(key)}
                    data-testid={`button-edit-${key}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteKey(key)}
                    data-testid={`button-delete-${key}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Environment Variable</DialogTitle>
            <DialogDescription>
              Add a new environment variable to your project. These will be available at runtime.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="env-key">Key</Label>
              <Input
                id="env-key"
                placeholder="MY_API_KEY"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                data-testid="input-env-key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="env-value">Value</Label>
              <Input
                id="env-value"
                placeholder="your-secret-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                data-testid="input-env-value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={setEnvVarMutation.isPending}
              data-testid="button-save-env-var"
            >
              {setEnvVarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingKey !== null} onOpenChange={(open) => !open && setEditingKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Environment Variable</DialogTitle>
            <DialogDescription>
              Update the value of your environment variable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-env-key">Key</Label>
              <Input
                id="edit-env-key"
                value={newKey}
                disabled
                className="bg-muted"
                data-testid="input-edit-env-key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-env-value">Value</Label>
              <Input
                id="edit-env-value"
                placeholder="your-secret-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                data-testid="input-edit-env-value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKey(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={setEnvVarMutation.isPending}
              data-testid="button-update-env-var"
            >
              {setEnvVarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteKey !== null} onOpenChange={(open) => !open && setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Environment Variable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-mono font-bold">{deleteKey}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteEnvVarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
