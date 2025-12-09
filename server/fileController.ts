import { Router, Request, Response } from 'express';
import * as fsAdapter from './fsAdapter';
import * as projectScanner from './projectScanner';

const router = Router();

router.get('/list', async (req: Request, res: Response) => {
  try {
    const dirPath = (req.query.path as string) || '.';
    const tree = await projectScanner.scanProject({
      rootPath: fsAdapter.getWorkspaceRoot(),
      includeContent: false,
      maxDepth: 10,
      maxFiles: 500,
    });
    res.json({ success: true, tree });
  } catch (error: any) {
    console.error('Error listing files:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to list files' 
    });
  }
});

router.get('/tree', async (req: Request, res: Response) => {
  try {
    const dirPath = (req.query.path as string) || '.';
    const includeContent = req.query.content === 'true';
    
    const tree = await projectScanner.scanProject({
      rootPath: fsAdapter.getWorkspaceRoot(),
      includeContent,
      maxDepth: 10,
      maxFiles: 500,
    });
    
    res.json({ success: true, tree });
  } catch (error: any) {
    console.error('Error getting file tree:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get file tree' 
    });
  }
});

router.get('/read', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    
    if (!filePath) {
      return res.status(400).json({ 
        success: false, 
        error: 'File path is required' 
      });
    }
    
    const file = await fsAdapter.readFile(filePath);
    res.json({ success: true, ...file });
  } catch (error: any) {
    console.error('Error reading file:', error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ 
        success: false, 
        error: 'File not found' 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to read file' 
    });
  }
});

router.post('/write', async (req: Request, res: Response) => {
  try {
    const { path: filePath, content } = req.body;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'File path is required' 
      });
    }
    
    if (typeof content !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Content must be a string' 
      });
    }
    
    await fsAdapter.writeFile(filePath, content);
    res.json({ success: true, path: filePath, message: 'File written successfully' });
  } catch (error: any) {
    console.error('Error writing file:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to write file' 
    });
  }
});

router.delete('/delete', async (req: Request, res: Response) => {
  try {
    const filePath = req.body.path || req.query.path;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'File path is required' 
      });
    }
    
    await fsAdapter.deleteFile(filePath);
    res.json({ success: true, path: filePath, message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ 
        success: false, 
        error: 'File not found' 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to delete file' 
    });
  }
});

router.post('/mkdir', async (req: Request, res: Response) => {
  try {
    const { path: folderPath } = req.body;
    
    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Folder path is required' 
      });
    }
    
    await fsAdapter.createFolder(folderPath);
    res.json({ success: true, path: folderPath, message: 'Folder created successfully' });
  } catch (error: any) {
    console.error('Error creating folder:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create folder' 
    });
  }
});

router.post('/rename', async (req: Request, res: Response) => {
  try {
    const { oldPath, newPath } = req.body;
    
    if (!oldPath || typeof oldPath !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Old path is required' 
      });
    }
    
    if (!newPath || typeof newPath !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'New path is required' 
      });
    }
    
    await fsAdapter.rename(oldPath, newPath);
    res.json({ success: true, oldPath, newPath, message: 'Renamed successfully' });
  } catch (error: any) {
    console.error('Error renaming:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to rename' 
    });
  }
});

router.get('/exists', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    
    if (!filePath) {
      return res.status(400).json({ 
        success: false, 
        error: 'File path is required' 
      });
    }
    
    const exists = await fsAdapter.fileExists(filePath);
    res.json({ success: true, path: filePath, exists });
  } catch (error: any) {
    console.error('Error checking file exists:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to check file existence' 
    });
  }
});

export default router;
