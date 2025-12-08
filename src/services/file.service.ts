import { PrismaClient } from '@prisma/client';
import cloudinary from '../config/cloudinary.config';

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
export const createFileRecord = (data: FileUploadData) => {
    return prisma.file.create({
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
};

/**
 * Deletes a file from Cloudinary and its record from the database.
 * @param fileId - The ID of the file record in our database.
 */
export const deleteFile = async (fileId: string) => {
    // First, find the file record to get its publicId for Cloudinary
    const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });

    if (!fileRecord) {
        throw new Error('File not found in the database.');
    }

    // Use a transaction to ensure both operations succeed or fail together
    return prisma.$transaction(async (tx) => {
        // 1. Delete the file from Cloudinary
        await cloudinary.uploader.destroy(fileRecord.publicId);

        // 2. Delete the file record from our database
        await tx.file.delete({ where: { id: fileId } });
    });
};