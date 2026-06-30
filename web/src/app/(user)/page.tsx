"use client";

import { ArrowRight, Copy, FilePlus2, RefreshCw } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Image, Tag } from "antd";

import { fetchPrompts, formatPromptDateTime, type Prompt } from "@/services/api/prompts";
import { navigationTools } from "@/constant/navigation-tools";
import { useCopyText } from "@/hooks/use-copy-text";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "./canvas/stores/use-canvas-store";
import { CanvasNodeType } from "./canvas/types";

function Highlighter({ action, color, children }: { action: "highlight" | "underline"; color: string; children: ReactNode }) {
    return (
        <span className="relative inline-block px-1">
            {action === "highlight" ? (
                <span className="absolute inset-x-0 bottom-0 top-1 rounded-sm opacity-45" style={{ backgroundColor: color }} />
            ) : (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full opacity-80" style={{ backgroundColor: color }} />
            )}
            <span className="relative font-medium text-stone-800 dark:text-stone-200">{children}</span>
        </span>
    );
}

export default function IndexPage() {
    const { message } = App.useApp();
    const router = useRouter();
    const copyText = useCopyText();
    const [primaryTool] = navigationTools;
    const [promptShowcase, setPromptShowcase] = useState<Prompt[]>([]);
    const [promptShowcaseLoading, setPromptShowcaseLoading] = useState(false);
    const [promptTotal, setPromptTotal] = useState(0);
    const [promptChineseTotal, setPromptChineseTotal] = useState(0);
    const [promptScope, setPromptScope] = useState<"all" | "zh">("all");
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);
    const canvasHydrated = useCanvasStore((state) => state.hydrated);
    const importProject = useCanvasStore((state) => state.importProject);

    const refreshPromptShowcase = useCallback((scope: "all" | "zh" = promptScope) => {
        setPromptShowcaseLoading(true);
        void fetchPrompts({ pageSize: 12, random: true, coverOnly: true, language: scope === "zh" ? "zh" : undefined })
            .then((data) => {
                setPromptShowcase(data.items);
                setPromptTotal(data.totalAll);
                setPromptChineseTotal(data.totalChinese);
            })
            .catch((error) => message.error(error instanceof Error ? error.message : "获取提示词失败"))
            .finally(() => setPromptShowcaseLoading(false));
    }, [message, promptScope]);

    useEffect(() => {
        refreshPromptShowcase();
    }, [refreshPromptShowcase]);

    const importPromptToCanvas = (item: Prompt) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const imageNodeId = `image-${suffix}`;
        const configNodeId = `config-${suffix}`;
        const nodes = [
            {
                id: imageNodeId,
                type: CanvasNodeType.Image,
                title: item.title,
                position: { x: 80, y: 120 },
                width: 360,
                height: 260,
                metadata: { content: item.coverUrl, prompt: item.prompt, status: "success" as const },
            },
            {
                id: configNodeId,
                type: CanvasNodeType.Config,
                title: "灵机一动",
                position: { x: 500, y: 120 },
                width: 360,
                height: 260,
                metadata: { content: "", composerContent: item.prompt, prompt: item.prompt, status: "idle" as const, generationMode: "image" as const },
            },
        ];
        const id = importProject({ title: `灵机一动 - ${item.title.slice(0, 18)}`, nodes, connections: [] });
        message.success("已导入画布");
        router.push(`/canvas/${id}`);
    };

    return (
        <main className="relative h-full overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] text-stone-950 dark:bg-[radial-gradient(rgba(245,245,244,.18)_1px,transparent_1px)] dark:text-stone-100">
            <section className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden px-6">
                <div className="pointer-events-none absolute left-[15%] top-24 size-20 rounded-full border border-dashed border-stone-200 dark:border-stone-800" />
                <div className="pointer-events-none absolute right-[23%] top-[48%] size-20 rounded-full border border-dashed border-stone-200 dark:border-stone-800" />

                <div className="relative flex min-h-[620px] flex-col items-center justify-center pt-10 text-center">
                    <h1 className="ai-title-aurora max-w-5xl text-balance text-5xl font-semibold tracking-normal sm:text-7xl lg:text-8xl">BMCCA无限画布</h1>
                    <p className="mt-8 max-w-3xl text-balance text-lg leading-8 text-stone-500 dark:text-stone-400">
                        在
                        <Highlighter action="underline" color="#FF9800">
                            BMCCA无限画布
                        </Highlighter>
                        中生成、连接和重组
                        <Highlighter action="highlight" color="#87CEFA">
                            图片、文字与图形
                        </Highlighter>
                        ，让创作从单次生成变成连续推演。
                    </p>
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        <Button type="primary" size="large" href={`/${primaryTool.slug}`} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            开始使用
                        </Button>
                        <Button size="large" href="/canvas">
                            打开画布
                        </Button>
                    </div>
                </div>

                <section className="relative mx-auto mb-20 max-w-6xl border-t border-stone-200 pt-12 dark:border-stone-800">
                    <div className="mb-8 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
                        <div className="flex justify-center md:justify-start">
                            <div className="flex shrink-0 flex-wrap items-center justify-center gap-1 rounded-full border border-stone-200/80 bg-white/70 p-1 shadow-sm shadow-stone-950/[0.03] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
                                {(["all", "zh"] as const).map((scope) => (
                                    <button
                                        key={scope}
                                        type="button"
                                        disabled={promptShowcaseLoading}
                                        onClick={() => {
                                            setPromptScope(scope);
                                            refreshPromptShowcase(scope);
                                        }}
                                        className={cn(
                                            "h-8 rounded-full border border-transparent px-3 text-xs font-medium transition",
                                            promptScope === scope ? "border-amber-200/80 bg-amber-50 text-amber-800 shadow-sm shadow-amber-900/5 dark:border-amber-300/25 dark:bg-amber-300/15 dark:text-amber-100" : "text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-100",
                                        )}
                                    >
                                        {scope === "all" ? "全部" : "中文"}
                                    </button>
                                ))}
                                <span className="mx-1 h-4 w-px bg-stone-200 dark:bg-white/10" />
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<RefreshCw className={cn("size-3.5", promptShowcaseLoading && "animate-spin")} />}
                                    disabled={promptShowcaseLoading}
                                    onClick={() => refreshPromptShowcase()}
                                    className="!h-8 !rounded-full !px-3 !text-xs !text-stone-600 hover:!bg-stone-100 dark:!text-stone-300 dark:hover:!bg-white/10"
                                >
                                    换一批
                                </Button>
                            </div>
                        </div>
                        <div className="max-w-2xl text-center">
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <h2 className="text-3xl font-semibold text-stone-950 dark:text-stone-100">灵机一动</h2>
                            </div>
                            <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">每次刷新页面，都会遇见新的视觉灵感。</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 md:items-end">
                            <Button type="link" href="/prompts" className="justify-self-center md:justify-self-end" icon={<ArrowRight className="size-4" />} iconPlacement="end">
                                查看提示词库
                            </Button>
                            <p className="text-sm text-stone-400 dark:text-stone-500">
                                当前提示词总量：{promptTotal}
                                {promptChineseTotal ? `，中文：${promptChineseTotal}` : ""}
                            </p>
                        </div>
                    </div>
                    <div className="grid auto-rows-[210px] gap-4 md:grid-cols-4">
                        {promptShowcase.map((item, index) => (
                            <div
                                key={item.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key !== "Enter" && event.key !== " ") return;
                                    event.preventDefault();
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                }}
                                className={cn(
                                    "group relative cursor-pointer overflow-hidden border border-stone-200 bg-stone-100 text-left dark:border-stone-800 dark:bg-stone-900",
                                    index === 0 && "md:col-span-2 md:row-span-2",
                                    index === 3 && "md:col-span-2",
                                )}
                            >
                                <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-9rem)] flex-wrap gap-1.5">
                                    {item.tags.slice(0, 2).map((tag) => (
                                        <Tag key={tag} variant="filled" className="m-0 rounded-md border-0 bg-black/45 text-[11px] text-white shadow-sm backdrop-blur">
                                            {tag}
                                        </Tag>
                                    ))}
                                </div>
                                <div className="absolute right-3 top-3 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                    <Button
                                        size="small"
                                        type="text"
                                        title="复制提示词"
                                        icon={<Copy className="size-3.5" />}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            copyText(item.prompt, "提示词已复制");
                                        }}
                                        className="!h-7 !rounded-full !border !border-white/15 !bg-black/45 !px-2 !text-xs !text-white !backdrop-blur hover:!bg-black/60"
                                    >
                                        复制
                                    </Button>
                                    <Button
                                        size="small"
                                        type="text"
                                        title="导入画布"
                                        disabled={!canvasHydrated}
                                        icon={<FilePlus2 className="size-3.5" />}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            importPromptToCanvas(item);
                                        }}
                                        className="!h-7 !rounded-full !border !border-white/15 !bg-white/90 !px-2 !text-xs !text-stone-900 !backdrop-blur hover:!bg-white"
                                    >
                                        导入
                                    </Button>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-4 pb-4 pt-14 text-white">
                                    <h3 className="line-clamp-2 text-sm font-medium leading-5 drop-shadow">{item.title}</h3>
                                    <div className="mt-2 h-px w-10 bg-white/45 opacity-0 transition group-hover:opacity-100" />
                                </div>
                                <div className="sr-only">
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {item.tags.slice(0, 2).map((tag) => (
                                            <Tag key={tag} variant="filled" className="m-0 bg-white/15 text-[11px] text-white backdrop-blur">
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                    <h3 className="text-sm font-medium">{item.title}</h3>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/75">{item.prompt}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </section>
            <Image.PreviewGroup
                preview={{
                    open: previewOpen,
                    current: previewIndex,
                    onOpenChange: setPreviewOpen,
                    onChange: setPreviewIndex,
                }}
            >
                <div className="hidden">
                    {promptShowcase.map((item) => (
                        <Image key={item.id} src={item.coverUrl} alt={item.title} />
                    ))}
                </div>
            </Image.PreviewGroup>
        </main>
    );
}
