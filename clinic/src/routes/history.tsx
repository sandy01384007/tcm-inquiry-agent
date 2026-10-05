import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClinicShell } from "@/components/clinic-shell";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/lib/tcm/store";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const records = useClinic((s) => s.records);
  const loadRecord = useClinic((s) => s.loadRecord);
  const navigate = useNavigate();
  return (
    <ClinicShell>
      <Gate>
        <h1 className="text-xl font-semibold">看诊记录</h1>
        <p className="mt-1 text-sm text-muted">保存在本机浏览器。勿填写身份证号等敏感证件信息。</p>
        {records.length === 0 && <p className="mt-6 text-sm text-muted">暂无记录。</p>}
        <ul className="mt-4 space-y-3">
          {records.map((r) => {
            const p = r.patient;
            const title = p?.name || p?.ref || "未署名";
            return (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {title}
                  {p?.sex ? ` · ${p.sex}` : ""}
                  {p?.age ? ` · ${p.age}岁` : ""}
                </p>
                <p className="text-xs text-muted">{p?.visitDate || new Date(r.createdAt).toLocaleString()}</p>
              </div>
              <p className="mt-1 text-sm">{r.intake.chief}</p>
              <p className="mt-1 text-xs text-muted">
                {r.matches[0] ? `首选 ${r.matches[0].formula.name}` : "无匹配"}
                {r.confirmed ? " · 已核定" : " · 未核定"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  loadRecord(r.id);
                  void navigate({ to: "/" });
                }}
              >
                载入再辨
              </Button>
            </li>
            );
          })}
        </ul>
      </Gate>
    </ClinicShell>
  );
}
