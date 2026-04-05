"""Config flow for Tuya Diffuser ESPHome."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.helpers import selector

from .const import (
    CONF_CANDIDATE,
    CONF_COUNTDOWN_LEFT_ENTITY,
    CONF_COUNTDOWN_MINUTES_ENTITY,
    CONF_DEVICE_ID,
    CONF_LIGHT_ENTITY,
    CONF_MIST_MODE_ENTITY,
    CONF_MIST_STRENGTH_ENTITY,
    CONF_SOURCE_TYPE,
    CONF_TITLE,
    DOMAIN,
    REQUIRED_ENTITY_KEYS,
    SOURCE_AUTO,
    SOURCE_MANUAL,
)
from .discovery import discover_candidates, resolve_device_id_for_entities

MANUAL_CHOICE = "__manual__"


class TuyaDiffuserEspHomeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for the integration."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize the config flow."""
        self._candidates = {}

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Handle the initial step."""
        self._candidates = discover_candidates(self.hass)

        if user_input is not None:
            candidate_key = user_input[CONF_CANDIDATE]
            if candidate_key == MANUAL_CHOICE:
                return await self.async_step_manual()

            candidate = self._candidates[candidate_key]
            await self.async_set_unique_id(candidate.data[CONF_DEVICE_ID])
            self._abort_if_unique_id_configured()
            data = {
                key: candidate.data[key]
                for key in (CONF_DEVICE_ID, CONF_SOURCE_TYPE, *REQUIRED_ENTITY_KEYS)
            }
            if CONF_LIGHT_ENTITY in candidate.data:
                data[CONF_LIGHT_ENTITY] = candidate.data[CONF_LIGHT_ENTITY]
            return self.async_create_entry(title=candidate.title, data=data)

        if not self._candidates:
            return await self.async_step_manual()

        options = [
            selector.SelectOptionDict(value=key, label=candidate.title)
            for key, candidate in sorted(self._candidates.items(), key=lambda item: item[1].title.lower())
            if not self._is_candidate_configured(candidate)
        ]
        options.append(selector.SelectOptionDict(value=MANUAL_CHOICE, label="Manual setup"))

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_CANDIDATE): selector.SelectSelector(
                        selector.SelectSelectorConfig(options=options, mode=selector.SelectSelectorMode.DROPDOWN)
                    )
                }
            ),
        )

    async def async_step_manual(self, user_input: dict[str, Any] | None = None):
        """Handle manual configuration."""
        errors: dict[str, str] = {}

        if user_input is not None:
            if len(set(user_input[key] for key in REQUIRED_ENTITY_KEYS)) != len(REQUIRED_ENTITY_KEYS):
                errors["base"] = "duplicate_entities"
            else:
                device_id = resolve_device_id_for_entities(
                    self.hass,
                    [user_input[key] for key in REQUIRED_ENTITY_KEYS],
                )
                unique_id = device_id or f"manual::{user_input[CONF_MIST_MODE_ENTITY]}"
                await self.async_set_unique_id(unique_id)
                self._abort_if_unique_id_configured()

                title = user_input[CONF_NAME]
                data = {
                    CONF_SOURCE_TYPE: SOURCE_MANUAL,
                    **{key: user_input[key] for key in REQUIRED_ENTITY_KEYS},
                }
                if user_input.get(CONF_LIGHT_ENTITY):
                    data[CONF_LIGHT_ENTITY] = user_input[CONF_LIGHT_ENTITY]
                if device_id:
                    data[CONF_DEVICE_ID] = device_id
                return self.async_create_entry(title=title, data=data)

        return self.async_show_form(
            step_id="manual",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_NAME): str,
                    vol.Required(CONF_MIST_MODE_ENTITY): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="select")
                    ),
                    vol.Required(CONF_MIST_STRENGTH_ENTITY): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="select")
                    ),
                    vol.Required(CONF_COUNTDOWN_MINUTES_ENTITY): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="number")
                    ),
                    vol.Required(CONF_COUNTDOWN_LEFT_ENTITY): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="sensor")
                    ),
                    vol.Optional(CONF_LIGHT_ENTITY): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="light")
                    ),
                }
            ),
            errors=errors,
        )

    @staticmethod
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        """Get the options flow for this handler."""
        return TuyaDiffuserEspHomeOptionsFlow(config_entry)

    def _is_candidate_configured(self, candidate) -> bool:
        """Check if a candidate device is already configured."""
        existing_ids = {entry.unique_id for entry in self._async_current_entries()}
        return candidate.data[CONF_DEVICE_ID] in existing_ids


class TuyaDiffuserEspHomeOptionsFlow(config_entries.OptionsFlow):
    """Handle options for the integration."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        """Manage the integration options."""
        errors: dict[str, str] = {}

        if user_input is not None:
            if len(set(user_input[key] for key in REQUIRED_ENTITY_KEYS)) != len(REQUIRED_ENTITY_KEYS):
                errors["base"] = "duplicate_entities"
            else:
                new_data = {
                    key: user_input[key]
                    for key in REQUIRED_ENTITY_KEYS
                }
                if user_input.get(CONF_LIGHT_ENTITY):
                    new_data[CONF_LIGHT_ENTITY] = user_input[CONF_LIGHT_ENTITY]
                new_data[CONF_SOURCE_TYPE] = self.config_entry.data.get(CONF_SOURCE_TYPE, SOURCE_MANUAL)
                if device_id := resolve_device_id_for_entities(
                    self.hass, [new_data[key] for key in REQUIRED_ENTITY_KEYS]
                ):
                    new_data[CONF_DEVICE_ID] = device_id

                self.hass.config_entries.async_update_entry(
                    self.config_entry,
                    title=user_input[CONF_NAME],
                    data=new_data,
                )
                return self.async_create_entry(title="", data={})

        defaults = self._defaults()
        schema: dict[vol.Marker, object] = {
            vol.Required(CONF_NAME, default=self.config_entry.title): str,
            vol.Required(CONF_MIST_MODE_ENTITY, default=defaults[CONF_MIST_MODE_ENTITY]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="select")
            ),
            vol.Required(
                CONF_MIST_STRENGTH_ENTITY,
                default=defaults[CONF_MIST_STRENGTH_ENTITY],
            ): selector.EntitySelector(selector.EntitySelectorConfig(domain="select")),
            vol.Required(
                CONF_COUNTDOWN_MINUTES_ENTITY,
                default=defaults[CONF_COUNTDOWN_MINUTES_ENTITY],
            ): selector.EntitySelector(selector.EntitySelectorConfig(domain="number")),
            vol.Required(
                CONF_COUNTDOWN_LEFT_ENTITY,
                default=defaults[CONF_COUNTDOWN_LEFT_ENTITY],
            ): selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor")),
        }
        if CONF_LIGHT_ENTITY in defaults:
            schema[vol.Optional(CONF_LIGHT_ENTITY, default=defaults[CONF_LIGHT_ENTITY])] = selector.EntitySelector(
                selector.EntitySelectorConfig(domain="light")
            )
        else:
            schema[vol.Optional(CONF_LIGHT_ENTITY)] = selector.EntitySelector(
                selector.EntitySelectorConfig(domain="light")
            )

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(schema),
            errors=errors,
        )

    def _defaults(self) -> Mapping[str, str]:
        """Return current entity defaults."""
        return {
            key: self.config_entry.data[key]
            for key in REQUIRED_ENTITY_KEYS
        } | (
            {CONF_LIGHT_ENTITY: self.config_entry.data[CONF_LIGHT_ENTITY]}
            if CONF_LIGHT_ENTITY in self.config_entry.data
            else {}
        )
