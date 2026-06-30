"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function PromptImage({ src, title, className }: { src?: string; title: string; className?: string }) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (!src || failed) {
        return (
            <div className={cn("flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-stone-100 text-stone-400 dark:bg-stone-900 dark:text-stone-500", className)}>
                <ImageIcon className="size-8" />
                <span className="max-w-[80%] truncate text-xs">{title || "暂无预览图"}</span>
            </div>
        );
    }
    return <img src={src} alt={title} className={cn("aspect-[4/3] w-full object-cover", className)} onError={() => setFailed(true)} />;
}
