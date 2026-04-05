"""Number platform for Tuya Diffuser ESPHome."""

from __future__ import annotations

from homeassistant.components.number import NumberEntity
from homeassistant.const import UnitOfTime
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .base import TuyaDiffuserBaseEntity
from .const import CONF_COUNTDOWN_MINUTES_ENTITY


async def async_setup_entry(hass, entry, async_add_entities: AddEntitiesCallback) -> None:
    """Set up number entities for a config entry."""
    async_add_entities(
        [
            TuyaDiffuserCountdownMinutesNumber(
                hass,
                entry,
                entry.data[CONF_COUNTDOWN_MINUTES_ENTITY],
            )
        ]
    )


class TuyaDiffuserCountdownMinutesNumber(TuyaDiffuserBaseEntity, NumberEntity):
    """Proxy the countdown minutes source number."""

    _attr_icon = "mdi:timer-cog-outline"
    _attr_native_min_value = 0
    _attr_native_max_value = 360
    _attr_native_step = 1
    _attr_native_unit_of_measurement = UnitOfTime.MINUTES

    def __init__(self, hass, entry, source_entity_id: str) -> None:
        """Initialize the number entity."""
        super().__init__(
            hass,
            entry,
            source_entity_id,
            "countdown_minutes",
            "Timer",
        )
        self._attr_native_value = None

    def _refresh_from_source_state(self) -> None:
        """Refresh from source number."""
        state = self._source_state()
        if not self._update_availability(state):
            return

        try:
            self._attr_native_value = float(state.state)
        except (TypeError, ValueError):
            self._attr_native_value = None

    async def async_set_native_value(self, value: float) -> None:
        """Set countdown minutes on the source entity."""
        await self.hass.services.async_call(
            "number",
            "set_value",
            {
                "entity_id": self._source_entity_id,
                "value": value,
            },
            blocking=True,
        )
