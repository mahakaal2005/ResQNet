import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import * as fs from "fs";
import * as path from "path";

const SCHEMA_PATH = path.join(__dirname, "..", "..", "..", "..", "packages", "contracts", "telemetry.schema.json");

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

let validateFn: ValidateFunction | null = null;

function loadValidator(): ValidateFunction {
  if (validateFn) return validateFn;
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  validateFn = ajv.compile(schema);
  return validateFn;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateTelemetry(packet: unknown): ValidationResult {
  const validate = loadValidator();
  const valid = validate(packet) as boolean;
  if (valid) return { valid: true };
  return {
    valid: false,
    errors: (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`),
  };
}
