import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatWithClinic } from "@/lib/tcm/clinic-chat";
import { yuan, sumFen } from "@/lib/tcm/money";
import { useClinic } from "@/lib/tcm/store";
import type { ChatTurn } from "@/lib/tcm/types";

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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, open]);

  async function send() {
    const q = text.trim();
    if (!q || busy) return;
    const user: ChatTurn = { role: "user", text: q, at: new Date().toISOString() };
    addChat(user);
    setText("");
    setBusy(true);
    setErr("");
    const last = records[0];
    const pending = bills.find((b) => b.status === "待收");
    try {
      const res = await chatWithClinic({
        data: {
          messages: [...chats, user],
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
        },
      });
      if (!res.ok) setErr(res.error || "对话失败");
      else addChat({ role: "assistant", text: res.text, at: new Date().toISOString() });
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
          className="fixed bottom-5 right-5 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm text-primary-foreground shadow-lg"
        >
          <MessageCircle className="size-4" />
          问 AI
        </button>
      )}
      {open && (
        <section className="fixed bottom-4 right-4 z-40 flex h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-1.5rem))] flex-col rounded-2xl border border-border bg-card shadow-xl">
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">诊室对话</p>
              <p className="text-xs text-muted">已带入当前病历与最近方证</p>
            </div>
            <div className="flex gap-1">
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
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {chats.length === 0 && (
              <p className="text-sm text-muted">
                可问：为何选桂枝汤、舌象如何记、这笔诊金怎么收。回答须由执业医师复核。
              </p>
            )}
            {chats.map((m) => (
              <div
                key={`${m.at}-${m.text.slice(0, 8)}`}
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                  m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {m.text}
              </div>
            ))}
            {busy && <p className="text-xs text-muted">思考中…</p>}
            {err && <p className="text-xs text-danger">{err}</p>}
            <div ref={endRef} />
          </div>
          <form
            className="flex gap-2 border-t border-border p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
              value={text}
              placeholder="结合当前患者提问…"
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" disabled={busy || !text.trim()} className="px-3">
              <Send className="size-4" />
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
