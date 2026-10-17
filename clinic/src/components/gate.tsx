import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/lib/tcm/store";

export function Gate({ children }: { children: ReactNode }) {
  const accepted = useClinic((s) => s.accepted);
  const accept = useClinic((s) => s.accept);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return <p className="text-sm text-muted">载入中…</p>;
  }
  if (accepted) return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="text-xs tracking-[0.2em] text-primary">使用前确认</p>
      <h1 className="mt-2 text-2xl font-semibold">经方诊室不是自动医生</h1>
      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
        <li>仅供具备资质的执业中医师作辨证与经方检索辅助。</li>
        <li>系统可给出方证候选与原方组成草稿，不能替代面诊、脉诊与最终决策。</li>
        <li>急症必须急救。含附子、承气等峻剂不给出具体克数。</li>
        <li>助手角色只能采集信息，不能核定处方。</li>
      </ul>
      <Button className="mt-6 w-full" onClick={accept}>
        我是执业场景使用者，已理解上述边界
      </Button>
    </div>
  );
}
