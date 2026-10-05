import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, ClipboardList, ScanLine, Stethoscope } from "lucide-react";
import { useClinic } from "@/lib/tcm/store";
import { cn } from "@/lib/utils";

export function ClinicShell({ children }: { children: ReactNode }) {
  const role = useClinic((s) => s.role);
  const setRole = useClinic((s) => s.setRole);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border bg-card print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-sm bg-primary text-xs text-primary-foreground">
              方
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide">经方诊室</p>
              <p className="text-xs text-muted">执业医师辨证辅助</p>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link to="/" className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 hover:bg-secondary">
              <Stethoscope className="size-4" />
              看诊
            </Link>
            <Link
              to="/library"
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 hover:bg-secondary"
            >
              <BookOpen className="size-4" />
              方库
            </Link>
            <Link
              to="/reports"
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 hover:bg-secondary"
            >
              <ScanLine className="size-4" />
              检验
            </Link>
            <Link
              to="/history"
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 hover:bg-secondary"
            >
              <ClipboardList className="size-4" />
              记录
            </Link>
            <div className="ml-1 flex rounded-md border border-border p-0.5">
              {(["医师", "助手"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "min-h-11 rounded px-3 py-1.5 text-xs",
                    role === r ? "bg-primary text-primary-foreground" : "text-muted",
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
    </div>
  );
}
