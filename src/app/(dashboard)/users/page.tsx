import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { listUsers } from "@/lib/actions/user";
import { UserManagement } from "@/components/users/UserManagement";

export default async function UsersPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    redirect("/boards");
  }

  const users = await listUsers();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">使用者管理</h1>
      <UserManagement users={users} />
    </div>
  );
}
