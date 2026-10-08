import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Mic, Send, Volume2, X } from "lucide-react";
import { AiDoctorAvatar } from "@/components/ai-doctor";
import { Button } from "@/components/ui/button";
import { chatWithClinic } from "@/lib/tcm/clinic-chat";
import { compressTongueFile } from "@/lib/tcm/image";
import { chatLocal } from "@/lib/tcm/local-ai";
import { yuan, sumFen } from "@/lib/tcm/money";
import { useClinic } from "@/lib/tcm/store";
import type { ChatTurn } from "@/lib/tcm/types";

type Recog = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function ClinicChat() {
  const open = useClinic((s) => s.chatOpen);
  const setChatOpen = useClinic((s) => s.setChatOpen);
  const chats = useClinic((s) => s.chats);
  const addChat = useClinic((s) => s.addChat);
  const clearChat = useClinic((s) => s.clearChat);
  const patient = useClinic((s) => s.patient);
  const intake = useClinic((s) => s.intake);
  const role = useClinic((s) => s.role);
  const records = useClinic((s) => s.records);
  const bills = useClinic((s) => s.bills);
  const localAi = useClinic((s) => s.localAi);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<Recog | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, open, busy]);

  function speak(words: string) {
    if (!speakOn || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(words.slice(0, 280));
    u.lang = "zh-CN";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }

  function toggleMic() {
    const Ctor =
      typeof window !== "undefined"
        ? (window as unknown as { webkitSpeechRecognition?: new () => Recog; SpeechRecognition?: new () => Recog })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => Recog }).webkitSpeechRecognition
        : undefined;
    if (!Ctor) {
      setErr("当前浏览器不支持语音输入，请用 Chrome 或手动打字。");
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new Ctor();
    r.lang = "zh-CN";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript ?? "";
      if (said) setText((t) => (t ? `${t}${said}` : said));
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recogRef.current = r;
    r.start();
    setListening(true);
    setErr("");
  }

  async function onFile(file?: File) {
    if (!file) return;
    try {
      setPhoto(await compressTongueFile(file, 640));
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "无法读取图片");
    }
  }

  async function send() {
    const q = text.trim();
    if ((!q && !photo) || busy) return;
    const user: ChatTurn = {
      role: "user",
      text: q || "（看图）",
      at: new Date().toISOString(),
      image: photo || undefined,
    };
    addChat(user);
    setText("");
    const img = photo;
    setPhoto("");
    setBusy(true);
    setErr("");
    const last = records[0];
    const pending = bills.find((b) => b.status === "待收");
    const payload = {
      messages: [...chats, user].map((m) => ({ ...m, image: undefined })),
      context: {
        role,
        patient: {
          name: patient.name,
          age: patient.age,
          sex: patient.sex,
          visitDate: patient.visitDate,
        },
        intake,
        formulaNames: (last?.matches ?? []).map((m) => m.formula.name),
        eight: last?.eightPrinciples ?? [],
        billHint: pending
          ? `待收 ${pending.method} ¥${yuan(sumFen(pending.items))}`
          : bills[0]
            ? `最近 ${bills[0].status} ¥${yuan(sumFen(bills[0].items))}`
            : "",
      },
      image: img || undefined,
    };
    try {
      const res = localAi.enabled
        ? await chatLocal(localAi, payload)
        : await chatWithClinic({ data: payload });
      if (!res.ok) setErr(res.error || "对话失败");
      else {
        addChat({ role: "assistant", text: res.text, at: new Date().toISOString() });
        speak(res.text);
      }
    } catch {
      setErr("网络异常");
    }
    setBusy(false);
  }

  return (
    <div className="print:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-card py-1 pl-1 pr-4 shadow-lg ring-1 ring-border"
        >
          <AiDoctorAvatar size={44} live />
          <span className="text-sm font-bold text-seal">AI 医生</span>
        </button>
      )}
      {open && (
        <section className="fixed bottom-4 right-4 z-40 flex h-[min(34rem,74vh)] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <header className="flex items-center justify-between border-b border-border bg-secondary px-3 py-2">
            <div className="flex items-center gap-2">
              <AiDoctorAvatar size={40} live />
              <div>
                <p className="text-sm font-bold text-seal">AI 医生</p>
                <p className="text-xs text-muted">
                  {localAi.enabled ? `本机 ${localAi.model}` : "云端辅助"} · 须执业复核
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="朗读"
                onClick={() => setSpeakOn((v) => !v)}
                className={`inline-flex size-9 items-center justify-center rounded-md ${speakOn ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              >
                <Volume2 className="size-4" />
              </button>
              <Button type="button" variant="ghost" size="sm" onClick={clearChat}>
                清空
              </Button>
              <button
                type="button"
                aria-label="关闭"
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-secondary"
                onClick={() => setChatOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {chats.length === 0 && (
              <div className="flex gap-2">
                <AiDoctorAvatar size={36} />
                <p className="rounded-2xl rounded-tl-sm bg-secondary px-3 py-2 text-sm">
                  您好，我是 AI 医生。可以打字、说话或把舌象、化验单拍照给我看。我只是助手，处方须医师核定。
                </p>
              </div>
            )}
            {chats.map((m) =>
              m.role === "assistant" ? (
                <div key={`${m.at}-a`} className="flex items-end gap-2">
                  <AiDoctorAvatar size={32} />
                  <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3 py-2 text-sm">{m.text}</p>
                </div>
              ) : (
                <div key={`${m.at}-u`} className="ml-auto max-w-[85%] space-y-1">
                  {m.image && (
                    <img src={m.image} alt="" className="ml-auto h-24 w-24 rounded-xl object-cover" />
                  )}
                  <p className="rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.text}
                  </p>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <AiDoctorAvatar size={28} />
                AI 医生正在看…
              </div>
            )}
            {err && <p className="text-xs text-danger">{err}</p>}
            <div ref={endRef} />
          </div>
          {photo && (
            <div className="relative mx-3 mb-1 h-16 w-16">
              <img src={photo} alt="待发送" className="h-16 w-16 rounded-lg object-cover" />
              <button
                type="button"
                aria-label="去掉图片"
                className="absolute -right-1 -top-1 inline-flex size-6 items-center justify-center rounded-full bg-card text-xs shadow"
                onClick={() => setPhoto("")}
              >
                ×
              </button>
            </div>
          )}
          <form
            className="flex items-end gap-1 border-t border-border p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <button
              type="button"
              aria-label="拍照"
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-secondary"
              onClick={() => camRef.current?.click()}
            >
              <Camera className="size-4" />
            </button>
            <button
              type="button"
              aria-label="上传图片"
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-secondary"
              onClick={() => albumRef.current?.click()}
            >
              <ImagePlus className="size-4" />
            </button>
            <button
              type="button"
              aria-label="语音"
              className={`inline-flex size-11 items-center justify-center rounded-md ${listening ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              onClick={toggleMic}
            >
              <Mic className="size-4" />
            </button>
            <input
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
              value={text}
              placeholder={listening ? "正在听…" : "对 AI 医生说…"}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" disabled={busy || (!text.trim() && !photo)} className="px-3">
              <Send className="size-4" />
            </Button>
            <input
              ref={camRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={albumRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </form>
        </section>
      )}
    </div>
  );
}
