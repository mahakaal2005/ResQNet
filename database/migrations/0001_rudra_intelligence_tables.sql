-- Owner: Rudra (Backend Intelligence / Incident Engineer)
-- Tables: detections, geolocations, incidents, incident_events, priority_scores
-- Reviewed by: Charan (migrations gatekeeper, Section 3 of role doc)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE detections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  detection_id VARCHAR NOT NULL UNIQUE,
  drone_id VARCHAR NOT NULL,
  sector_id VARCHAR NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  bbox JSONB NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  centroid JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_detections_drone_timestamp ON detections (drone_id, "timestamp");

CREATE TABLE geolocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  detection_id VARCHAR NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  error_m DOUBLE PRECISION NOT NULL,
  method VARCHAR NOT NULL,
  location GEOMETRY(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_geolocations_detection_id ON geolocations (detection_id);
CREATE INDEX idx_geolocations_location ON geolocations USING GIST (location);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id VARCHAR NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location GEOMETRY(Point, 4326),
  survivor_count_estimate INT NOT NULL DEFAULT 1,
  confidence DOUBLE PRECISION NOT NULL,
  priority_score INT NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'confirmed', 'dispatched', 'resolved')),
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  source_drones TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sector_id VARCHAR NOT NULL,
  operator_confirmed BOOLEAN NOT NULL DEFAULT false,
  distress_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incidents_status ON incidents (status);
CREATE INDEX idx_incidents_location ON incidents USING GIST (location);

CREATE TABLE incident_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_events_incident_id ON incident_events (incident_id);

CREATE TABLE priority_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id VARCHAR NOT NULL,
  people_count INT NOT NULL,
  isolation INT NOT NULL,
  time_factor INT NOT NULL,
  distress_flag INT NOT NULL,
  total INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_priority_scores_incident_id ON priority_scores (incident_id);
