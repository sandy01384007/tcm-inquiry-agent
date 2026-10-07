import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EMPTY_INTAKE,
  EMPTY_PATIENT,
  EMPTY_PAY_CODES,
  EMPTY_LOCAL_AI,
  todayDate,
  type Bill,
  type BillDraft,
  type ChatTurn,
  type ConsultRecord,
  type Formula,
  type ImagingReport,
  type Intake,
  type LocalAi,
  type Patient,
  type PayCodes,
} from "./types";

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
};

function freshPatient(): Patient {
  return { ...EMPTY_PATIENT, visitDate: todayDate() };
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
      accept: () => set({ accepted: true }),
      setRole: (role) => set({ role }),
      setIntake: (patch) => set((s) => ({ intake: { ...s.intake, ...patch } })),
      setPatient: (patch) => set((s) => ({ patient: { ...s.patient, ...patch } })),
      resetIntake: () => set({ intake: EMPTY_INTAKE, patient: freshPatient() }),
      saveRecord: (rec) => set((s) => ({ records: [rec, ...s.records].slice(0, 40) })),
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
            patient: rec.patient ?? { ...EMPTY_PATIENT, ref: (rec as { patientRef?: string }).patientRef ?? "" },
          };
        }),
      saveReport: (rec) => set((s) => ({ reports: [rec, ...s.reports].slice(0, 30) })),
      saveBill: (bill) => set((s) => ({ bills: [bill, ...s.bills].slice(0, 80) })),
      updateBill: (id, patch) =>
        set((s) => ({
          bills: s.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),
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
          patient: p.patient ?? {
            ...EMPTY_PATIENT,
            ref: p.patientRef ?? "",
            visitDate: todayDate(),
          },
          records,
          reports: p.reports ?? current.reports,
          bills: p.bills ?? current.bills,
          payCodes: p.payCodes ?? current.payCodes,
          chats: p.chats ?? current.chats,
          extraFormulas: p.extraFormulas ?? current.extraFormulas,
          localAi: p.localAi ?? current.localAi,
        };
      },
    },
  ),
);
