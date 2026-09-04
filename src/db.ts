import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function initDb() {
  await prisma.$connect();
}
