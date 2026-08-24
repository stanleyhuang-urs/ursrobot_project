"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword, type ResetPasswordState } from "@/lib/actions/auth";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, pending] = useActionState(resetPassword, initialState);

  if (state.success) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-neutral-900">密碼已重設</h1>
        <p className="mb-6 text-sm text-neutral-500">您的密碼已更新,請使用新密碼登入。</p>
        <Link
          href="/login"
          className="block w-full rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          前往登入
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
    >
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">重設密碼</h1>

      <input type="hidden" name="token" value={token} />

      {!token && (
        <p className="mb-4 text-sm text-red-600">連結缺少必要參數,請重新申請忘記密碼。</p>
      )}

      <label className="mb-1 block text-sm font-medium text-neutral-700">新密碼</label>
      <input
        name="password"
        type="password"
        required
        autoFocus
        className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />

      <label className="mb-1 block text-sm font-medium text-neutral-700">確認新密碼</label>
      <input
        name="confirmPassword"
        type="password"
        required
        className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />

      {state.error && <p className="mb-4 text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || !token}
        className="mb-4 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "重設中..." : "重設密碼"}
      </button>

      <Link href="/login" className="block text-center text-xs text-blue-600 hover:underline">
        返回登入
      </Link>
    </form>
  );
}
