"""Telemetry contract validation shared with the TypeScript gateway."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator, FormatChecker


def contract_path() -> Path:
    """Return the repository's canonical telemetry schema path."""
    return Path(__file__).resolve().parents[3] / "packages" / "contracts" / "telemetry.schema.json"


class TelemetryValidator:
    def __init__(self, schema_path: Path | None = None) -> None:
        with (schema_path or contract_path()).open(encoding="utf-8") as source:
            schema = json.load(source)
        self._validator = Draft7Validator(schema, format_checker=FormatChecker())

    def errors(self, packet: dict[str, Any]) -> list[str]:
        return [error.message for error in sorted(self._validator.iter_errors(packet), key=str)]

    def is_valid(self, packet: dict[str, Any]) -> bool:
        return not self.errors(packet)
