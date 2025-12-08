import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "../src/generated/prisma";

export const prismaMock = mockDeep<PrismaClient>();

jest.mock('../src/generated/prisma', () => ({
    __esModule: true,
    PrismaClient: jest.fn(() => prismaMock),
}));