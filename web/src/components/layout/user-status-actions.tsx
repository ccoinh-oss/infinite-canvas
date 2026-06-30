"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Keyboard, LogOut, Settings2, UserCog, UserRound } from "lucide-react";
import { App, Form, Input, Modal } from "antd";
import { useRouter } from "next/navigation";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { VersionReleaseModal } from "@/components/layout/version-release-modal";
import { canvasThemes } from "@/lib/canvas-theme";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";

type UserStatusActionsProps = {
    showConfig?: boolean;
    variant?: "default" | "canvas";
    onOpenShortcuts?: () => void;
};

type AccountFormValues = {
    username: string;
    currentPassword?: string;
    newPassword?: string;
};

export function UserStatusActions({ showConfig = true, variant = "default", onOpenShortcuts }: UserStatusActionsProps) {
    const router = useRouter();
    const { message } = App.useApp();
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const user = useUserStore((state) => state.user);
    const logout = useUserStore((state) => state.logout);
    const updateAccount = useUserStore((state) => state.updateAccount);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const [accountOpen, setAccountOpen] = useState(false);
    const [savingAccount, setSavingAccount] = useState(false);
    const [form] = Form.useForm<AccountFormValues>();
    const canvasTheme = canvasThemes[theme];
    const naturalIconClass =
        variant === "canvas"
            ? "inline-flex size-8 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white [&_svg]:size-4"
            : "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-950/[0.05] hover:text-stone-950 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white [&_svg]:size-4";
    const accountButtonClass =
        variant === "canvas"
            ? "hidden max-w-32 items-center gap-1 truncate px-1 text-xs text-stone-500 sm:inline-flex dark:text-stone-400"
            : "hidden max-w-32 items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs text-stone-500 transition hover:bg-stone-950/[0.05] hover:text-stone-900 sm:inline-flex dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white";
    const versionButtonClass =
        variant === "canvas"
            ? "shrink-0 cursor-pointer text-xs font-medium text-stone-500 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-white"
            : "inline-flex h-8 shrink-0 items-center rounded-full px-2 text-xs font-medium text-stone-500 transition hover:bg-stone-950/[0.05] hover:text-stone-950 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white";
    const iconStyle: CSSProperties | undefined = variant === "canvas" ? { color: canvasTheme.node.text } : undefined;
    const versionStyle = iconStyle;

    useEffect(() => {
        if (!accountOpen || !user) return;
        form.setFieldsValue({ username: user.username });
    }, [accountOpen, form, user]);

    const onLogout = async () => {
        await logout();
        message.success("已退出登录");
        router.replace("/login");
        router.refresh();
    };

    const saveAccount = async () => {
        const values = await form.validateFields();
        setSavingAccount(true);
        try {
            const msg = await updateAccount({
                username: values.username,
                displayName: values.username,
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
            });
            message.success(msg);
            setAccountOpen(false);
            form.resetFields(["currentPassword", "newPassword"]);
            router.refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "账号配置更新失败");
        } finally {
            setSavingAccount(false);
        }
    };

    return (
        <div className="inline-flex shrink-0 items-center gap-1">
            {user ? (
                <button type="button" className={accountButtonClass} title="账号配置" style={iconStyle} onClick={() => setAccountOpen(true)}>
                    <UserRound className="size-3.5 shrink-0" />
                    <span className="truncate">{user.displayName || user.username}</span>
                </button>
            ) : null}
            {showConfig ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={() => openConfigDialog(false)} aria-label="配置" title="配置">
                    <Settings2 className="size-4" />
                </button>
            ) : null}
            {user ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={() => setAccountOpen(true)} aria-label="账号配置" title="账号配置">
                    <UserCog className="size-4" />
                </button>
            ) : null}
            <AnimatedThemeToggler theme={theme} onThemeChange={setTheme} className={naturalIconClass} style={iconStyle} aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"} title={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"} />
            <VersionReleaseModal className={versionButtonClass} style={versionStyle} />
            {onOpenShortcuts ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={onOpenShortcuts} aria-label="快捷键" title="快捷键">
                    <Keyboard className="size-4" />
                </button>
            ) : null}
            {user ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={onLogout} aria-label="退出登录" title="退出登录">
                    <LogOut className="size-4" />
                </button>
            ) : null}
            <Modal title="账号配置" open={accountOpen} onCancel={() => setAccountOpen(false)} onOk={() => void saveAccount()} okText="保存" cancelText="取消" confirmLoading={savingAccount} destroyOnHidden>
                <Form form={form} layout="vertical" requiredMark={false}>
                    <Form.Item name="username" label="用户名" extra="3-32 位小写字母、数字、下划线或短横线" rules={[{ required: true, message: "请输入用户名" }]}>
                        <Input autoComplete="username" />
                    </Form.Item>
                    <Form.Item name="currentPassword" label="当前密码" extra="仅修改密码时需要填写">
                        <Input.Password autoComplete="current-password" />
                    </Form.Item>
                    <Form.Item name="newPassword" label="新密码" rules={[{ min: 6, message: "密码至少 6 位" }]}>
                        <Input.Password autoComplete="new-password" placeholder="不修改密码可留空" />
                    </Form.Item>
                    <div className="rounded-lg bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-500 dark:bg-stone-900 dark:text-stone-400">账号只用于登录准入；画布、素材、生成记录和 AI API Key 仍保存在当前浏览器本地。</div>
                </Form>
            </Modal>
        </div>
    );
}
