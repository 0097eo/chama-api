import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';
import * as fileService from '../services/file.service';
import { isErrorWithMessage } from '../utils/error.utils';
import { MembershipRole } from '../generated/prisma/client';
import multer from 'multer';

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
            // This case handles when the user submits the form without attaching any file.
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
        res.status(201).json({ message: 'File uploaded successfully.', data: newFileRecord });

    } catch (error) {
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ message: `File upload error: ${error.message}` });
        }
        if (isErrorWithMessage(error)) {
            if (error.message.includes('File type not supported')) {
                return res.status(415).json({ message: error.message });
            }
            return res.status(500).json({ message: error.message });
        }
        console.error('File Upload Error:', error);
        res.status(500).json({ message: 'An unexpected error occurred during file upload. This could be a network issue.' });
    }
};

export const getChamaFiles = async (req: Request, res: Response) => {
    // Permission handled by middleware in routes
    const { chamaId } = req.params;
    const files = await prisma.file.findMany({
        where: { chamaId },
        orderBy: { uploadedAt: 'desc' },
        include: { uploader: { select: { firstName: true, lastName: true }}}
    });
    res.status(200).json({ data: files });
};

export const getFileDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id!;
        const file = await prisma.file.findUnique({ where: { id } });
        if (!file) {
            return res.status(404).json({ message: 'File not found.' });
        }

        // Permission check: User must be a member of the file's chama to view it
        const membership = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: file.chamaId }
        });
        if (!membership) {
            return res.status(403).json({ message: "Permission Denied: You are not a member of the chama this file belongs to." });
        }

        res.status(200).json({ data: file });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const deleteFile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id!;
        const file = await prisma.file.findUnique({ where: { id } });
        if (!file) {
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
            return res.status(403).json({ message: "Permission Denied: Only an Admin or Secretary can delete files." });
        }
        await fileService.deleteFile(id);
        res.status(200).json({ message: 'File deleted successfully.' });
    } catch (error) {
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};