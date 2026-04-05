"""Select platform for Tuya Diffuser ESPHome."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .base import TuyaDiffuserBaseEntity
from .const import (
    CONF_MIST_MODE_ENTITY,
    CONF_MIST_STRENGTH_ENTITY,
)


async def async_setup_entry(hass, entry, async_add_entities: AddEntitiesCallback) -> None:
    """Set up select entities for a config entry."""
    async_add_entities(
        [
            TuyaDiffuserSelectEntity(
                hass,
                entry,
                entry.data[CONF_MIST_MODE_ENTITY],
                "mist_mode",
                "Mode",
                icon="mdi:air-humidifier",
            ),
            TuyaDiffuserSelectEntity(
                hass,
                entry,
                entry.data[CONF_MIST_STRENGTH_ENTITY],
                "mist_strength",
                "Strength",
                icon="mdi:weather-windy",
            ),
        ]
    )


class TuyaDiffuserSelectEntity(TuyaDiffuserBaseEntity, SelectEntity):
    """Proxy a source select entity."""

    def __init__(
        self,
        hass,
        entry,
        source_entity_id: str,
        unique_suffix: str,
        name: str,
        *,
        icon: str,
    ) -> None:
        """Initialize the select entity."""
        super().__init__(hass, entry, source_entity_id, unique_suffix, name)
        self._attr_icon = icon
        self._attr_current_option = None
        self._attr_options = []

    def _refresh_from_source_state(self) -> None:
        """Refresh from source select."""
        state = self._source_state()
        if not self._update_availability(state):
            return

        self._attr_current_option = state.state
        self._attr_options = list(state.attributes.get("options", []))

    async def async_select_option(self, option: str) -> None:
        """Select an option on the source entity."""
        await self.hass.services.async_call(
            "select",
            "select_option",
            {
                "entity_id": self._source_entity_id,
                "option": option,
            },
            blocking=True,
        )
