import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, ImagePlus, Sparkles, X } from "lucide-react";
import { ClinicShell } from "@/components/clinic-shell";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { compressTongueFile } from "@/lib/tcm/image";
import { analyzeReport } from "@/lib/tcm/report-ai";
import { useClinic } from "@/lib/tcm/store";
import { IMAGING_KINDS, type ImagingKind, type ImagingReport } from "@/lib/tcm/types";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const patient = useClinic((s) => s.patient);
  const reports = useClinic((s) => s.reports);
  const saveReport = useClinic((s) => s.saveReport);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ImagingKind>("体检报告");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [latest, setLatest] = useState<ImagingReport | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (photos.length >= 3) {
      setMsg("最多 3 张，请先删除再传。");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const dataUrl = await compressTongueFile(file, 960);
      setPhotos((p) => [...p, dataUrl]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "无法读取图片");
    }
    setBusy(false);
  }

  async function run() {
    if (!photos.length) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await analyzeReport({ data: { kind, images: photos } });
      if (!res.ok) {
        setMsg(res.error || "解读失败");
        setLatest(null);
      } else {
        const rec: ImagingReport = {
          id: `R-${Date.now()}`,
          kind,
          patientLabel:
            [patient.name, patient.sex, patient.age ? `${patient.age}岁` : "", patient.ref]
              .filter(Boolean)
              .join(" · ") || "未署名",
          createdAt: new Date().toISOString(),
          valid: res.valid,
          urgent: res.urgent,
          title: res.title,
          findings: res.findings,
          flags: res.flags,
          tcmHint: res.tcmHint,
          note: res.note,
        };
        setLatest(rec);
        saveReport(rec);
        setMsg(
          res.valid
            ? "解读已生成，须对照原件由执业医师复核，不能替代检验科/影像科报告。"
            : "材料可能不是所选类型，请换清晰原件。",
        );
      }
    } catch {
      setMsg("网络异常，请稍后重试。");
    }
    setBusy(false);
  }

  return (
    <ClinicShell>
      <Gate>
        <h1 className="text-xl font-semibold">检验影像</h1>
        <p className="mt-1 text-sm text-muted">
          上传体检单、化验单或 CT 截图，AI 摘录所见供执业医师对照。非正式诊断，不开方。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {IMAGING_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`min-h-11 rounded-md border px-3 text-sm ${
                kind === k
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-fg"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" />
            拍照
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => albumRef.current?.click()}>
            <ImagePlus className="size-4" />
            上传
          </Button>
          <Button type="button" disabled={busy || !photos.length} onClick={() => void run()}>
            <Sparkles className="size-4" />
            {busy ? "解读中…" : "AI 解读"}
          </Button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={albumRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        {photos.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
            {photos.map((src, i) => (
              <li key={src.slice(-24)} className="relative">
                <img src={src} alt={`材料 ${i + 1}`} className="h-28 w-full rounded-xl border border-border object-cover" />
                <button type="button" aria-label="删除"
                  className="absolute right-1 top-1 inline-flex size-9 items-center justify-center rounded-full bg-card text-fg shadow-sm"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
        {latest && <ReportCard rec={latest} highlight />}
        <h2 className="mt-8 text-lg font-semibold">已存解读</h2>
        {reports.length === 0 && <p className="mt-2 text-sm text-muted">尚无记录。照片不长期保存，仅存文字摘录。</p>}
        <ul className="mt-3 space-y-3">
          {reports.filter((r) => r.id !== latest?.id).map((r) => (
            <li key={r.id}><ReportCard rec={r} /></li>
          ))}
        </ul>
      </Gate>
    </ClinicShell>
  );
}

function ReportCard({ rec, highlight }: { rec: ImagingReport; highlight?: boolean }) {
  return (
    <article className={`mt-4 rounded-2xl border p-4 ${
      rec.urgent ? "border-danger bg-card" : highlight ? "border-primary bg-card" : "border-border bg-card"
    }`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{rec.kind} · {rec.patientLabel}</p>
        <p className="text-xs text-muted">{new Date(rec.createdAt).toLocaleString()}</p>
      </div>
      {rec.urgent && (
        <p className="mt-2 text-sm text-danger">急症线索：请立即对照原片由专科处置，本解读不能替代急救。</p>
      )}
      {!rec.valid && <p className="mt-2 text-sm text-muted">材料可能与所选类型不符。</p>}
      {rec.title && <p className="mt-2 text-sm">{rec.title}</p>}
      {rec.findings.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">所见摘录</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {rec.findings.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      )}
      {rec.flags.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">需复核</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {rec.flags.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      )}
      {rec.tcmHint && <p className="mt-3 text-sm text-primary">{rec.tcmHint}</p>}
      {rec.note && <p className="mt-2 text-xs text-muted">{rec.note}</p>}
    </article>
  );
}
