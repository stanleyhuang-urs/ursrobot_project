import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { listUsers } from "@/lib/actions/user";
import { listResources } from "@/lib/actions/resource";
import { UserManagement } from "@/components/users/UserManagement";
import { ResourceManagement } from "@/components/resources/ResourceManagement";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    redirect("/boards");
  }
  const { tab } = await searchParams;
  const activeTab = tab === "resources" ? "resources" : "users";

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">使用者管理</h1>
      <div className="mb-4 flex w-fit overflow-hidden rounded-md border border-neutral-200 text-sm">
        <Link
          href="/users"
          className={`px-4 py-1.5 ${
            activeTab === "users"
              ? "bg-neutral-900 text-white"
              : "bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          使用者
        </Link>
        <Link
          href="/users?tab=resources"
          className={`px-4 py-1.5 ${
            activeTab === "resources"
              ? "bg-neutral-900 text-white"
              : "bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          資源
        </Link>
      </div>
      {activeTab === "users" ? (
        <UserManagement users={await listUsers()} currentUserId={session.userId} />
      ) : (
        <ResourceManagement resources={await listResources()} />
      )}
    </div>
  );
}
