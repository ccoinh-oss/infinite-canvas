"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { App } from "antd";

import { createModelChannel, normalizeBaseUrl, useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const { message } = App.useApp();
    const handledConfigParams = useRef(false);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const config = useConfigStore((state) => state.config);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const refreshSession = useUserStore((state) => state.refreshSession);

    useEffect(() => {
        void refreshSession().catch(() => undefined);
    }, [refreshSession]);

    useEffect(() => {
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        const channels = config.channels.map((channel) => ({ ...channel, baseUrl: normalizeBaseUrl(channel.baseUrl) }));
        if (baseUrl !== config.baseUrl) updateConfig("baseUrl", baseUrl);
        if (channels.some((channel, index) => channel.baseUrl !== config.channels[index]?.baseUrl)) updateConfig("channels", channels);
    }, [config.baseUrl, config.channels, updateConfig]);

    useEffect(() => {
        if (handledConfigParams.current) return;
        const searchParams = new URLSearchParams(window.location.search);
        const baseUrl = normalizeBaseUrl(searchParams.get("baseUrl") || searchParams.get("baseurl") || "");
        const apiKey = searchParams.get("apiKey") || searchParams.get("apikey");
        if (!baseUrl && !apiKey) return;
        handledConfigParams.current = true;
        searchParams.delete("baseUrl");
        searchParams.delete("baseurl");
        searchParams.delete("apiKey");
        searchParams.delete("apikey");
        window.history.replaceState(null, "", `${window.location.pathname}${searchParams.size ? `?${searchParams}` : ""}${window.location.hash}`);
        const firstChannel = config.channels[0];
        updateConfig(
            "channels",
            firstChannel
                ? config.channels.map((channel, index) =>
                      index === 0
                          ? {
                                ...channel,
                                ...(baseUrl ? { baseUrl } : {}),
                                ...(apiKey ? { apiKey } : {}),
                            }
                          : channel,
                  )
                : [createModelChannel({ id: "default", name: "默认渠道", baseUrl: baseUrl || undefined, apiKey: apiKey || "" })],
        );
        if (baseUrl) updateConfig("baseUrl", baseUrl);
        if (apiKey) updateConfig("apiKey", apiKey);
        openConfigDialog(false);
        message.success("已导入本地直连配置");
    }, [config.channels, message, openConfigDialog, updateConfig]);

    return <>{children}</>;
}
