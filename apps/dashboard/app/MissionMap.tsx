"use client";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { Drone, Incident } from "../lib/types";

const droneIcon = L.divIcon({ className: "", html: '<span style="color:#006b52;font-size:24px;text-shadow:0 0 2px #fff">&#9650;</span>', iconSize: [24, 24], iconAnchor: [12, 12] });
const incidentIcon = L.divIcon({ className: "", html: '<span style="color:#cf3a1d;font-size:24px;text-shadow:0 0 2px #fff">&#9679;</span>', iconSize: [24, 24], iconAnchor: [12, 12] });

type MissionMapProps = { drones: Drone[]; incidents: Incident[]; onSelect: (incident: Incident) => void };

export default function MissionMap({ drones, incidents, onSelect }: MissionMapProps) {
  const center: [number, number] = incidents[0]
    ? [incidents[0].latitude, incidents[0].longitude]
    : drones[0]
      ? [drones[0].lat, drones[0].lon]
      : [28.615, 77.21];
  return <MapContainer center={center} zoom={14} scrollWheelZoom style={{ height: 360, borderRadius: 6 }}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {drones.map(drone => <Marker key={drone.drone_id} position={[drone.lat, drone.lon]} icon={droneIcon}><Popup><b>{drone.drone_id}</b><br />{drone.sector_id} &middot; {drone.status || "connected"}</Popup></Marker>)}
    {incidents.map(incident => <Marker key={incident.id} position={[incident.latitude, incident.longitude]} icon={incidentIcon} eventHandlers={{ click: () => onSelect(incident) }}><Popup><b>{incident.incidentId}</b><br />P{incident.priorityScore} &middot; {incident.status}</Popup></Marker>)}
  </MapContainer>;
}
