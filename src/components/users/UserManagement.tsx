"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { createUser, updateUserSupervisor, listUsers } from "@/lib/actions/user";
import type { UserRole } from "@prisma/client";

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

export function UserManagement({ users }: { users: UserRow[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("MEMBER");
  const [supervisorId, setSupervisorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const supervisors = users.filter((u) => u.role === "SUPERVISOR");

  function reset() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("MEMBER");
    setSupervisorId("");
    setError(null);
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      await createUser(name, email, password, role, supervisorId || null);
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={14} /> 新增使用者
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div className="grid grid-cols-[1fr_1fr_90px_140px_160px] gap-2 border-b border-neutral-100 px-4 py-2 text-xs font-medium text-neutral-500">
          <span>姓名</span>
          <span>Email</span>
          <span>角色</span>
          <span>建立時間</span>
          <span>所屬主管</span>
        </div>
        {users.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-[1fr_1fr_90px_140px_160px] items-center gap-2 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
          >
            <span className="truncate text-neutral-800">{u.name}</span>
            <span className="truncate text-neutral-500">{u.email}</span>
            <span className="text-neutral-500">
              {u.role === "ADMIN" ? "管理者" : u.role === "SUPERVISOR" ? "主管" : "團隊成員"}
            </span>
            <span className="text-neutral-400">
              {new Date(u.createdAt).toLocaleDateString("zh-TW")}
            </span>
            {u.role === "MEMBER" ? (
              <select
                value={u.supervisorId ?? ""}
                onChange={(e) => updateUserSupervisor(u.id, e.target.value || null)}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
              >
                <option value="">未設定</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-neutral-300">—</span>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
        title="新增使用者"
      >
        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="姓名"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密碼(至少 8 個字元)"
            type="password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="MEMBER">團隊成員</option>
            <option value="SUPERVISOR">主管</option>
            <option value="ADMIN">管理者</option>
          </select>
          {role === "MEMBER" && (
            <select
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">所屬主管(未設定)</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={submitting || !name.trim() || !email.trim() || !password}
            onClick={handleCreate}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "新增中..." : "新增"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
