import type { Audit, Drone, Incident, Priority } from "./types";

export type RealtimeEvent = "drone.telemetry" | "drone.status" | "incident.created" | "incident.updated" | "network.offline" | "network.reconnected" | "sync.completed" | "voice.signal";
export interface CommandDataSource { incidents(): Promise<Incident[]>; drones(): Promise<Drone[]>; audit(): Promise<Audit[]>; priority(id:string): Promise<Priority | undefined>; subscribe(onEvent:(event:RealtimeEvent, payload:any)=>void): ()=>void; sendVoiceSignal(signal: unknown): boolean; }
const root = typeof window === "undefined" ? "" : window.location.origin;
async function mock<T>(name:string): Promise<T> { return (await fetch(`${root}/mockApi/${name}.json`)).json(); }
export class MockDataSource implements CommandDataSource {
  incidents=()=>mock<Incident[]>("incidents"); drones=()=>mock<Drone[]>("drones"); audit=()=>mock<Audit[]>("audit_logs");
  async priority(id:string) { return (await mock<Priority[]>("priority_breakdowns")).find(x=>x.incident_id===id); }
  subscribe() { return () => {}; }
  sendVoiceSignal() { return false; }
}
export class LiveDataSource implements CommandDataSource {
  private api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  private token = process.env.NEXT_PUBLIC_DEMO_TOKEN || "";
  private get<T>(path:string) { return fetch(this.api + path, {headers:this.token?{Authorization:`Bearer ${this.token}`}:{}}).then(r=>{if(!r.ok)throw Error(`${r.status} ${path}`);return r.json() as Promise<T>;}); }
  audit=()=>this.get<Audit[]>("/audit-logs");
  private latestDrones = new Map<string, Drone>();
  private incidentKeys = new Map<string, string>();
  private socket:any;
  incidents=async()=>{const rows=await this.get<Incident[]>("/incidents"); rows.forEach(row=>this.incidentKeys.set(row.id,row.incidentId)); return rows;};
  priority=(id:string)=>this.get<Priority>(`/incidents/${this.incidentKeys.get(id)||id}/priority-breakdown`);
  drones=async()=>[...this.latestDrones.values()];
  subscribe(onEvent:(event:RealtimeEvent,payload:any)=>void) { import("socket.io-client").then(({io})=>{ this.socket=io((process.env.NEXT_PUBLIC_REALTIME_URL||"http://localhost:4000")+"/realtime"); const events:RealtimeEvent[]=["drone.telemetry","drone.status","incident.created","incident.updated","network.offline","network.reconnected","sync.completed","voice.signal"]; events.forEach(event=>this.socket.on(event,(payload:any)=>{ if(event==="drone.telemetry") this.latestDrones.set(payload.drone_id,{...payload,status:this.latestDrones.get(payload.drone_id)?.status||"connected"}); onEvent(event,payload); })); }); return ()=>{this.socket?.close();this.socket=undefined;}; }
  sendVoiceSignal(signal: unknown) { if (!this.socket?.connected) return false; this.socket.emit("voice.signal", signal); return true; }
}
export const dataSource: CommandDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE === "live" ? new LiveDataSource() : new MockDataSource();
