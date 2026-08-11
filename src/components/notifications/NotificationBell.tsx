"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell } from "lucide-react";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
} from "@/lib/actions/notification";

const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  ASSIGNED: "指派",
  UPDATED: "更新",
  COMMENTED: "留言",
  AUTOMATION: "自動化",
};

const POLL_INTERVAL_MS = 30000;

export function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<
    Awaited<ReturnType<typeof listNotifications>>
  >([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getUnreadCount().then(setUnreadCount);
    const interval = setInterval(() => {
      getUnreadCount().then(setUnreadCount);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setNotifications(await listNotifications());
    }
  }

  async function handleClickNotification(
    n: Awaited<ReturnType<typeof listNotifications>>[number]
  ) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    router.push(`/boards/${n.item.boardId}`);
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={handleOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="relative rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="通知"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          className="z-50 max-h-96 w-80 overflow-auto rounded-md border border-neutral-200 bg-white p-1 shadow-md"
        >
          {notifications.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-neutral-400">
              沒有通知
            </p>
          )}
          {notifications.map((n) => (
            <DropdownMenu.Item
              key={n.id}
              onSelect={() => handleClickNotification(n)}
              className={`flex cursor-pointer flex-col gap-0.5 rounded px-3 py-2 text-sm outline-none hover:bg-neutral-100 ${
                n.read ? "text-neutral-500" : "text-neutral-900"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {!n.read && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                )}
                <span className="text-xs text-neutral-400">
                  {NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}
                </span>
              </span>
              <span className="truncate">{n.message}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
