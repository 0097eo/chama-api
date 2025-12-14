import { Prisma, PrismaClient, User } from '@prisma/client';
import { createAuditLog } from './audit.service';
import { sendInvitationEmail } from './notification.service';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import logger from '../config/logger'; // Import Pino logger

const prisma = new PrismaClient();

/**
 * Gets a paginated list of all non-deleted users.
 * @param page - The page number for pagination.
 * @param limit - The number of users per page.
 * @returns An object containing the list of users and pagination metadata.
 */
export const getAllUsers = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const users = await prisma.user.findMany({
    where: { deletedAt: null }, // Exclude soft-deleted users
    skip,
    take: limit,
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, createdAt: true },
  });
  const totalRecords = await prisma.user.count({ where: { deletedAt: null } });
  logger.info({ page, limit, totalRecords, userCount: users.length }, 'Users fetched');
  return { users, totalRecords, totalPages: Math.ceil(totalRecords / limit) };
};

/**
 * Gets a single user by their ID, ensuring they are not soft-deleted.
 * @param id - The ID of the user to retrieve.
 * @returns The user object or null if not found.
 */
export const getUserById = async (id: string) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, email: true, phone: true, firstName: true, lastName: true, idNumber: true, role: true, createdAt: true },
  });
  
  if (user) {
    logger.debug({ userId: id }, 'User fetched by ID');
  } else {
    logger.warn({ userId: id }, 'User not found or deleted');
  }
  
  return user;
};

/**
 * Updates a user's information and creates an audit log. (Admin only)
 * @param adminUserId - The ID of the admin performing the update.
 * @param targetUserId - The ID of the user being updated.
 * @param data - The new data for the user.
 * @returns The updated user object.
 */
export const updateUser = async (adminUserId: string, targetUserId: string, data: Partial<User>) => {
  const userToUpdate = await getUserById(targetUserId);
  if (!userToUpdate) {
    logger.warn({ adminUserId, targetUserId }, 'User not found for update');
    throw new Error('User not found or has been deleted.');
  }

  // Prevent password updates through this endpoint for security
  const { password, phone, ...updateData } = data;

  if (phone) {
    const phoneNumber = parsePhoneNumberFromString(phone, 'KE');
    if (phoneNumber && phoneNumber.isValid()) {
      // Add the normalized phone number to the data we will save.
      (updateData as any).phone = phoneNumber.format('E.164');
    } else {
      logger.warn({ adminUserId, targetUserId, phone }, 'Invalid phone number format');
      throw new Error('Invalid phone number format provided.');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: updateData,
  });

  logger.info({ adminUserId, targetUserId, updates: Object.keys(updateData) }, 'User updated');

  // Create an audit log of the change
  await createAuditLog({
    action: 'USER_UPDATE',
    // Change 'userId' to 'actorId' to match the interface
    actorId: adminUserId,
    targetId: targetUserId,
    oldValue: userToUpdate,
    newValue: updatedUser,
  });

  return updatedUser;
};

/**
 * Soft deletes a user by setting the `deletedAt` field and creates an audit log. (Admin only)
 * @param adminUserId - The ID of the admin performing the delete.
 * @param targetUserId - The ID of the user being deleted.
 */
export const softDeleteUser = async (adminUserId: string, targetUserId: string) => {
  const userToDelete = await getUserById(targetUserId);
  if (!userToDelete) {
    logger.warn({ adminUserId, targetUserId }, 'User not found for deletion');
    throw new Error('User not found or has already been deleted.');
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { deletedAt: new Date() },
  });

  logger.info({ adminUserId, targetUserId }, 'User soft deleted');

  // Create an audit log of the deletion
  await createAuditLog({
    action: 'USER_DELETE',
    // Change 'userId' to 'actorId' to match the interface
    actorId: adminUserId,
    targetId: targetUserId,
    oldValue: userToDelete,
  });
};

/**
 * Sends an invitation email to a prospective user.
 * @param inviter - The full user object of the person sending the invite.
 * @param inviteeEmail - The email address of the person being invited.
 */
export const inviteUser = async (inviter: User, inviteeEmail: string) => {
  const inviterName = `${inviter.firstName} ${inviter.lastName}`;
  await sendInvitationEmail(inviteeEmail, inviterName); // This would call the notification service
  logger.info({ inviteeEmail, inviterName }, `Pretending to send an invitation email to ${inviteeEmail} from ${inviterName}`);

  // Note: We would create an audit log here if the invitation created a unique,
  // one-time token in the database. For a simple email, it's not necessary.
};

/**
 * Searches for users based on a query string, with pagination.
 * @param query - The search term (name, email, phone).
 * @param page - The page number for pagination.
 * @param limit - The number of results per page.
 * @returns An object containing the list of found users and pagination metadata.
 */
export const searchUsers = async (query: string, page: number, limit: number) => {
    const skip = (page - 1) * limit;
    const searchFilter: Prisma.UserWhereInput = {
        deletedAt: null, // Only search active users
        OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
        ],
    };

    const users = await prisma.user.findMany({
        where: searchFilter,
        skip,
        take: limit,
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
    });
    
    const totalRecords = await prisma.user.count({ where: searchFilter });
    
    logger.info({ query, page, limit, totalRecords, resultCount: users.length }, 'Users searched');
    
    return { users, totalRecords, totalPages: Math.ceil(totalRecords / limit) };
};