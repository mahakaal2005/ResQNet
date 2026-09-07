-- Owner: Charan (Backend Core / Platform Engineer)
-- Tables: users, missions, sectors, audit_logs
-- Reviewed by: Charan (migrations gatekeeper, Section 3 of the role doc)
--
-- Standalone-runnable by design. This file creates no foreign key into another
-- owner's tables, so the core API boots and its demo runs with Rudra's
-- 0001_rudra_intelligence_tables.sql absent entirely (Section 3, "Independent
-- demo"). Cross-owner links — sectors.assigned_drone_id -> Chirag's drones —
-- are stored as plain identifiers rather than FKs for the same reason.
--
-- Sector geometry matches apps/simulator/src/sectors.ts exactly, so the
-- simulator's drones fly inside the sectors this schema defines.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- users ----------------------------------------------------------------------
-- Operator accounts and their RBAC role. Roles map to the beneficiaries in PRD
-- Section 6: admin provisions missions, operator runs them and confirms
-- incidents, viewer is the read-only district-authority account.
--
-- No refresh_tokens table: Section 11 assigns this track exactly four tables,
-- so POST /auth/refresh issues a stateless refresh JWT rather than persisting
-- one. Revocation, if it is ever needed, is a Phase 2 concern.
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  full_name VARCHAR NOT NULL,
  role VARCHAR NOT NULL DEFAULT 'operator'
    CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- missions -------------------------------------------------------------------
-- status drives the mission state machine and the three published events:
--   created --start--> active --pause--> paused --start--> active
--   active|paused --complete--> completed
-- mission.started / mission.paused / mission.completed fire on those edges.
-- Chirag's gateway consumes them to start and stop simulated drone motion.
--
-- started_at / completed_at exist to serve the PRD Section 15 success metric
-- "time from simulated mission start to confirmed incident". Pause timestamps
-- are not columns — they are reconstructable from audit_logs.
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'active', 'paused', 'completed')),
  zone_polygon GEOMETRY(Polygon, 4326) NOT NULL,
  sector_count INT NOT NULL CHECK (sector_count > 0),
  created_by UUID REFERENCES users (id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_missions_status ON missions (status);
CREATE INDEX idx_missions_zone_polygon ON missions USING GIST (zone_polygon);

-- sectors --------------------------------------------------------------------
-- sector_id is the external identifier every other service already uses to
-- refer to a sector: it appears in Chirag's telemetry packets and in Rudra's
-- detections/incidents rows. The CHECK mirrors the frozen
-- packages/contracts/telemetry.schema.json pattern so a sector that the
-- simulator could never legally report cannot be inserted here.
--
-- Rows link to a mission by its external mission_id ('MISSION-DEMO-1'), not by
-- the surrogate UUID. That follows the precedent Rudra set in 0001, where
-- incident_events and priority_scores both join on incidents.incident_id, and
-- it keeps one meaning for 'mission_id' everywhere — including on the wire,
-- where Chirag's gateway already emits mission_id: 'MISSION-DEMO-1'.
--
-- assigned_drone_id is deliberately a plain VARCHAR, not a FK to Chirag's
-- drones table — that table belongs to another owner and may not exist when
-- this migration runs alone.
CREATE TABLE sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id VARCHAR NOT NULL REFERENCES missions (mission_id) ON DELETE CASCADE,
  sector_id VARCHAR NOT NULL CHECK (sector_id ~ '^SECTOR-[A-Z]$'),
  polygon GEOMETRY(Polygon, 4326) NOT NULL,
  assigned_drone_id VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, sector_id)
);
CREATE INDEX idx_sectors_mission_id ON sectors (mission_id);
CREATE INDEX idx_sectors_polygon ON sectors USING GIST (polygon);

-- audit_logs -----------------------------------------------------------------
-- Global operator-action log. Read-only consumer of every event on the bus; it
-- never blocks a producer (Section 3, "Events consumed").
--
-- mission_id is nullable because not every audited action is mission-scoped
-- (a login is not). actor_user_id is nullable so the system itself can be the
-- actor for events with no human behind them, such as an automatic resync.
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id VARCHAR REFERENCES missions (mission_id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users (id),
  action VARCHAR NOT NULL,
  entity_type VARCHAR,
  entity_id VARCHAR,
  payload JSONB NOT NULL DEFAULT '{}',
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_mission_timestamp ON audit_logs (mission_id, "timestamp");
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs (actor_user_id);
