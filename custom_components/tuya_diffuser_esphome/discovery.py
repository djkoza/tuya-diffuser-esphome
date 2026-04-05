"""Discovery helpers for Tuya Diffuser ESPHome entities."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.helpers import device_registry as dr, entity_registry as er

from .const import (
    CONF_COUNTDOWN_LEFT_ENTITY,
    CONF_COUNTDOWN_MINUTES_ENTITY,
    CONF_DEVICE_ID,
    CONF_LIGHT_ENTITY,
    CONF_MIST_MODE_ENTITY,
    CONF_MIST_STRENGTH_ENTITY,
    CONF_SOURCE_TYPE,
    CONF_TITLE,
    REQUIRED_ENTITY_KEYS,
    SOURCE_AUTO,
)


@dataclass(slots=True)
class DiffuserCandidate:
    """Auto-detected candidate device."""

    key: str
    title: str
    data: dict[str, str]


def discover_candidates(hass) -> dict[str, DiffuserCandidate]:
    """Discover candidate diffuser devices from ESPHome entities."""
    entity_registry = er.async_get(hass)
    device_registry = dr.async_get(hass)

    grouped: dict[str, dict[str, str]] = {}
    for entry in entity_registry.entities.values():
        if entry.disabled_by is not None or not entry.device_id:
            continue

        role = _match_role(entry)
        if role is None:
            continue

        grouped.setdefault(entry.device_id, {})[role] = entry.entity_id

    candidates: dict[str, DiffuserCandidate] = {}
    for device_id, mapping in grouped.items():
        if not all(key in mapping for key in REQUIRED_ENTITY_KEYS):
            continue

        device = device_registry.async_get(device_id)
        title = _device_title(device, mapping)
        candidates[device_id] = DiffuserCandidate(
            key=device_id,
            title=title,
            data={
                CONF_SOURCE_TYPE: SOURCE_AUTO,
                CONF_DEVICE_ID: device_id,
                CONF_TITLE: title,
                **mapping,
                **_discover_optional_entities(entity_registry, device_id),
            },
        )

    return candidates


def resolve_device_id_for_entities(hass, entity_ids: list[str]) -> str | None:
    """Resolve a shared device_id for selected entities."""
    entity_registry = er.async_get(hass)
    device_ids = {
        entry.device_id
        for entity_id in entity_ids
        if (entry := entity_registry.async_get(entity_id)) and entry.device_id
    }
    if len(device_ids) == 1:
        return next(iter(device_ids))
    return None


def _device_title(device: dr.DeviceEntry | None, mapping: dict[str, str]) -> str:
    """Build a human title for the candidate."""
    if device:
        return device.name_by_user or device.name or device.model or device.id

    entity_id = mapping[CONF_MIST_MODE_ENTITY]
    slug = entity_id.split(".", 1)[1]
    return slug.replace("_mist_mode", "").replace("_", " ").title()


def _match_role(entry: er.RegistryEntry) -> str | None:
    """Match an entity registry entry to one of the required roles."""
    if _matches(entry, "select", "_mist_mode", "mist mode"):
        return CONF_MIST_MODE_ENTITY
    if _matches(entry, "select", "_mist_strength", "mist strength"):
        return CONF_MIST_STRENGTH_ENTITY
    if _matches(entry, "number", "_countdown_minutes", "countdown minutes"):
        return CONF_COUNTDOWN_MINUTES_ENTITY
    if _matches(entry, "sensor", "_countdown_left", "countdown left"):
        return CONF_COUNTDOWN_LEFT_ENTITY
    return None


def _discover_optional_entities(entity_registry: er.EntityRegistry, device_id: str) -> dict[str, str]:
    """Discover optional entities on the same device."""
    light_entity = None
    for entry in entity_registry.entities.values():
        if entry.disabled_by is not None or entry.device_id != device_id:
            continue
        if entry.entity_id.startswith("light."):
            light_entity = entry.entity_id
            break

    result: dict[str, str] = {}
    if light_entity:
        result[CONF_LIGHT_ENTITY] = light_entity
    return result


def _matches(entry: er.RegistryEntry, domain: str, entity_suffix: str, name_suffix: str) -> bool:
    """Check if an entity matches a role by domain and suffix."""
    if not entry.entity_id.startswith(f"{domain}."):
        return False
    if entry.entity_id.endswith(entity_suffix):
        return True

    for value in (entry.original_name, entry.name):
        if value and value.lower().endswith(name_suffix):
            return True

    return False
