import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EMPTY_INTAKE,
  EMPTY_PATIENT,
  todayDate,
  type ConsultRecord,
  type ImagingReport,
  type Intake,
  type Patient,
} from "./types";

type State = {
  accepted: boolean;
  role: "医师" | "助手";
  intake: Intake;
  patient: Patient;
  records: ConsultRecord[];
  reports: ImagingReport[];
  accept: () => void;
  setRole: (role: "医师" | "助手") => void;
  setIntake: (patch: Partial<Intake>) => void;
  setPatient: (patch: Partial<Patient>) => void;
  resetIntake: () => void;
  saveRecord: (rec: ConsultRecord) => void;
  confirmRecord: (id: string) => void;
  loadRecord: (id: string) => void;
  saveReport: (rec: ImagingReport) => void;
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
        };
      },
    },
  ),
);
