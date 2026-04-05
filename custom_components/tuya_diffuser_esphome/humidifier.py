"""Humidifier platform for Tuya Diffuser ESPHome."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components.humidifier import (
    PLATFORM_SCHEMA,
    HumidifierDeviceClass,
    HumidifierEntity,
    HumidifierEntityFeature,
)
from homeassistant.const import CONF_NAME, CONF_UNIQUE_ID
from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event

from . import async_register_frontend, async_register_services
from .const import (
    ATTR_CARD_RESOURCE_URL,
    ATTR_CARD_TYPE,
    ATTR_COUNTDOWN_LEFT,
    ATTR_COUNTDOWN_MINUTES,
    ATTR_DEVICE_ID,
    ATTR_LIGHT_ENTITY,
    ATTR_MIST_STRENGTH,
    ATTR_SOURCE_ENTITIES,
    CARD_RESOURCE_URL,
    CARD_TYPE,
    CONF_COUNTDOWN_LEFT_ENTITY,
    CONF_COUNTDOWN_MINUTES_ENTITY,
    CONF_DEVICE_ID,
    CONF_LIGHT_ENTITY,
    CONF_MIST_MODE_ENTITY,
    CONF_MIST_STRENGTH_ENTITY,
    DATA_ENTITIES,
    DOMAIN,
    MODE_CONTINUOUS,
    MODE_COUNTDOWN,
    MODE_INTERVAL,
    MODE_TO_OPTION,
    OPTION_OFF,
    OPTION_TO_MODE,
    OPTION_TO_STRENGTH,
    REQUIRED_ENTITY_KEYS,
    STRENGTH_LOW,
    STRENGTH_TO_OPTION,
)

AVAILABLE_MODES = [MODE_CONTINUOUS, MODE_INTERVAL, MODE_COUNTDOWN]
UNAVAILABLE_STATES = {STATE_UNKNOWN, STATE_UNAVAILABLE}
DEFAULT_NAME = "Tuya Diffuser"

PLATFORM_SCHEMA = PLATFORM_SCHEMA.extend(
    {
        vol.Optional(CONF_NAME, default=DEFAULT_NAME): cv.string,
        vol.Optional(CONF_UNIQUE_ID): cv.string,
        vol.Required(CONF_MIST_MODE_ENTITY): cv.entity_id,
        vol.Required(CONF_MIST_STRENGTH_ENTITY): cv.entity_id,
        vol.Required(CONF_COUNTDOWN_MINUTES_ENTITY): cv.entity_id,
        vol.Required(CONF_COUNTDOWN_LEFT_ENTITY): cv.entity_id,
        vol.Optional(CONF_LIGHT_ENTITY): cv.entity_id,
    }
)


async def async_setup_platform(
    hass: HomeAssistant,
    config: dict[str, Any],
    async_add_entities: AddEntitiesCallback,
    discovery_info: dict[str, Any] | None = None,
) -> None:
    """Set up the humidifier entity from YAML."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].setdefault(DATA_ENTITIES, {})
    await async_register_services(hass)
    await async_register_frontend(hass)
    async_add_entities([TuyaDiffuserHumidifier(hass, None, yaml_config=config)])


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the humidifier entity from a config entry."""
    async_add_entities([TuyaDiffuserHumidifier(hass, entry)])


class TuyaDiffuserHumidifier(HumidifierEntity):
    """Aggregate ESPHome entities into one humidifier entity."""

    _attr_supported_features = HumidifierEntityFeature.MODES
    _attr_available_modes = AVAILABLE_MODES
    _attr_device_class = HumidifierDeviceClass.HUMIDIFIER
    _attr_icon = "mdi:air-humidifier"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, entry, yaml_config: dict[str, Any] | None = None) -> None:
        """Initialize the entity."""
        self.hass = hass
        self.config_entry = entry
        config = entry.data if entry is not None else yaml_config or {}

        self._attr_name = entry.title if entry is not None else config[CONF_NAME]
        self._attr_unique_id = entry.entry_id if entry is not None else config.get(CONF_UNIQUE_ID)

        self._mist_mode_entity = config[CONF_MIST_MODE_ENTITY]
        self._mist_strength_entity = config[CONF_MIST_STRENGTH_ENTITY]
        self._countdown_minutes_entity = config[CONF_COUNTDOWN_MINUTES_ENTITY]
        self._countdown_left_entity = config[CONF_COUNTDOWN_LEFT_ENTITY]
        self._light_entity = config.get(CONF_LIGHT_ENTITY)
        self._device_id = config.get(CONF_DEVICE_ID)

        self._is_on = False
        self._current_mode = MODE_CONTINUOUS
        self._last_mode = MODE_CONTINUOUS
        self._mist_strength = STRENGTH_LOW
        self._countdown_minutes = 120
        self._countdown_left = 0
        self._available = True

    async def async_added_to_hass(self) -> None:
        """Handle entity added to Home Assistant."""
        await super().async_added_to_hass()
        self.hass.data[DOMAIN][DATA_ENTITIES][self.entity_id] = self
        self.async_on_remove(
            async_track_state_change_event(
                self.hass,
                [
                    self._mist_mode_entity,
                    self._mist_strength_entity,
                    self._countdown_minutes_entity,
                    self._countdown_left_entity,
                ],
                self._async_handle_source_update,
            )
        )
        self.async_on_remove(self._async_unregister)
        self._refresh_from_source_states()

    @callback
    def _async_unregister(self) -> None:
        """Remove this entity from the domain registry."""
        self.hass.data[DOMAIN][DATA_ENTITIES].pop(self.entity_id, None)

    @callback
    def _async_handle_source_update(self, event) -> None:
        """Handle updates from source entities."""
        self._refresh_from_source_states()
        self.async_write_ha_state()

    @callback
    def _refresh_from_source_states(self) -> None:
        """Refresh state from underlying entities."""
        mode_state = self.hass.states.get(self._mist_mode_entity)
        strength_state = self.hass.states.get(self._mist_strength_entity)
        countdown_minutes_state = self.hass.states.get(self._countdown_minutes_entity)
        countdown_left_state = self.hass.states.get(self._countdown_left_entity)

        self._available = all(
            state is not None and state.state not in UNAVAILABLE_STATES
            for state in (mode_state, strength_state, countdown_minutes_state, countdown_left_state)
        )
        if not self._available:
            return

        mode_option = mode_state.state
        if mode_option == OPTION_OFF:
            self._is_on = False
        else:
            self._is_on = True
            mapped_mode = OPTION_TO_MODE.get(mode_option)
            if mapped_mode is not None:
                self._current_mode = mapped_mode
                self._last_mode = mapped_mode

        self._mist_strength = OPTION_TO_STRENGTH.get(strength_state.state, self._mist_strength)
        self._countdown_minutes = _coerce_int(countdown_minutes_state.state, self._countdown_minutes)
        self._countdown_left = _coerce_int(countdown_left_state.state, self._countdown_left)

    @property
    def available(self) -> bool:
        """Return entity availability."""
        return self._available

    @property
    def is_on(self) -> bool:
        """Return whether the diffuser is on."""
        return self._is_on

    @property
    def mode(self) -> str:
        """Return current humidifier mode."""
        return self._current_mode if self._is_on else self._last_mode

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return additional state attributes."""
        return {
            ATTR_MIST_STRENGTH: self._mist_strength,
            ATTR_COUNTDOWN_MINUTES: self._countdown_minutes,
            ATTR_COUNTDOWN_LEFT: self._countdown_left,
            ATTR_DEVICE_ID: self._device_id,
            ATTR_CARD_TYPE: CARD_TYPE,
            ATTR_CARD_RESOURCE_URL: CARD_RESOURCE_URL,
            ATTR_LIGHT_ENTITY: self._light_entity,
            ATTR_SOURCE_ENTITIES: {
                key: getattr(self, f"_{key}")
                for key in REQUIRED_ENTITY_KEYS
            },
        }

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn the diffuser on."""
        await self.async_set_mode(self._last_mode)

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn the diffuser off."""
        await self._async_select_mode_option(OPTION_OFF)

    async def async_set_mode(self, mode: str) -> None:
        """Set the diffuser mode."""
        option = MODE_TO_OPTION[mode]
        await self._async_select_mode_option(option)

    async def async_set_mist_strength(self, strength: str) -> None:
        """Set mist strength."""
        option = STRENGTH_TO_OPTION[strength]
        await self.hass.services.async_call(
            "select",
            "select_option",
            {
                "entity_id": self._mist_strength_entity,
                "option": option,
            },
            blocking=True,
        )

    async def async_set_countdown_minutes(self, minutes: int) -> None:
        """Set countdown minutes."""
        await self.hass.services.async_call(
            "number",
            "set_value",
            {
                "entity_id": self._countdown_minutes_entity,
                "value": minutes,
            },
            blocking=True,
        )

    async def _async_select_mode_option(self, option: str) -> None:
        """Select the underlying mist mode option."""
        await self.hass.services.async_call(
            "select",
            "select_option",
            {
                "entity_id": self._mist_mode_entity,
                "option": option,
            },
            blocking=True,
        )


def _coerce_int(value: str, fallback: int) -> int:
    """Convert string state to integer."""
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return fallback
