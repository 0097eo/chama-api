import { PrismaClient } from '@prisma/client';

// This file uses "declaration merging" to add custom properties to the Express namespace.
declare global {
  namespace Express {
    // This interface adds properties directly to the main Request object.
    export interface Request {
      user?: { id: string };
      prisma?: PrismaClient;
    }

    // This augments the Multer namespace specifically for the File object.
    namespace Multer {
      export interface File {
        // These properties are added by the multer-storage-cloudinary package.
        // We are telling TypeScript that they will exist on the req.file object.
        public_id: string;
        path: string; // The `secure_url` from Cloudinary is aliased to `path` by the storage engine.
      }
    }
  }
}