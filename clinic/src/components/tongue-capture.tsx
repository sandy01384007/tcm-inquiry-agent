import { useRef, useState } from "react";
import { Camera, ImagePlus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressTongueFile } from "@/lib/tcm/image";
import { analyzeTongue } from "@/lib/tcm/tongue-ai";

type Props = {
  value: string;
  note?: string;
  verified?: boolean;
  onChange: (patch: {
    tongue?: string;
    tongueAiNote?: string;
    tongueVerified?: boolean;
  }) => void;
};

export function TongueCapture({ value, note, verified, onChange }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const dataUrl = await compressTongueFile(file);
      setPhoto(dataUrl);
      onChange({ tongueVerified: false, tongueAiNote: "" });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "无法读取图片");
    }
    setBusy(false);
  }

  async function verify() {
    if (!photo) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await analyzeTongue({ data: { image: photo } });
      if (!res.ok) {
        setMsg(res.error || "校验失败");
        onChange({ tongueVerified: false });
      } else if (!res.valid) {
        setMsg(res.note || `照片${res.quality || "不可用"}，请自然光下伸舌重拍。`);
        onChange({ tongueVerified: false, tongueAiNote: res.note });
      } else {
        onChange({
          tongue: res.summary || value,
          tongueAiNote: [res.quality, res.note].filter(Boolean).join(" · "),
          tongueVerified: true,
        });
        setMsg("已通过 AI 质控，舌象已写入记录。请医师目视复核。");
      }
    } catch {
      setMsg("网络异常，可先手写舌象。");
    }
    setBusy(false);
  }

  function clearPhoto() {
    setPhoto("");
    setMsg("");
    onChange({ tongueVerified: false, tongueAiNote: "" });
  }

  return (
    <div className="sm:col-span-2">
      <span className="mb-1.5 block text-xs font-medium text-muted">舌象</span>
      <input
        className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) =>
          onChange({ tongue: e.target.value, tongueVerified: false })
        }
        placeholder="如淡红舌薄白苔，或拍照后点 AI 校验"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => cameraRef.current?.click()}>
          <Camera className="size-4" />
          拍照
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => albumRef.current?.click()}>
          <ImagePlus className="size-4" />
          上传
        </Button>
        <Button type="button" size="sm" disabled={busy || !photo} onClick={verify}>
          <Sparkles className="size-4" />
          {busy ? "校验中…" : "AI 校验"}
        </Button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={albumRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      {photo && (
        <div className="relative mt-3 max-w-xs">
          <img src={photo} alt="舌象照片" className="h-40 w-full rounded-xl border border-border object-cover" />
          <button type="button" onClick={clearPhoto}
            className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-card text-fg shadow-sm"
            aria-label="删除照片">
            <X className="size-4" />
          </button>
        </div>
      )}
      {verified && <p className="mt-2 text-xs text-primary">AI 质控通过 · 须医师目视复核</p>}
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      {msg && <p className="mt-1 text-xs text-muted">{msg}</p>}
      <p className="mt-1 text-xs text-muted">照片仅用于本次校验，不写入长期病历。自然光、张口伸舌、避免闪光灯。</p>
    </div>
  );
}
