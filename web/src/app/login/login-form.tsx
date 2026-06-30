"use client";

import { LockKeyhole, Paintbrush, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, App, Button, Form, Input, Tabs } from "antd";

import { useUserStore } from "@/stores/use-user-store";

type AuthFormValues = { username: string; password: string; displayName?: string };

type LoginConfig = { appName: string; authEnabled: boolean; registrationEnabled: boolean; localDataNotice: string };

export function LoginForm({ config }: { config: LoginConfig }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { message } = App.useApp();
    const setSession = useUserStore((state) => state.setSession);
    const [mode, setMode] = useState("login");
    const [loading, setLoading] = useState(false);

    const submitAuth = async (endpoint: string, values: AuthFormValues, successMessage: string) => {
        setLoading(true);
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(values),
            });
            const payload = (await response.json()) as { code: number; data?: { user?: { id: string; username: string; displayName: string }; localDataNotice?: string }; msg?: string };
            if (!response.ok || payload.code !== 0 || !payload.data?.user) throw new Error(payload.msg || successMessage.replace("成功", "失败"));
            setSession(payload.data.user, payload.data.localDataNotice);
            message.success(successMessage);
            router.replace(safeRedirect(searchParams.get("redirect")));
            router.refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : successMessage.replace("成功", "失败"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-6 py-10 text-foreground">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,113,108,.18),transparent_34%),radial-gradient(circle_at_80%_12%,rgba(28,25,23,.12),transparent_28%),linear-gradient(135deg,rgba(250,250,249,.92),rgba(245,245,244,.72))] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(214,211,209,.14),transparent_34%),radial-gradient(circle_at_80%_12%,rgba(250,250,249,.08),transparent_28%),linear-gradient(135deg,rgba(12,10,9,.96),rgba(28,25,23,.92))]" />
            <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-stone-200 bg-white/80 shadow-2xl shadow-stone-950/10 backdrop-blur-xl md:grid-cols-[1.05fr_.95fr] dark:border-stone-800 dark:bg-stone-950/72 dark:shadow-black/35">
                <div className="relative hidden min-h-[560px] flex-col justify-between overflow-hidden bg-stone-950 p-10 text-white md:flex">
                    <div className="absolute -right-20 -top-20 size-64 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -bottom-24 left-10 size-72 rounded-full border border-white/10" />
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
                            <Paintbrush className="size-3.5" />
                            多人准入 · 本地创作
                        </div>
                        <h1 className="mt-10 max-w-sm text-5xl font-semibold leading-tight tracking-tight">登录或注册后进入你的无限画布</h1>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 text-sm leading-6 text-white/72 backdrop-blur">{config.localDataNotice}</div>
                </div>

                <div className="p-8 sm:p-10">
                    <div className="mb-9 flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950">
                            {mode === "register" ? <UserPlus className="size-5" /> : <LockKeyhole className="size-5" />}
                        </div>
                        <div>
                            <div className="text-xl font-semibold">{config.appName}</div>
                            <div className="text-sm text-stone-500 dark:text-stone-400">账号只用于进入应用，创作数据仍在当前浏览器</div>
                        </div>
                    </div>

                    <Alert className="mb-6" type="info" showIcon message="数据仍保存在当前浏览器本地" description={config.localDataNotice} />

                    <Tabs
                        activeKey={mode}
                        onChange={setMode}
                        items={[
                            {
                                key: "login",
                                label: "登录",
                                children: (
                                    <Form layout="vertical" requiredMark={false} onFinish={(values) => submitAuth("/api/auth/login", values, "登录成功")} disabled={!config.authEnabled || loading}>
                                        <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                                            <Input size="large" autoComplete="username" placeholder="请输入用户名" />
                                        </Form.Item>
                                        <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                                            <Input.Password size="large" autoComplete="current-password" placeholder="请输入密码" />
                                        </Form.Item>
                                        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                                            登录进入
                                        </Button>
                                    </Form>
                                ),
                            },
                            {
                                key: "register",
                                label: "注册账号",
                                disabled: !config.registrationEnabled,
                                children: (
                                    <Form layout="vertical" requiredMark={false} onFinish={(values) => submitAuth("/api/auth/register", values, "注册成功")} disabled={!config.authEnabled || !config.registrationEnabled || loading}>
                                        <Form.Item name="username" label="用户名" extra="3-32 位小写字母、数字、下划线或短横线" rules={[{ required: true, message: "请输入用户名" }]}>
                                            <Input size="large" autoComplete="username" placeholder="例如：xiaoming" />
                                        </Form.Item>
                                        <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }, { min: 6, message: "密码至少 6 位" }]}>
                                            <Input.Password size="large" autoComplete="new-password" placeholder="至少 6 位" />
                                        </Form.Item>
                                        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                                            注册并进入
                                        </Button>
                                    </Form>
                                ),
                            },
                        ]}
                    />
                </div>
            </section>
        </main>
    );
}

function safeRedirect(value: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
    return value;
}
