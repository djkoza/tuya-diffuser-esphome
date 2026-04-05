"""Tuya Diffuser ESPHome integration."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

from .const import (
    ATTR_MINUTES,
    ATTR_STRENGTH,
    CARD_RESOURCE_PATH,
    CONF_COUNTDOWN_LEFT_ENTITY,
    CONF_COUNTDOWN_MINUTES_ENTITY,
    CONF_DEVICE_ID,
    CONF_LIGHT_ENTITY,
    CONF_MIST_MODE_ENTITY,
    CONF_MIST_STRENGTH_ENTITY,
    DATA_ENTITIES,
    DATA_FRONTEND_REGISTERED,
    DATA_SERVICES_REGISTERED,
    DOMAIN,
    PLATFORMS,
    SERVICE_SET_COUNTDOWN_MINUTES,
    SERVICE_SET_MIST_STRENGTH,
)
from .discovery import discover_light_entity, resolve_device_id_for_entities


def _entity_ids_schema(value: object) -> list[str]:
    """Validate one or more entity IDs."""
    return cv.ensure_list_csv(value)


SERVICE_SET_MIST_STRENGTH_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): vol.All(_entity_ids_schema, [cv.entity_id]),
        vol.Required(ATTR_STRENGTH): vol.In(["low", "high"]),
    }
)

SERVICE_SET_COUNTDOWN_MINUTES_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): vol.All(_entity_ids_schema, [cv.entity_id]),
        vol.Required(ATTR_MINUTES): vol.All(vol.Coerce(int), vol.Range(min=0, max=360)),
    }
)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the domain."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].setdefault(DATA_ENTITIES, {})
    await async_register_services(hass)
    await async_register_frontend(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    """Set up a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].setdefault(DATA_ENTITIES, {})
    await async_register_services(hass)
    await async_register_frontend(hass)
    await _async_backfill_optional_entities(hass, entry)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_register_services(hass: HomeAssistant) -> None:
    """Register integration services once."""
    if hass.data[DOMAIN].get(DATA_SERVICES_REGISTERED):
        return

    async def async_handle_strength(call: ServiceCall) -> None:
        entities = _resolve_entities(hass, call.data[ATTR_ENTITY_ID])
        for entity in entities:
            await entity.async_set_mist_strength(call.data[ATTR_STRENGTH])

    async def async_handle_countdown(call: ServiceCall) -> None:
        entities = _resolve_entities(hass, call.data[ATTR_ENTITY_ID])
        for entity in entities:
            await entity.async_set_countdown_minutes(call.data[ATTR_MINUTES])

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_MIST_STRENGTH,
        async_handle_strength,
        schema=SERVICE_SET_MIST_STRENGTH_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_COUNTDOWN_MINUTES,
        async_handle_countdown,
        schema=SERVICE_SET_COUNTDOWN_MINUTES_SCHEMA,
    )
    hass.data[DOMAIN][DATA_SERVICES_REGISTERED] = True


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Expose the custom card resource from the integration."""
    if hass.data[DOMAIN].get(DATA_FRONTEND_REGISTERED):
        return

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                CARD_RESOURCE_PATH,
                str(Path(__file__).parent / "frontend"),
                False,
            )
        ]
    )
    hass.data[DOMAIN][DATA_FRONTEND_REGISTERED] = True


def _resolve_entities(hass: HomeAssistant, entity_ids: Iterable[str]) -> list:
    """Resolve entity IDs to registered proxy entities."""
    registry = hass.data[DOMAIN][DATA_ENTITIES]
    return [registry[entity_id] for entity_id in entity_ids if entity_id in registry]


async def _async_backfill_optional_entities(hass: HomeAssistant, entry) -> None:
    """Populate optional entities for older config entries."""
    if CONF_LIGHT_ENTITY in entry.data:
        return

    device_id = entry.data.get(CONF_DEVICE_ID) or resolve_device_id_for_entities(
        hass,
        [
            entry.data[CONF_MIST_MODE_ENTITY],
            entry.data[CONF_MIST_STRENGTH_ENTITY],
            entry.data[CONF_COUNTDOWN_MINUTES_ENTITY],
            entry.data[CONF_COUNTDOWN_LEFT_ENTITY],
        ],
    )
    light_entity = discover_light_entity(hass, device_id)
    if not light_entity:
        return

    new_data = dict(entry.data)
    if device_id:
        new_data[CONF_DEVICE_ID] = device_id
    new_data[CONF_LIGHT_ENTITY] = light_entity
    hass.config_entries.async_update_entry(entry, data=new_data)
