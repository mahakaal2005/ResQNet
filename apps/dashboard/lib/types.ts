export type Drone = { drone_id:string; sector_id:string; lat:number; lon:number; status:string; timestamp:string };
export type Incident = { id:string; incidentId:string; latitude:number; longitude:number; survivorCountEstimate:number; confidence:number; priorityScore:number; status:string; firstSeen:string; lastSeen:string; evidence:{frame_ref:string; detection_id:string}[]; sourceDrones:string[]; sectorId:string; operatorConfirmed:boolean; distressFlag:boolean };
export type Priority = { incident_id:string; total:number; breakdown: Record<string, number> };
export type Audit = { id:string; action:string; timestamp:string; payload:Record<string, unknown> };
