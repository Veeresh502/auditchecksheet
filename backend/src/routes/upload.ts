import { Router, Response } from 'express';
import { AuthRequest } from '../types/index';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// POST /api/upload
router.post('/', authenticateToken, upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    console.log('--- Upload Route Hit ---');
    console.log('Headers:', req.headers);
    console.log('File:', req.file);
    console.log('Body:', req.body);

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Return the URL that the frontend can use to access the file
    // Example: /uploads/1709999-random.jpg
    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      message: 'File uploaded successfully',
      url: fileUrl,
      filename: req.file.filename
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;