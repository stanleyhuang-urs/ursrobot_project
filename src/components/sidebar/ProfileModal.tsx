"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { fileToAvatarDataUrl } from "@/lib/avatarImage";
import { updateOwnAvatar, updateOwnPassword } from "@/lib/actions/user";

export function ProfileModal({
  userName,
  avatarUrl,
  open,
  onOpenChange,
}: {
  userName: string;
  avatarUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Resync the preview when the modal is reopened with fresh server data,
  // without fighting an upload already in progress — adjusted during
  // render, not an effect, same pattern used elsewhere in this codebase.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPreviewAvatarUrl(avatarUrl);
      setAvatarError(null);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordError(null);
      setPasswordSuccess(false);
    }
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setAvatarError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await updateOwnAvatar(dataUrl);
      setPreviewAvatarUrl(dataUrl);
      router.refresh();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "上傳頭像失敗");
    } finally {
      setUploading(false);
    }
  }

  async function handlePasswordChange() {
    setChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);
    try {
      await updateOwnPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess(true);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "更新密碼失敗");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="個人資料">
      <div className="mb-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative shrink-0 rounded-full outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
          aria-label="更換照片"
        >
          <Avatar name={userName} avatarUrl={previewAvatarUrl} size={64} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarFileChange}
          className="hidden"
        />
        <div>
          <p className="text-sm font-medium text-neutral-900">{userName}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            {uploading ? "上傳中..." : "更換照片"}
          </button>
        </div>
      </div>
      {avatarError && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{avatarError}</div>
      )}

      <div className="border-t border-neutral-100 pt-4">
        <p className="mb-2 text-xs font-medium text-neutral-500">變更密碼</p>
        {passwordError && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{passwordError}</div>
        )}
        {passwordSuccess && (
          <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">密碼已更新</div>
        )}
        <div className="space-y-2">
          <input
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="目前密碼"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新密碼(至少 8 個字元)"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="button"
            disabled={changingPassword || !currentPassword || newPassword.length < 8}
            onClick={handlePasswordChange}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {changingPassword ? "更新中..." : "更新密碼"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
