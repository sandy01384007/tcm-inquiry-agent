import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, ClipboardList, ScanLine, Stethoscope, Wallet } from "lucide-react";
import { ClinicChat } from "@/components/clinic-chat";
import { useClinic } from "@/lib/tcm/store";
import { cn } from "@/lib/utils";

export function ClinicShell({ children }: { children: ReactNode }) {
  const role = useClinic((s) => s.role);
  const setRole = useClinic((s) => s.setRole);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="bg-ink text-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              方
            </span>
            <div>
              <p className="text-sm font-extrabold tracking-wide text-white">经方诊室</p>
              <p className="text-xs text-white/70">执业医师辨证辅助</p>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link to="/" className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-2 text-white/90 hover:bg-white/10">
              <Stethoscope className="size-4" />
              看诊
            </Link>
            <Link
              to="/library"
              className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-2 text-white/90 hover:bg-white/10"
            >
              <BookOpen className="size-4" />
              方库
            </Link>
            <Link
              to="/reports"
              className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-2 text-white/90 hover:bg-white/10"
            >
              <ScanLine className="size-4" />
              检验
            </Link>
            <Link
              to="/billing"
              className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-2 text-white/90 hover:bg-white/10"
            >
              <Wallet className="size-4" />
              收费
            </Link>
            <Link
              to="/history"
              className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-2 text-white/90 hover:bg-white/10"
            >
              <ClipboardList className="size-4" />
              记录
            </Link>
            <div className="ml-1 flex rounded-full border border-white/20 p-0.5">
              {(["医师", "助手"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "min-h-11 rounded-full px-3 py-1.5 text-xs font-semibold",
                    role === r ? "bg-primary text-primary-foreground" : "text-white/70",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <ClinicChat />
    </div>
  );
}
