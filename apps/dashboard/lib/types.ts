export type Drone = { drone_id:string; sector_id:string; lat:number; lon:number; status:string; timestamp:string; altitude_m?:number; heading_deg?:number; speed_mps?:number; battery_pct?:number; gimbal_pitch_deg?:number; frame_ref?:string };
export type Detection = { detection_id:string; drone_id:string; sector_id:string; timestamp:string; latitude:number; longitude:number; confidence:number; bbox:{x:number;y:number;w:number;h:number}; frame_ref?:string; status:"new"|"confirmed"|"rescued"|"false_positive" };
export type Incident = { id:string; incidentId:string; latitude:number; longitude:number; survivorCountEstimate:number; confidence:number; priorityScore:number; status:string; firstSeen:string; lastSeen:string; evidence:{frame_ref:string; detection_id:string}[]; sourceDrones:string[]; sectorId:string; operatorConfirmed:boolean; distressFlag:boolean };
export type Priority = { incident_id:string; total:number; breakdown: Record<string, number> };
export type Audit = { id:string; action:string; timestamp:string; payload:Record<string, unknown> };
export type Sector = { id: string; label: string; droneId: string; coordinates: [number, number][]; color: string };
