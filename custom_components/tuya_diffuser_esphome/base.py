"""Shared entity helpers for Tuya Diffuser ESPHome."""

from __future__ import annotations

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import callback
from homeassistant.helpers.entity import Entity
from homeassistant.helpers.event import async_track_state_change_event

from .const import CONF_DEVICE_ID, DOMAIN

UNAVAILABLE_STATES = {STATE_UNKNOWN, STATE_UNAVAILABLE}


class TuyaDiffuserBaseEntity(Entity):
    """Shared behavior for proxy entities."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, hass, entry, source_entity_id: str, unique_suffix: str, name: str) -> None:
        """Initialize the proxy entity."""
        self.hass = hass
        self.config_entry = entry
        self._source_entity_id = source_entity_id
        self._attr_unique_id = f"{entry.entry_id}:{unique_suffix}"
        self._attr_name = name
        self._available = False
        self._device_identifier = entry.data.get(CONF_DEVICE_ID) or entry.entry_id

    async def async_added_to_hass(self) -> None:
        """Subscribe to source entity changes."""
        await super().async_added_to_hass()
        self.async_on_remove(
            async_track_state_change_event(
                self.hass,
                [self._source_entity_id],
                self._async_handle_source_update,
            )
        )
        self._refresh_from_source_state()

    @property
    def available(self) -> bool:
        """Return whether the proxy entity is available."""
        return self._available

    @property
    def device_info(self) -> dict:
        """Return shared device info for all proxy entities."""
        return {
            "identifiers": {(DOMAIN, self._device_identifier)},
            "name": self.config_entry.title,
            "manufacturer": "Tuya / ESPHome",
            "model": "Tuya Diffuser",
        }

    def _source_state(self):
        """Return the underlying source state object."""
        return self.hass.states.get(self._source_entity_id)

    def _update_availability(self, state) -> bool:
        """Update availability from a source state object."""
        self._available = state is not None and state.state not in UNAVAILABLE_STATES
        return self._available

    @property
    def extra_state_attributes(self) -> dict:
        """Expose the linked source entity for troubleshooting."""
        return {
            "source_entity_id": self._source_entity_id,
        }

    @callback
    def _async_handle_source_update(self, _event) -> None:
        """Refresh local state when the source entity updates."""
        self._refresh_from_source_state()
        self.async_write_ha_state()

    def _refresh_from_source_state(self) -> None:
        """Refresh state from the source entity."""
        raise NotImplementedError
