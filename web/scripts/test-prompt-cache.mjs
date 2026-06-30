import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PROMPT_CACHE_TEST_ONLY = "1";

const { mergePromptCache, queryPromptItems, writePromptCache, readPromptCache, isPromptCacheFresh } = await import("../src/lib/prompts/prompt-cache.ts");

const dir = mkdtempSync(join(tmpdir(), "prompt-cache-"));
const options = { enabled: true, path: join(dir, "prompts-cache.json"), ttlMs: 60_000 };

try {
    const first = mergePromptCache(null, [
        {
            category: "demo",
            githubUrl: "https://github.com/example/demo",
            ok: true,
            items: [prompt("demo", "a", "红色海报", "生成一张中文红色海报", ["poster"]), prompt("demo", "b", "Blue poster", "Create a blue poster", ["poster", "blue"])],
        },
    ], 1000);
    assert.equal(first.items.length, 2);
    assert.deepEqual(first.stats, { added: 2, updated: 0, deleted: 0, unchanged: 0, total: 2 });

    writePromptCache(first, options);
    const disk = readPromptCache(options);
    assert.equal(disk?.items.length, 2);
    assert.equal(isPromptCacheFresh(disk, options, 2000), true);

    const second = mergePromptCache(disk, [
        {
            category: "demo",
            githubUrl: "https://github.com/example/demo",
            ok: true,
            items: [prompt("demo", "a", "红色海报修改版", "生成一张中文红色海报，加入金色标题", ["poster", "gold"]), prompt("demo", "c", "Green poster", "Create a green poster", ["green"])],
        },
    ], 2000);
    assert.deepEqual(second.stats, { added: 1, updated: 1, deleted: 1, unchanged: 0, total: 2 });
    assert.equal(second.items.some((item) => item.id === "b"), false);
    assert.equal(second.items.find((item) => item.id === "a")?.createdAt, new Date(1000).toISOString());
    assert.equal(second.items.find((item) => item.id === "a")?.updatedAt, new Date(2000).toISOString());

    const zh = queryPromptItems(second.items, { language: "zh", pageSize: 20 });
    assert.equal(zh.total, 1);
    assert.equal(zh.items[0].id, "a");

    const found = queryPromptItems(second.items, { keyword: "green", pageSize: 20 });
    assert.equal(found.total, 1);
    assert.equal(found.items[0].id, "c");

    const failed = mergePromptCache(second, [{ category: "demo", githubUrl: "https://github.com/example/demo", ok: false, items: [], error: "network" }], 3000);
    assert.equal(failed.items.length, 2);
    assert.equal(failed.stats.unchanged, 2);
    assert.equal(failed.sources.demo.ok, false);

    console.log("prompt cache tests passed");
} finally {
    rmSync(dir, { recursive: true, force: true });
}

function prompt(category, id, title, content, tags) {
    return {
        id,
        title,
        coverUrl: `https://example.com/${id}.png`,
        prompt: content,
        tags,
        category,
        githubUrl: "https://github.com/example/demo",
        preview: content,
        createdAt: "",
        updatedAt: "",
    };
}
