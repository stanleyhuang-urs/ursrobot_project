"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function listResources() {
  await requireSession();
  return prisma.resource.findMany({ orderBy: { order: "asc" } });
}

export async function createResource(
  name: string,
  category: string | null,
  contact: string | null,
  note: string | null
) {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    throw new Error("只有管理員可以新增資源");
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("名稱為必填");
  }

  const maxOrder = await prisma.resource.aggregate({ _max: { order: true } });
  await prisma.resource.create({
    data: {
      name: trimmedName,
      category: category?.trim() || null,
      contact: contact?.trim() || null,
      note: note?.trim() || null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath("/users");
}

export async function updateResource(
  resourceId: string,
  name: string,
  category: string | null,
  contact: string | null,
  note: string | null
) {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    throw new Error("只有管理員可以修改資源");
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("名稱為必填");
  }

  await prisma.resource.update({
    where: { id: resourceId },
    data: {
      name: trimmedName,
      category: category?.trim() || null,
      contact: contact?.trim() || null,
      note: note?.trim() || null,
    },
  });

  revalidatePath("/users");
}

export async function deleteResource(resourceId: string) {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    throw new Error("只有管理員可以刪除資源");
  }

  await prisma.resource.delete({ where: { id: resourceId } });

  revalidatePath("/users");
}

export async function reorderResources(orderedResourceIds: string[]) {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    throw new Error("只有管理員可以調整資源順序");
  }

  await prisma.$transaction(
    orderedResourceIds.map((id, index) =>
      prisma.resource.update({ where: { id }, data: { order: index } })
    )
  );

  revalidatePath("/users");
}
