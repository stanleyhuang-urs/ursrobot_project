"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { UserRole } from "@prisma/client";

export async function listUsers() {
  await requireSession();
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  role: UserRole
) {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    throw new Error("只有管理員可以新增使用者");
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName || !trimmedEmail || !password) {
    throw new Error("姓名、Email、密碼皆為必填");
  }
  if (password.length < 8) {
    throw new Error("密碼至少需要 8 個字元");
  }

  const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
  if (existing) {
    throw new Error("此 Email 已被使用");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name: trimmedName, email: trimmedEmail, passwordHash, role },
  });

  revalidatePath("/users");
}
