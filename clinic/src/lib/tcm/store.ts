import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EMPTY_INTAKE,
  EMPTY_PATIENT,
  EMPTY_PAY_CODES,
  EMPTY_LOCAL_AI,
  EMPTY_FOLLOW_CONFIG,
  todayDate,
  type Bill,
  type BillDraft,
  type ChatTurn,
  type Chart,
  type ConsultRecord,
  type DispenseOrder,
  type FollowCheckin,
  type FollowConfig,
  type FollowTask,
  type Formula,
  type ImagingReport,
  type Intake,
  type LocalAi,
  type Patient,
  type PayCodes,
  type Registration,
  type StockItem,
  type StockMove,
  type StockMoveKind,
  type VisitKind,
  type WestMove,
  type WestOrder,
  type WestRx,
  type WestStockItem,
  type WestUnit,
} from "./types";
import { classifyFollow, delayHours, dueFrom, plusDays } from "./followup";
import { lineNeed, orderFromBill, reviewOrder, sameHerb } from "./pharmacy";
import { bannedWest, expiryState, orderFromWestBill } from "./west-stock";
import { rxBlock } from "./west-rx";

type State = {
  accepted: boolean;
  role: "医师" | "助手";
  intake: Intake;
  patient: Patient;
  records: ConsultRecord[];
  reports: ImagingReport[];
  bills: Bill[];
  payCodes: PayCodes;
  billDraft: BillDraft | null;
  chats: ChatTurn[];
  chatOpen: boolean;
  extraFormulas: Formula[];
  localAi: LocalAi;
  followups: FollowTask[];
  followConfig: FollowConfig;
  charts: Chart[];
  registrations: Registration[];
  stock: StockItem[];
  stockMoves: StockMove[];
  dispenses: DispenseOrder[];
  westStock: WestStockItem[];
  westMoves: WestMove[];
  westOrders: WestOrder[];
  westRx: WestRx[];
  accept: () => void;
  setRole: (role: "医师" | "助手") => void;
  setIntake: (patch: Partial<Intake>) => void;
  setPatient: (patch: Partial<Patient>) => void;
  resetIntake: () => void;
  saveRecord: (rec: ConsultRecord) => void;
  confirmRecord: (id: string) => void;
  loadRecord: (id: string) => void;
  saveReport: (rec: ImagingReport) => void;
  saveBill: (bill: Bill) => void;
  updateBill: (id: string, patch: Partial<Bill>) => void;
  setPayCodes: (patch: Partial<PayCodes>) => void;
  setBillDraft: (draft: BillDraft | null) => void;
  addChat: (turn: ChatTurn) => void;
  clearChat: () => void;
  setChatOpen: (open: boolean) => void;
  setExtraFormulas: (list: Formula[]) => void;
  setLocalAi: (patch: Partial<LocalAi>) => void;
  scheduleFollowup: (input: {
    patientLabel: string;
    visitKind?: VisitKind;
    consultId?: string;
    billId?: string;
    recheckDate?: string;
    recheckItems?: string;
  }) => void;
  submitFollowup: (id: string, checkin: FollowCheckin) => { risk: FollowTask["risk"]; hits: string[] } | null;
  patchFollowup: (id: string, patch: Partial<FollowTask>) => void;
  setFollowConfig: (patch: Partial<FollowConfig>) => void;
  upsertChart: (chart: Chart) => void;
  addRegistration: (reg: Registration) => void;
  patchRegistration: (id: string, patch: Partial<Registration>) => void;
  callRegistration: (id: string) => void;
  patchDispense: (id: string, patch: Partial<DispenseOrder>) => void;
  reviewDispense: (id: string, note: string) => boolean;
  completeDispense: (id: string) => boolean;
  adjustStock: (name: string, kind: StockMoveKind, qty: number, note: string) => boolean;
  seedStock: (names: string[]) => void;
  adjustWest: (input: {
    name: string;
    spec: string;
    unit: WestUnit;
    qty: number;
    kind: StockMoveKind;
    note: string;
    batch: string;
    expiry: string;
  }) => boolean;
  patchWestOrder: (id: string, lines: { name: string; qty: number }[]) => void;
  rejectWest: (id: string) => void;
  dispenseWest: (id: string) => boolean;
  saveWestRx: (rx: WestRx) => void;
  patchWestRx: (id: string, patch: Partial<WestRx>) => void;
  signWestRx: (id: string) => boolean;
  voidWestRx: (id: string) => void;
};

function markRxPaid(list: WestRx[], bill: Bill) {
  if (bill.status !== "已收" || !bill.rxId) return list;
  return list.map((rx) =>
    rx.id === bill.rxId && rx.status !== "作废" && rx.status !== "已发" ? { ...rx, status: "已收费" as const, billId: bill.id } : rx,
  );
}

function enqueueDispense(s: { dispenses: DispenseOrder[]; charts: Chart[]; records: ConsultRecord[]; extraFormulas: Formula[] }, bill: Bill) {
  if (bill.status !== "已收" || !bill.formulaName || s.dispenses.some((d) => d.billId === bill.id)) return s.dispenses;
  const chart = s.charts.find((c) => c.id === bill.chartId);
  const rec = s.records.find((r) => r.id === bill.consultId);
  const order = orderFromBill(bill, s.extraFormulas, chart?.allergy || rec?.patient.allergy || "", !!rec?.intake.pregnancy, !!rec?.intake.child);
  return order ? [order, ...s.dispenses].slice(0, 200) : s.dispenses;
}

function enqueueWest(s: { westOrders: WestOrder[]; charts: Chart[] }, bill: Bill) {
  if (s.westOrders.some((order) => order.billId === bill.id)) return s.westOrders;
  const chart = s.charts.find((c) => c.id === bill.chartId);
  const order = orderFromWestBill(bill, chart?.allergy || "");
  return order ? [order, ...s.westOrders].slice(0, 200) : s.westOrders;
}

function freshPatient(): Patient {
  return { ...EMPTY_PATIENT, visitDate: todayDate() };
}

function trimFollowImages(list: FollowTask[]): FollowTask[] {
  let kept = 0;
  return list.slice(0, 80).map((t) => {
    if (!t.checkin?.reportImage) return t;
    kept += 1;
    if (kept <= 8) return t;
    return { ...t, checkin: { ...t.checkin, reportImage: undefined } };
  });
}

function newFollowTask(
  config: FollowConfig,
  input: {
    patientLabel: string;
    visitKind?: VisitKind;
    consultId?: string;
    billId?: string;
    recheckDate?: string;
    recheckItems?: string;
  },
): FollowTask {
  const now = new Date().toISOString();
  const visitKind = input.visitKind ?? "门诊普通";
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    dueAt: dueFrom(now, delayHours(config, visitKind)),
    patientLabel: input.patientLabel || "未署名",
    consultId: input.consultId,
    billId: input.billId,
    visitKind,
    risk: "正常",
    status: "待打卡",
    recheckDate: input.recheckDate || plusDays(new Date(), 7),
    recheckItems: input.recheckItems || "遵医师面诊时交代的复查项目",
    staffNote: "",
  };
}

export const useClinic = create<State>()(
  persist(
    (set) => ({
      accepted: false,
      role: "医师",
      intake: EMPTY_INTAKE,
      patient: freshPatient(),
      records: [],
      reports: [],
      bills: [],
      payCodes: EMPTY_PAY_CODES,
      billDraft: null,
      chats: [],
      chatOpen: false,
      extraFormulas: [],
      localAi: EMPTY_LOCAL_AI,
      followups: [],
      followConfig: EMPTY_FOLLOW_CONFIG,
      charts: [],
      registrations: [],
      stock: [],
      stockMoves: [],
      dispenses: [],
      westStock: [],
      westMoves: [],
      westOrders: [],
      westRx: [],
      accept: () => set({ accepted: true }),
      setRole: (role) => set({ role }),
      setIntake: (patch) => set((s) => ({ intake: { ...s.intake, ...patch } })),
      setPatient: (patch) => set((s) => ({ patient: { ...s.patient, ...patch } })),
      resetIntake: () => set({ intake: EMPTY_INTAKE }),
      saveRecord: (rec) =>
        set((s) => ({
          records: [rec, ...s.records].slice(0, 40),
          registrations: rec.patient.registrationId
            ? s.registrations.map((r) =>
                r.id === rec.patient.registrationId
                  ? {
                      ...r,
                      consultId: rec.id,
                      status: r.status === "已退号" || r.status === "已完诊" ? r.status : "就诊中",
                    }
                  : r,
              )
            : s.registrations,
        })),
      confirmRecord: (id) =>
        set((s) => ({
          records: s.records.map((r) => (r.id === id ? { ...r, confirmed: true } : r)),
        })),
      loadRecord: (id) =>
        set((s) => {
          const rec = s.records.find((r) => r.id === id);
          if (!rec) return {};
          return {
            intake: rec.intake,
            patient: { ...EMPTY_PATIENT, ...(rec.patient ?? {}), ref: rec.patient?.ref || (rec as { patientRef?: string }).patientRef || "" },
          };
        }),
      saveReport: (rec) => set((s) => ({ reports: [rec, ...s.reports].slice(0, 30) })),
      saveBill: (bill) =>
        set((s) => {
          const safe = bill.status === "已收" && !bill.chartId ? { ...bill, status: "待收" as const, paidAt: undefined } : bill;
          const bills = [safe, ...s.bills].slice(0, 80);
          if (safe.status !== "已收" || s.followups.some((f) => f.billId === safe.id)) {
            return { bills, dispenses: enqueueDispense(s, safe), westOrders: enqueueWest(s, safe), westRx: markRxPaid(s.westRx, safe) };
          }
          const task = newFollowTask(s.followConfig, {
            patientLabel: bill.patientLabel,
            consultId: bill.consultId,
            billId: bill.id,
            recheckItems: bill.formulaName ? `与「${bill.formulaName}」相关的复诊，遵医嘱` : undefined,
          });
          return { bills, followups: trimFollowImages([task, ...s.followups]), dispenses: enqueueDispense(s, safe), westOrders: enqueueWest(s, safe), westRx: markRxPaid(s.westRx, safe) };
        }),
      updateBill: (id, patch) =>
        set((s) => {
          const current = s.bills.find((b) => b.id === id);
          const nextPatch = patch.status === "已收" && !(patch.chartId || current?.chartId) ? { ...patch, status: "待收" as const, paidAt: undefined } : patch;
          const bills = s.bills.map((b) => (b.id === id ? { ...b, ...nextPatch } : b));
          if (nextPatch.status !== "已收") return { bills };
          const bill = bills.find((b) => b.id === id);
          if (!bill) return { bills };
          const dispenses = enqueueDispense(s, bill);
          const westOrders = enqueueWest(s, bill);
          if (s.followups.some((f) => f.billId === bill.id)) return { bills, dispenses, westOrders, westRx: markRxPaid(s.westRx, bill) };
          const task = newFollowTask(s.followConfig, {
            patientLabel: bill.patientLabel,
            consultId: bill.consultId,
            billId: bill.id,
            recheckItems: bill.formulaName ? `与「${bill.formulaName}」相关的复诊，遵医嘱` : undefined,
          });
          return { bills, dispenses, westOrders, westRx: markRxPaid(s.westRx, bill), followups: trimFollowImages([task, ...s.followups]) };
        }),
      setPayCodes: (patch) => set((s) => ({ payCodes: { ...s.payCodes, ...patch } })),
      setBillDraft: (billDraft) => set({ billDraft }),
      addChat: (turn) =>
        set((s) => {
          const next = [...s.chats, turn].slice(-40).map((m, i, arr) =>
            i < arr.length - 6 ? { ...m, image: undefined } : m,
          );
          return { chats: next };
        }),
      clearChat: () => set({ chats: [] }),
      setChatOpen: (chatOpen) => set({ chatOpen }),
      setExtraFormulas: (extraFormulas) => set({ extraFormulas: extraFormulas.slice(0, 200) }),
      setLocalAi: (patch) => set((s) => ({ localAi: { ...s.localAi, ...patch } })),
      scheduleFollowup: (input) =>
        set((s) => {
          if (input.billId && s.followups.some((f) => f.billId === input.billId)) return {};
          if (input.consultId && s.followups.some((f) => f.consultId === input.consultId && !input.billId)) return {};
          return { followups: trimFollowImages([newFollowTask(s.followConfig, input), ...s.followups]) };
        }),
      submitFollowup: (id, checkin) => {
        let result: { risk: FollowTask["risk"]; hits: string[] } | null = null;
        set((s) => {
          const task = s.followups.find((f) => f.id === id);
          if (!task || task.status !== "待打卡") return {};
          const judged = classifyFollow(checkin, s.followConfig.emergencyWords);
          result = { risk: judged.risk, hits: judged.hits };
          return {
            followups: trimFollowImages(
              s.followups.map((f) =>
                f.id === id ? { ...f, risk: judged.risk, status: judged.status, checkin } : f,
              ),
            ),
          };
        });
        return result;
      },
      patchFollowup: (id, patch) =>
        set((s) => ({
          followups: s.followups.map((f) => (f.id === id ? { ...f, ...patch, id: f.id } : f)),
        })),
      setFollowConfig: (patch) => set((s) => ({ followConfig: { ...s.followConfig, ...patch } })),
      upsertChart: (chart) =>
        set((s) => ({
          charts: [chart, ...s.charts.filter((c) => c.id !== chart.id)].slice(0, 400),
        })),
      addRegistration: (reg) =>
        set((s) => ({ registrations: [reg, ...s.registrations].slice(0, 500) })),
      patchRegistration: (id, patch) =>
        set((s) => ({
          registrations: s.registrations.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)),
        })),
      callRegistration: (id) =>
        set((s) => {
          const target = s.registrations.find((r) => r.id === id);
          if (!target || target.status === "已退号") return {};
          return {
            registrations: s.registrations.map((r) => {
              if (r.id === id) return { ...r, status: "就诊中" };
              if (r.visitDate === target.visitDate && r.status === "就诊中") return { ...r, status: "候诊" };
              return r;
            }),
          };
        }),
      patchDispense: (id, patch) =>
        set((s) => ({
          dispenses: s.dispenses.map((d) => (d.id === id && d.status !== "已发药" ? { ...d, ...patch, id: d.id } : d)),
        })),
      reviewDispense: (id, note) => {
        let ok = false;
        set((s) => {
          const order = s.dispenses.find((d) => d.id === id);
          if (!order || order.status !== "待审方") return {};
          const flags = reviewOrder(order, s.stock);
          ok = !flags.some((f) => f.level === "拦截");
          return {
            dispenses: s.dispenses.map((d) =>
              d.id === id
                ? {
                    ...d,
                    flags,
                    reviewNote: note,
                    status: ok ? "已审方" : d.status,
                    reviewedAt: ok ? new Date().toISOString() : d.reviewedAt,
                  }
                : d,
            ),
          };
        });
        return ok;
      },
      completeDispense: (id) => {
        let ok = false;
        set((s) => {
          const order = s.dispenses.find((d) => d.id === id);
          if (!order || order.status !== "已配药") return {};
          const flags = reviewOrder(order, s.stock);
          if (flags.some((f) => f.level === "拦截")) {
            return { dispenses: s.dispenses.map((d) => (d.id === id ? { ...d, flags } : d)) };
          }
          const stock = s.stock.map((item) => ({ ...item }));
          const moves: StockMove[] = [];
          for (const line of order.lines) {
            const need = lineNeed(line, order.doses);
            const idx = stock.findIndex((item) => sameHerb(item.name, line.name));
            if (need <= 0 || idx < 0 || stock[idx].qty < need) return {};
            stock[idx] = { ...stock[idx], qty: Math.round((stock[idx].qty - need) * 10) / 10 };
            moves.push({
              id: `M-${Date.now()}-${line.name}`,
              at: new Date().toISOString(),
              name: stock[idx].name,
              kind: "发药",
              qty: need,
              note: order.formulaName,
              dispenseId: order.id,
            });
          }
          ok = true;
          return {
            stock,
            stockMoves: [...moves, ...s.stockMoves].slice(0, 400),
            dispenses: s.dispenses.map((d) =>
              d.id === id ? { ...d, status: "已发药", dispensedAt: new Date().toISOString(), flags } : d,
            ),
            registrations: order.registrationId
              ? s.registrations.map((r) => (r.id === order.registrationId ? { ...r, status: "已完诊" } : r))
              : s.registrations,
          };
        });
        return ok;
      },
      adjustStock: (name, kind, qty, note) => {
        const amount = Math.round(qty * 10) / 10;
        if (!name.trim() || amount <= 0) return false;
        let ok = false;
        set((s) => {
          const stock = s.stock.map((item) => ({ ...item }));
          const idx = stock.findIndex((item) => sameHerb(item.name, name));
          if (kind === "入库") {
            if (idx < 0) stock.push({ name: name.trim(), qty: amount, warnAt: 100 });
            else stock[idx] = { ...stock[idx], qty: Math.round((stock[idx].qty + amount) * 10) / 10 };
          } else {
            if (idx < 0 || stock[idx].qty < amount) return {};
            stock[idx] = { ...stock[idx], qty: Math.round((stock[idx].qty - amount) * 10) / 10 };
          }
          ok = true;
          const move: StockMove = {
            id: `M-${Date.now()}`,
            at: new Date().toISOString(),
            name: idx >= 0 ? stock[idx].name : name.trim(),
            kind,
            qty: amount,
            note,
          };
          return { stock, stockMoves: [move, ...s.stockMoves].slice(0, 400) };
        });
        return ok;
      },
      seedStock: (names) =>
        set((s) => {
          const have = new Set(s.stock.map((item) => item.name));
          const add = names
            .map((name) => name.trim())
            .filter((name) => name && !have.has(name) && !s.stock.some((item) => sameHerb(item.name, name)))
            .map((name) => ({ name, qty: 500, warnAt: 100 }));
          return { stock: [...s.stock, ...add] };
        }),
      adjustWest: (input) => {
        const amount = Math.round(input.qty);
        const name = input.name.trim();
        if (!name || amount <= 0 || bannedWest(name)) return false;
        let ok = false;
        set((s) => {
          const westStock = s.westStock.map((item) => ({ ...item }));
          const idx = westStock.findIndex((item) => item.name === name);
          if (input.kind === "入库") {
            if (idx < 0) {
              westStock.push({
                name,
                spec: input.spec.trim(),
                unit: input.unit,
                qty: amount,
                warnAt: 5,
                batch: input.batch.trim(),
                expiry: input.expiry,
              });
            } else {
              westStock[idx] = {
                ...westStock[idx],
                qty: westStock[idx].qty + amount,
                spec: input.spec.trim() || westStock[idx].spec,
                batch: input.batch.trim() || westStock[idx].batch,
                expiry: input.expiry || westStock[idx].expiry,
              };
            }
          } else {
            if (idx < 0 || westStock[idx].qty < amount) return {};
            westStock[idx] = { ...westStock[idx], qty: westStock[idx].qty - amount };
          }
          ok = true;
          const move: WestMove = {
            id: `W-${Date.now()}`,
            at: new Date().toISOString(),
            name,
            kind: input.kind,
            qty: amount,
            note: input.note,
          };
          return { westStock, westMoves: [move, ...s.westMoves].slice(0, 400) };
        });
        return ok;
      },
      patchWestOrder: (id, lines) =>
        set((s) => ({
          westOrders: s.westOrders.map((order) => (order.id === id && order.status === "待核" ? { ...order, lines } : order)),
        })),
      rejectWest: (id) =>
        set((s) => ({
          westOrders: s.westOrders.map((order) => (order.id === id && order.status === "待核" ? { ...order, status: "退回" } : order)),
        })),
      dispenseWest: (id) => {
        let ok = false;
        set((s) => {
          const order = s.westOrders.find((item) => item.id === id);
          if (!order || order.status !== "待核") return {};
          const stock = s.westStock.map((item) => ({ ...item }));
          const moves: WestMove[] = [];
          for (const line of order.lines) {
            if (line.qty <= 0 || bannedWest(line.name)) return {};
            if (order.allergy && order.allergy.includes(line.name)) return {};
            const idx = stock.findIndex((item) => item.name === line.name);
            if (idx < 0 || stock[idx].qty < line.qty || expiryState(stock[idx].expiry) === "expired") return {};
            stock[idx] = { ...stock[idx], qty: stock[idx].qty - line.qty };
            moves.push({
              id: `W-${Date.now()}-${line.name}`,
              at: new Date().toISOString(),
              name: line.name,
              kind: "发药",
              qty: line.qty,
              note: order.patientLabel,
              billId: order.billId,
            });
          }
          ok = true;
          const herbOpen = s.dispenses.some(
            (d) => d.billId === order.billId && d.status !== "已发药" && d.status !== "退回",
          );
          return {
            westStock: stock,
            westMoves: [...moves, ...s.westMoves].slice(0, 400),
            westOrders: s.westOrders.map((item) => (item.id === id ? { ...item, status: "已发" } : item)),
            westRx: s.westRx.map((rx) => (rx.billId === order.billId && rx.status === "已收费" ? { ...rx, status: "已发" } : rx)),
            registrations:
              order.registrationId && !herbOpen
                ? s.registrations.map((r) => (r.id === order.registrationId ? { ...r, status: "已完诊" } : r))
                : s.registrations,
          };
        });
        return ok;
      },
      saveWestRx: (rx) => set((s) => ({ westRx: [rx, ...s.westRx.filter((item) => item.id !== rx.id)].slice(0, 200) })),
      patchWestRx: (id, patch) =>
        set((s) => ({
          westRx: s.westRx.map((rx) => (rx.id === id && rx.status === "草稿" ? { ...rx, ...patch, id: rx.id, status: "草稿" } : rx)),
        })),
      signWestRx: (id) => {
        let ok = false;
        set((s) => {
          const rx = s.westRx.find((item) => item.id === id);
          if (!rx || s.role !== "医师" || rx.status !== "草稿" || rxBlock(rx, s.westStock, s.westOrders)) return {};
          ok = true;
          return {
            westRx: s.westRx.map((item) =>
              item.id === id ? { ...item, status: "已签", signedAt: new Date().toISOString() } : item,
            ),
          };
        });
        return ok;
      },
      voidWestRx: (id) =>
        set((s) => ({
          westRx:
            s.role === "医师"
              ? s.westRx.map((rx) => (rx.id === id && (rx.status === "草稿" || rx.status === "已签") ? { ...rx, status: "作废" } : rx))
              : s.westRx,
        })),
    }),
    {
      name: "jingfang-clinic",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State> & { patientRef?: string };
        const records = (p.records ?? current.records).map((r) => {
          if (r.patient) return r;
          const old = r as ConsultRecord & { patientRef?: string };
          return {
            ...r,
            patient: { ...EMPTY_PATIENT, ref: old.patientRef ?? "未编号" },
          };
        });
        return {
          ...current,
          ...p,
          patient: {
            ...EMPTY_PATIENT,
            visitDate: todayDate(),
            ...(p.patient ?? {}),
            ref: p.patient?.ref || p.patientRef || "",
            chartId: p.patient?.chartId ?? "",
            registrationId: p.patient?.registrationId ?? "",
            phone: p.patient?.phone ?? "",
            allergy: p.patient?.allergy ?? "",
          },
          records: records.map((r) => ({ ...r, patient: { ...EMPTY_PATIENT, ...r.patient } })),
          reports: p.reports ?? current.reports,
          bills: p.bills ?? current.bills,
          payCodes: p.payCodes ?? current.payCodes,
          chats: p.chats ?? current.chats,
          extraFormulas: p.extraFormulas ?? current.extraFormulas,
          localAi: p.localAi ?? current.localAi,
          charts: p.charts ?? current.charts,
          registrations: p.registrations ?? current.registrations,
          stock: p.stock ?? current.stock,
          stockMoves: p.stockMoves ?? current.stockMoves,
          dispenses: p.dispenses ?? current.dispenses,
          westStock: (p.westStock ?? current.westStock).map((item) => ({ ...item, batch: item.batch ?? "", expiry: item.expiry ?? "" })),
          westMoves: p.westMoves ?? current.westMoves,
          westOrders: p.westOrders ?? current.westOrders,
          westRx: p.westRx ?? current.westRx,
          followups: p.followups ?? current.followups,
          followConfig: {
            ...EMPTY_FOLLOW_CONFIG,
            ...(p.followConfig ?? {}),
            rules: p.followConfig?.rules?.length ? p.followConfig.rules : EMPTY_FOLLOW_CONFIG.rules,
            emergencyWords: p.followConfig?.emergencyWords?.length
              ? p.followConfig.emergencyWords
              : EMPTY_FOLLOW_CONFIG.emergencyWords,
            questions: p.followConfig?.questions ?? [],
          },
        };
      },
    },
  ),
);
