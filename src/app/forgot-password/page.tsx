"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotPasswordState } from "@/lib/actions/auth";

const initialState: ForgotPasswordState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-2 text-xl font-semibold text-neutral-900">忘記密碼</h1>
        <p className="mb-6 text-sm text-neutral-500">
          請輸入您的帳號 Email,我們會寄送重設密碼連結給您。
        </p>

        <label className="mb-1 block text-sm font-medium text-neutral-700">
          帳號 (Email)
        </label>
        <input
          name="email"
          type="email"
          required
          autoFocus
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />

        {state.error && <p className="mb-4 text-sm text-red-600">{state.error}</p>}
        {state.message && <p className="mb-4 text-sm text-green-700">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mb-4 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "送出中..." : "寄送重設連結"}
        </button>

        <Link href="/login" className="block text-center text-xs text-blue-600 hover:underline">
          返回登入
        </Link>
      </form>
    </div>
  );
}
