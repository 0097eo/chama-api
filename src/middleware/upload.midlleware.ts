import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.config';
import { Request } from 'express';
import path from 'path';

// --- Cloudinary Storage for Constitution Documents (PDF/DOC) ---
const constitutionStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: Request, file: Express.Multer.File) => {
    const folderPath = `chamas/${req.body.name || 'constitutions'}`;
    return {
      folder: folderPath,
      allowed_formats: ['pdf', 'doc', 'docx'],
    };
  },
});

export const uploadConstitution = multer({
  storage: constitutionStorage,
  limits: { fileSize: 1024 * 1024 * 5 }, // 5 MB
});


// --- Local Memory Storage for CSV Import ---
// We just need to read the file content (buffer) in the controller.
const csvStorage = multer.memoryStorage();

const csvFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isCsv = file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv';
  if (isCsv) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV files are allowed for bulk import.'));
  }
};

export const uploadCsv = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: { fileSize: 1024 * 1024 * 2 }, // 2 MB limit for CSV files
});