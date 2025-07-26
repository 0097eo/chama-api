import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.config';
import { Request } from 'express';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: Request, file: Express.Multer.File) => {
    // use req.user.id or chama name to create a folder structure
    const folderPath = `chamas/${req.body.name || 'constitutions'}`;
    
    return {
      folder: folderPath,
      // public_id: `constitution-${Date.now()}`, // Optional: define a public_id
      allowed_formats: ['pdf', 'doc', 'docx'],
      transformation: [{ quality: 'auto' }],
    };
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // 5 MB file size limit
});

export default upload;