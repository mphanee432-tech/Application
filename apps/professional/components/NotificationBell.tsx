"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  createBrowserSupabaseClient,
  fetchUserNotifications,
  getCurrentUser,
} from "@repo/db";

export function NotificationBell() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    async function init() {
      try {
        const user = await getCurrentUser(supabase);
        if (!user || !isMounted) return;

        const res = await fetchUserNotifications(supabase);
        if (res.success && res.data && isMounted) {
          const unread = res.data.filter((n: any) => !n.is_read).length;
          setUnreadCount(unread);
        }

        // Realtime subscription: chain .on() BEFORE .subscribe()
        const channelName = `pro-notifs-${user.id}-${Date.now()}`;
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            async (payload: any) => {
              if (!isMounted) return;
              if (payload.eventType === "INSERT") {
                setUnreadCount((c) => c + 1);
              }
              const refreshed = await fetchUserNotifications(supabase);
              if (refreshed.success && refreshed.data && isMounted) {
                const unread = refreshed.data.filter((n: any) => !n.is_read).length;
                setUnreadCount(unread);
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "chat_messages",
            },
            (payload: any) => {
              if (!isMounted) return;
              if (payload.new && payload.new.sender_id !== user.id) {
                setUnreadCount((c) => c + 1);
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "ticket_replies",
            },
            (payload: any) => {
              if (!isMounted) return;
              if (payload.new && payload.new.sender_id !== user.id) {
                setUnreadCount((c) => c + 1);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error("Pro NotificationBell init error:", err);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  return (
    <Link
      href="/notifications"
      className="relative flex items-center justify-center p-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 transition-colors"
      title="Notifications & Broadcasts"
    >
      <Bell className="h-4 w-4 text-emerald-400" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-900 animate-pulse">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export default NotificationBell;

