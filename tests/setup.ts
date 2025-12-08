import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";

export const prismaMock = mockDeep<PrismaClient>();

jest.mock('@prisma/client', () => ({
    __esModule: true,
    PrismaClient: jest.fn(() => prismaMock),
}));