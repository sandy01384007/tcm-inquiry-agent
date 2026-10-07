import { FORMULAS } from "./formulas";
import { CHANNELS, RISKS, type Channel, type Formula, type Herb, type Risk } from "./types";

export function mergeFormulas(extra: Formula[]): Formula[] {
  const map = new Map<string, Formula>();
  for (const f of FORMULAS) map.set(f.id, f);
  for (const f of extra) {
    if (f?.id) map.set(f.id, f);
  }
  return [...map.values()];
}

function herb(raw: unknown): Herb | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const name = String(h.name ?? "").trim();
  if (!name) return null;
  return {
    name,
    classic: String(h.classic ?? "适量"),
    modern: h.modern ? String(h.modern) : undefined,
  };
}

export function parseFormulaPack(raw: unknown): Formula[] {
  const root = raw as { formulas?: unknown[] };
  const list = Array.isArray(raw) ? raw : Array.isArray(root?.formulas) ? root.formulas : [];
  const out: Formula[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const name = String(f.name ?? "").trim();
    const id = String(f.id ?? "").trim() || `local-${name}-${out.length}`;
    if (!name) continue;
    const channel = CHANNELS.includes(f.channel as Channel) ? (f.channel as Channel) : "杂病";
    const risk: Risk = RISKS.includes(f.risk as Risk) ? (f.risk as Risk) : "low";
    const herbs = Array.isArray(f.herbs)
      ? (f.herbs.map(herb).filter(Boolean) as Herb[])
      : String(f.herbsText ?? "")
          .split(/[、,，]/)
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ name: n, classic: "适量" }));
    out.push({
      id: id.slice(0, 64),
      name: name.slice(0, 20),
      pinyin: String(f.pinyin ?? ""),
      source: String(f.source ?? "本店增补").slice(0, 40),
      channel,
      pattern: String(f.pattern ?? "").slice(0, 40),
      indication: String(f.indication ?? "").slice(0, 200),
      herbs: herbs.slice(0, 20),
      usage: String(f.usage ?? "由执业医师核定后煎服").slice(0, 120),
      caution: String(f.caution ?? "须面诊复核。").slice(0, 120),
      risk,
      hideModernDose: risk !== "low" || Boolean(f.hideModernDose),
      tags: (Array.isArray(f.tags) ? f.tags.map(String) : String(f.tagsText ?? "").split(/[、,，\s]/))
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 16),
    });
  }
  return out.slice(0, 200);
}

export function exportPack(extra: Formula[]) {
  return JSON.stringify({ version: 1, formulas: extra }, null, 2);
}
