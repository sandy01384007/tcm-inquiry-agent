import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ClinicShell } from "@/components/clinic-shell";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { exportPack, mergeFormulas, parseFormulaPack } from "@/lib/tcm/catalog";
import { getDecoction } from "@/lib/tcm/decoction";
import { FORMULAS } from "@/lib/tcm/formulas";
import { useClinic } from "@/lib/tcm/store";
import { CHANNELS, type Channel, type Formula } from "@/lib/tcm/types";

export const Route = createFileRoute("/library")({ component: LibraryPage });

function LibraryPage() {
  const extra = useClinic((s) => s.extraFormulas);
  const setExtra = useClinic((s) => s.setExtraFormulas);
  const localAi = useClinic((s) => s.localAi);
  const setLocalAi = useClinic((s) => s.setLocalAi);
  const role = useClinic((s) => s.role);
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState("");
  const [indication, setIndication] = useState("");
  const [herbsText, setHerbsText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [channel, setChannel] = useState<Channel>("杂病");
  const catalog = useMemo(() => mergeFormulas(extra), [extra]);
  const list = useMemo(() => {
    const s = q.trim();
    if (!s) return catalog;
    return catalog.filter(
      (f) =>
        f.name.includes(s) ||
        f.pattern.includes(s) ||
        f.channel.includes(s) ||
        f.indication.includes(s) ||
        f.herbs.some((h) => h.name.includes(s)) ||
        f.tags.some((t) => t.includes(s)),
    );
  }, [q, catalog]);

  function applyPack(raw: unknown, mode: "merge" | "replace") {
    const parsed = parseFormulaPack(raw);
    if (!parsed.length) {
      setMsg("文件里没有可用方剂");
      return;
    }
    const next =
      mode === "replace"
        ? parsed
        : (() => {
            const m = new Map(extra.map((f) => [f.id, f]));
            for (const f of parsed) m.set(f.id, f);
            return [...m.values()];
          })();
    setExtra(next);
    setMsg(`已${mode === "replace" ? "替换" : "合并"} ${parsed.length} 首，本店增补共 ${next.length} 首`);
  }

  async function onFile(file?: File) {
    if (!file) return;
    try {
      applyPack(JSON.parse(await file.text()), "merge");
    } catch {
      setMsg("JSON 无法解析");
    }
  }

  async function loadLocalFile() {
    try {
      const res = await fetch("/formulas.local.json", { cache: "no-store" });
      if (!res.ok) {
        setMsg("未找到 public/formulas.local.json");
        return;
      }
      applyPack(await res.json(), "merge");
    } catch {
      setMsg("读取本地方库失败");
    }
  }

  function addOne() {
    if (!name.trim()) {
      setMsg("请填写方名");
      return;
    }
    const f: Formula = parseFormulaPack({
      formulas: [{ name, pattern, indication, herbsText, tagsText, channel, source: "本店增补" }],
    })[0];
    if (!f) return;
    applyPack({ formulas: [f] }, "merge");
    setName("");
    setPattern("");
    setIndication("");
    setHerbsText("");
    setTagsText("");
  }

  function download() {
    const blob = new Blob([exportPack(extra)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jingfang-formulas.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <ClinicShell>
      <Gate>
        <h1 className="text-xl font-semibold">经方库</h1>
        <p className="mt-1 text-sm text-muted">
          内置 {FORMULAS.length} 首，本店增补 {extra.length} 首。导入 JSON 或放置{" "}
          <code className="text-xs">public/formulas.local.json</code> 后点加载。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            导入 JSON
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadLocalFile()}>
            加载本地文件
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={download} disabled={!extra.length}>
            导出增补
          </Button>
          {role === "医师" && extra.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setExtra([]); setMsg("已清空本店增补，内置方仍在"); }}>
              清空增补
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}

        <details className="mt-4 rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">本店增补 / 本地模型</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input className="h-11 rounded-md border border-border bg-bg px-3 text-sm" placeholder="方名" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="h-11 rounded-md border border-border bg-bg px-3 text-sm" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:col-span-2" placeholder="证候，如太阳中风" value={pattern} onChange={(e) => setPattern(e.target.value)} />
            <input className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:col-span-2" placeholder="主治" value={indication} onChange={(e) => setIndication(e.target.value)} />
            <input className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:col-span-2" placeholder="药味，顿号分隔" value={herbsText} onChange={(e) => setHerbsText(e.target.value)} />
            <input className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:col-span-2" placeholder="检索标签，如恶风、汗出" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>
          <Button type="button" className="mt-3" size="sm" onClick={addOne}>
            加入本店方
          </Button>
          <div className="mt-5 border-t border-border pt-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={localAi.enabled}
                onChange={(e) => setLocalAi({ enabled: e.target.checked })}
              />
              使用本机模型（Ollama 等 OpenAI 兼容接口）
            </label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-bg px-3 text-sm"
              value={localAi.baseUrl}
              onChange={(e) => setLocalAi({ baseUrl: e.target.value })}
              placeholder="http://127.0.0.1:11434/v1"
            />
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-bg px-3 text-sm"
              value={localAi.model}
              onChange={(e) => setLocalAi({ model: e.target.value })}
              placeholder="qwen2.5 或 llava"
            />
            <p className="mt-2 text-xs text-muted">
              诊所电脑：安装 Ollama，拉模型后勾选此项。看图请用带视觉的模型。未勾选则走云端 Grok。
            </p>
          </div>
        </details>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜方名、证候、药味"
          className="mt-4 h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-ring"
        />
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {list.map((f) => (
            <li key={f.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium">
                  {f.name}
                  {extra.some((e) => e.id === f.id) && (
                    <span className="ml-2 text-xs text-primary">本店</span>
                  )}
                </h2>
                <span className="text-xs text-muted">
                  {f.channel} · {f.risk}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{f.pattern}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{f.indication}</p>
              <p className="mt-2 text-xs text-muted">{f.herbs.map((h) => h.name).join("、")}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                煎煮：{getDecoction(f.id).steps[0]}
              </p>
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="mt-6 text-sm text-muted">无匹配方剂。</p>}
      </Gate>
    </ClinicShell>
  );
}
