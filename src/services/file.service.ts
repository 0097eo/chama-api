import { PrismaClient } from '@prisma/client';
import cloudinary from '../config/cloudinary.config';
import logger from '../config/logger';

const prisma = new PrismaClient();

interface FileUploadData {
    filename: string;
    url: string;
    publicId: string;
    fileType: string;
    size: number;
    category?: string;
    chamaId: string;
    uploaderId: string;
}

/**
 * Creates a file metadata record in the database.
 */
export const createFileRecord = async (data: FileUploadData) => {
    logger.info({ 
        filename: data.filename, 
        fileType: data.fileType, 
        size: data.size, 
        chamaId: data.chamaId, 
        uploaderId: data.uploaderId 
    }, 'Creating file record');

    const fileRecord = await prisma.file.create({
        data: {
            filename: data.filename,
            url: data.url,
            publicId: data.publicId,
            fileType: data.fileType,
            size: data.size,
            category: data.category,
            chamaId: data.chamaId,
            uploaderId: data.uploaderId,
        }
    });

    logger.info({ fileId: fileRecord.id, filename: data.filename, chamaId: data.chamaId }, 'File record created successfully');

    return fileRecord;
};

/**
 * Deletes a file from Cloudinary and its record from the database.
 * @param fileId - The ID of the file record in our database.
 */
export const deleteFile = async (fileId: string) => {
    logger.info({ fileId }, 'Deleting file');

    // First, find the file record to get its publicId for Cloudinary
    const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });

    if (!fileRecord) {
        logger.warn({ fileId }, 'File not found in database');
        throw new Error('File not found in the database.');
    }

    logger.info({ fileId, publicId: fileRecord.publicId, filename: fileRecord.filename }, 'Found file record, proceeding with deletion');

    // Use a transaction to ensure both operations succeed or fail together
    await prisma.$transaction(async (tx) => {
        // 1. Delete the file from Cloudinary
        await cloudinary.uploader.destroy(fileRecord.publicId);
        logger.info({ fileId, publicId: fileRecord.publicId }, 'File deleted from Cloudinary');

        // 2. Delete the file record from our database
        await tx.file.delete({ where: { id: fileId } });
        logger.info({ fileId }, 'File record deleted from database');
    });

    logger.info({ fileId, filename: fileRecord.filename }, 'File deleted successfully');
};