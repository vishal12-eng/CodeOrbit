import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { FileNode } from '@/lib/types';

interface FileTreeResponse {
  success: boolean;
  tree: FileNode;
  error?: string;
}

interface FileContentResponse {
  success: boolean;
  path: string;
  content: string;
  error?: string;
}

interface FileOperationResponse {
  success: boolean;
  path?: string;
  message?: string;
  error?: string;
}

export function useRealFileSystem() {
  const queryClient = useQueryClient();
  
  const { data: fileTree, isLoading, error, refetch } = useQuery<FileTreeResponse>({
    queryKey: ['/api/files/tree'],
    refetchInterval: false,
    staleTime: 5000,
  });

  const refreshTree = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/files/tree'] });
    await refetch();
  }, [queryClient, refetch]);

  const readFileMutation = useMutation({
    mutationFn: async (filePath: string): Promise<FileContentResponse> => {
      const response = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
      return response.json();
    },
  });

  const writeFileMutation = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }): Promise<FileOperationResponse> => {
      const res = await apiRequest('POST', '/api/files/write', { path, content });
      return res.json();
    },
    onSuccess: () => {
      refreshTree();
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (path: string): Promise<FileOperationResponse> => {
      const res = await apiRequest('DELETE', '/api/files/delete', { path });
      return res.json();
    },
    onSuccess: () => {
      refreshTree();
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (path: string): Promise<FileOperationResponse> => {
      const res = await apiRequest('POST', '/api/files/mkdir', { path });
      return res.json();
    },
    onSuccess: () => {
      refreshTree();
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ oldPath, newPath }: { oldPath: string; newPath: string }): Promise<FileOperationResponse> => {
      const res = await apiRequest('POST', '/api/files/rename', { oldPath, newPath });
      return res.json();
    },
    onSuccess: () => {
      refreshTree();
    },
  });

  const readFile = useCallback(async (path: string): Promise<string> => {
    const result = await readFileMutation.mutateAsync(path);
    if (result.success) {
      return result.content;
    }
    throw new Error(result.error || 'Failed to read file');
  }, [readFileMutation]);

  const writeFile = useCallback(async (path: string, content: string): Promise<void> => {
    const result = await writeFileMutation.mutateAsync({ path, content });
    if (!result.success) {
      throw new Error(result.error || 'Failed to write file');
    }
  }, [writeFileMutation]);

  const deleteFile = useCallback(async (path: string): Promise<void> => {
    const result = await deleteFileMutation.mutateAsync(path);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete file');
    }
  }, [deleteFileMutation]);

  const createFolder = useCallback(async (path: string): Promise<void> => {
    const result = await createFolderMutation.mutateAsync(path);
    if (!result.success) {
      throw new Error(result.error || 'Failed to create folder');
    }
  }, [createFolderMutation]);

  const rename = useCallback(async (oldPath: string, newPath: string): Promise<void> => {
    const result = await renameMutation.mutateAsync({ oldPath, newPath });
    if (!result.success) {
      throw new Error(result.error || 'Failed to rename');
    }
  }, [renameMutation]);

  return {
    fileTree: fileTree?.tree || null,
    isLoading,
    error,
    refreshTree,
    readFile,
    writeFile,
    deleteFile,
    createFolder,
    rename,
    isWriting: writeFileMutation.isPending,
    isDeleting: deleteFileMutation.isPending,
  };
}

export function useFileTreeRefresh() {
  const queryClient = useQueryClient();
  
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/files/tree'] });
  }, [queryClient]);

  return { refresh };
}
