import type { Hotspot, MapData, Report, SensorReading, Stats, TacticalPlan } from "./types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function patch<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: object | FormData): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  getMapData: () => get<MapData>("/map-data"),
  getStats: () => get<Stats>("/stats"),
  getHotspots: (status?: string) => get<Hotspot[]>(`/hotspots${status ? `?status=${status}` : ""}`),
  getHotspot: (id: number) => get<Hotspot>(`/hotspots/${id}`),
  updateHotspotStatus: (id: number, status: string, officer?: string) =>
    patch<Hotspot>(`/hotspots/${id}/status`, { status, officer }),
  getReports: (source?: string) => get<Report[]>(`/reports${source ? `?source=${source}` : ""}`),
  getSensors: () => get<SensorReading[]>("/sensors"),
  submitReport: (form: FormData) => post<{ success: boolean; report: Report }>("/reports", form),
  refreshData: () => post<{ success: boolean }>("/refresh"),
  seedDemo: () => post<{ success: boolean }>("/seed-demo"),
  triggerScenario: (scenario: string) => post<{ success: boolean; scenario: string; message: string }>("/demo/trigger-scenario", { scenario }),
  getTacticalPlan: (hotspotId: number) => post<TacticalPlan>(`/hotspots/${hotspotId}/tactical-plan`),
};

