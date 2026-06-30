"use client";

import { create } from "zustand";

export type LocalUser = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
};

type UserStore = {
    user: LocalUser | null;
    localDataNotice: string;
    setSession: (user: Omit<LocalUser, "avatarUrl">, localDataNotice?: string) => void;
    updateAccount: (values: { username?: string; displayName?: string; currentPassword?: string; newPassword?: string }) => Promise<string>;
    refreshSession: () => Promise<void>;
    logout: () => Promise<void>;
    clearSession: () => void;
};

export const useUserStore = create<UserStore>()((set) => ({
    user: null,
    localDataNotice: "画布、素材、生成记录和 AI API Key 仅保存在当前浏览器本地。",
    setSession: (user, localDataNotice) =>
        set({
            user: { ...user, avatarUrl: "" },
            ...(localDataNotice ? { localDataNotice } : {}),
        }),
    updateAccount: async (values) => {
        const response = await fetch("/api/auth/account", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(values),
        });
        const payload = (await response.json()) as { data?: { user?: Omit<LocalUser, "avatarUrl">; localDataNotice?: string }; msg?: string };
        if (!response.ok || !payload.data?.user) throw new Error(payload.msg || "账号配置更新失败");
        set({
            user: { ...payload.data.user, avatarUrl: "" },
            ...(payload.data.localDataNotice ? { localDataNotice: payload.data.localDataNotice } : {}),
        });
        return payload.msg || "账号配置已更新";
    },
    refreshSession: async () => {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = (await response.json()) as { data?: { user?: Omit<LocalUser, "avatarUrl"> | null; localDataNotice?: string } };
        set({
            user: payload.data?.user ? { ...payload.data.user, avatarUrl: "" } : null,
            ...(payload.data?.localDataNotice ? { localDataNotice: payload.data.localDataNotice } : {}),
        });
    },
    logout: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        set({ user: null });
    },
    clearSession: () => set({ user: null }),
}));
