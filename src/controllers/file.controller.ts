import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as fileService from '../services/file.service';
import { isErrorWithMessage } from '../utils/error.utils';
import { MembershipRole } from '@prisma/client';
import multer from 'multer';
import logger from '../config/logger';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export const uploadFile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { chamaId } = req.params;
        const uploaderId = req.user?.id!;
        const file = req.file;

        if (!file) {
            logger.warn({ chamaId, uploaderId }, 'File upload attempted without file');
            return res.status(400).json({ message: 'No file was uploaded. Please select a file to upload.' });
        }

        const fileData = {
            filename: file.originalname,
            url: file.path,
            publicId: file.filename, 
            fileType: file.mimetype,
            size: file.size,
            category: req.body.category,
            chamaId,
            uploaderId,
        };

        const newFileRecord = await fileService.createFileRecord(fileData);
        logger.info({ 
            uploaderId, 
            chamaId, 
            fileId: newFileRecord.id, 
            filename: file.originalname, 
            fileType: file.mimetype, 
            size: file.size 
        }, 'File uploaded successfully');
        res.status(201).json({ message: 'File uploaded successfully.', data: newFileRecord });

    } catch (error) {
        if (error instanceof multer.MulterError) {
            logger.warn({ error, chamaId: req.params.chamaId, uploaderId: req.user?.id }, 'Multer file upload error');
            return res.status(400).json({ message: `File upload error: ${error.message}` });
        }
        if (isErrorWithMessage(error)) {
            if (error.message.includes('File type not supported')) {
                logger.warn({ error, chamaId: req.params.chamaId, uploaderId: req.user?.id }, 'Unsupported file type');
                return res.status(415).json({ message: error.message });
            }
            logger.error({ error, chamaId: req.params.chamaId, uploaderId: req.user?.id }, 'File upload error');
            return res.status(500).json({ message: error.message });
        }
        logger.error({ error, chamaId: req.params.chamaId, uploaderId: req.user?.id }, 'File upload error');
        res.status(500).json({ message: 'An unexpected error occurred during file upload. This could be a network issue.' });
    }
};

export const getChamaFiles = async (req: Request, res: Response) => {
    try {
        // Permission handled by middleware in routes
        const { chamaId } = req.params;
        const files = await prisma.file.findMany({
            where: { chamaId },
            orderBy: { uploadedAt: 'desc' },
            include: { uploader: { select: { firstName: true, lastName: true }}}
        });
        logger.info({ chamaId, fileCount: files.length }, 'Chama files fetched');
        res.status(200).json({ data: files });
    } catch (error) {
        logger.error({ error, chamaId: req.params.chamaId }, 'Get chama files error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getFileDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id!;
        const file = await prisma.file.findUnique({ where: { id } });
        if (!file) {
            logger.warn({ fileId: id, actorId }, 'File not found');
            return res.status(404).json({ message: 'File not found.' });
        }

        // Permission check: User must be a member of the file's chama to view it
        const membership = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: file.chamaId }
        });
        if (!membership) {
            logger.warn({ fileId: id, actorId, chamaId: file.chamaId }, 'Permission denied: Not a member of chama');
            return res.status(403).json({ message: "Permission Denied: You are not a member of the chama this file belongs to." });
        }

        logger.info({ fileId: id, actorId, chamaId: file.chamaId }, 'File details fetched');
        res.status(200).json({ data: file });
    } catch (error) {
        logger.error({ error, fileId: req.params.id, actorId: req.user?.id }, 'Get file details error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const deleteFile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id!;
        const file = await prisma.file.findUnique({ where: { id } });
        if (!file) {
            logger.warn({ fileId: id, actorId }, 'File not found for deletion');
            return res.status(404).json({ message: 'File not found.' });
        }
        // Permission check: User must be an Admin/Secretary of the file's chama to delete it
        const membership = await prisma.membership.findFirst({
            where: {
                userId: actorId,
                chamaId: file.chamaId,
                role: { in: [MembershipRole.ADMIN, MembershipRole.SECRETARY] }
            }
        });
        if (!membership) {
            logger.warn({ fileId: id, actorId, chamaId: file.chamaId }, 'Permission denied: Not admin or secretary');
            return res.status(403).json({ message: "Permission Denied: Only an Admin or Secretary can delete files." });
        }
        await fileService.deleteFile(id);
        logger.info({ fileId: id, actorId, chamaId: file.chamaId, filename: file.filename }, 'File deleted successfully');
        res.status(200).json({ message: 'File deleted successfully.' });
    } catch (error) {
        if (isErrorWithMessage(error)) {
            logger.error({ error, fileId: req.params.id, actorId: req.user?.id }, 'Delete file error');
            return res.status(500).json({ message: error.message });
        }
        logger.error({ error, fileId: req.params.id, actorId: req.user?.id }, 'Delete file error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};