"""Sensor platform for Tuya Diffuser ESPHome."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.const import UnitOfTime
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .base import TuyaDiffuserBaseEntity
from .const import CONF_COUNTDOWN_LEFT_ENTITY


async def async_setup_entry(hass, entry, async_add_entities: AddEntitiesCallback) -> None:
    """Set up sensor entities for a config entry."""
    async_add_entities(
        [
            TuyaDiffuserCountdownLeftSensor(
                hass,
                entry,
                entry.data[CONF_COUNTDOWN_LEFT_ENTITY],
            )
        ]
    )


class TuyaDiffuserCountdownLeftSensor(TuyaDiffuserBaseEntity, SensorEntity):
    """Proxy the countdown-left source sensor."""

    _attr_icon = "mdi:timer-sand"
    _attr_native_unit_of_measurement = UnitOfTime.MINUTES

    def __init__(self, hass, entry, source_entity_id: str) -> None:
        """Initialize the sensor entity."""
        super().__init__(
            hass,
            entry,
            source_entity_id,
            "countdown_left",
            "Time Left",
        )
        self._attr_native_value = None

    def _refresh_from_source_state(self) -> None:
        """Refresh from source sensor."""
        state = self._source_state()
        if not self._update_availability(state):
            return

        try:
            self._attr_native_value = int(round(float(state.state)))
        except (TypeError, ValueError):
            self._attr_native_value = None
