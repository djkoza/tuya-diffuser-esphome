const SOURCE_KEYS = {
  mistMode: "mist_mode_entity",
  mistStrength: "mist_strength_entity",
  countdownMinutes: "countdown_minutes_entity",
  countdownLeft: "countdown_left_entity",
};

class TuyaDiffuserEsphomeCard extends HTMLElement {
  static getStubConfig() {
    return {
      entity: "humidifier.livingroom_diffuser",
      title: "Dyfuzor",
    };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Missing entity");
    }

    this._config = {
      title: "Dyfuzor",
      show_light: true,
      ...config,
    };

    this._cards = this._cards || new Map();
    this._renderVersion = 0;

    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 6;
  }

  async _render() {
    if (!this.shadowRoot || !this._config) {
      return;
    }

    const stateObj = this._hass?.states?.[this._config.entity];
    if (!stateObj) {
      this._teardownCards();
      this.shadowRoot.innerHTML = `
        ${this._styles()}
        <ha-card>
          <div class="missing">Nie znaleziono encji: ${this._config.entity}</div>
        </ha-card>
      `;
      return;
    }

    const renderVersion = ++this._renderVersion;
    const attrs = stateObj.attributes ?? {};
    const sourceEntities = attrs.source_entities ?? {};

    const mistModeEntity = sourceEntities[SOURCE_KEYS.mistMode];
    const mistStrengthEntity = sourceEntities[SOURCE_KEYS.mistStrength];
    const countdownMinutesEntity = sourceEntities[SOURCE_KEYS.countdownMinutes];
    const countdownLeftEntity = sourceEntities[SOURCE_KEYS.countdownLeft];
    const lightEntity = this._config.light_entity || attrs.light_entity || null;

    const currentModeState = mistModeEntity
      ? this._hass?.states?.[mistModeEntity]?.state
      : null;
    const countdownLeftState = countdownLeftEntity
      ? this._hass?.states?.[countdownLeftEntity]
      : null;
    const countdownLeftValue = countdownLeftState
      ? Number.parseInt(countdownLeftState.state, 10)
      : 0;
    const showCountdownControls = currentModeState === "Countdown";
    const showCountdownLeft =
      showCountdownControls &&
      !!countdownLeftEntity &&
      Number.isFinite(countdownLeftValue);

    this.shadowRoot.innerHTML = `
      ${this._styles()}
      <div class="layout">
        <div class="top-grid ${lightEntity && this._config.show_light ? "has-light" : ""}">
          <div id="humidifier-tile"></div>
          ${
            lightEntity && this._config.show_light
              ? '<div id="light-tile"></div>'
              : ""
          }
        </div>

        <div class="control-grid">
          ${mistModeEntity ? '<div id="mist-mode-tile"></div>' : ""}
          ${mistStrengthEntity ? '<div id="mist-strength-tile"></div>' : ""}
          ${showCountdownControls && countdownMinutesEntity ? '<div id="countdown-minutes-tile"></div>' : ""}
          ${showCountdownLeft ? '<div id="countdown-left-tile"></div>' : ""}
        </div>
      </div>
    `;

    const activeSlots = new Set();

    await this._mountTileCard(
      "humidifier-tile",
      this._humidifierTileConfig(stateObj),
      activeSlots,
      renderVersion
    );

    if (lightEntity && this._config.show_light) {
      await this._mountTileCard(
        "light-tile",
        this._lightTileConfig(lightEntity),
        activeSlots,
        renderVersion
      );
    }

    if (mistModeEntity) {
      await this._mountTileCard(
        "mist-mode-tile",
        this._selectTileConfig(mistModeEntity, "Tryb mgiełki"),
        activeSlots,
        renderVersion
      );
    }

    if (mistStrengthEntity) {
      await this._mountTileCard(
        "mist-strength-tile",
        this._selectTileConfig(mistStrengthEntity, "Moc mgiełki"),
        activeSlots,
        renderVersion
      );
    }

    if (showCountdownControls && countdownMinutesEntity) {
      await this._mountTileCard(
        "countdown-minutes-tile",
        this._countdownMinutesTileConfig(countdownMinutesEntity),
        activeSlots,
        renderVersion
      );
    }

    if (showCountdownLeft && countdownLeftEntity) {
      await this._mountTileCard(
        "countdown-left-tile",
        this._countdownLeftTileConfig(countdownLeftEntity),
        activeSlots,
        renderVersion
      );
    }

    this._cleanupCards(activeSlots);
  }

  _humidifierTileConfig(stateObj) {
    return {
      type: "tile",
      entity: this._config.entity,
      name: this._config.title || stateObj.attributes?.friendly_name || "Dyfuzor",
      vertical: false,
      features_position: "bottom",
      tap_action: { action: "more-info" },
      icon_tap_action: { action: "more-info" },
      features: [{ type: "toggle" }],
    };
  }

  _lightTileConfig(entityId) {
    return {
      type: "tile",
      entity: entityId,
      name: "Podświetlenie",
      vertical: false,
      features_position: "bottom",
      tap_action: { action: "more-info" },
      icon_tap_action: { action: "more-info" },
      features: [{ type: "toggle" }],
    };
  }

  _selectTileConfig(entityId, name) {
    return {
      type: "tile",
      entity: entityId,
      name,
      vertical: false,
      features_position: "inline",
      tap_action: { action: "more-info" },
      icon_tap_action: { action: "more-info" },
      features: [{ type: "select-options" }],
    };
  }

  _countdownMinutesTileConfig(entityId) {
    return {
      type: "tile",
      entity: entityId,
      name: "Minutnik",
      vertical: false,
      features_position: "inline",
      tap_action: { action: "more-info" },
      icon_tap_action: { action: "more-info" },
      features: [{ type: "numeric-input", style: "buttons" }],
    };
  }

  _countdownLeftTileConfig(entityId) {
    return {
      type: "tile",
      entity: entityId,
      name: "Pozostało",
      vertical: false,
      tap_action: { action: "more-info" },
      icon_tap_action: { action: "more-info" },
    };
  }

  async _mountTileCard(slotId, config, activeSlots, renderVersion) {
    const container = this.shadowRoot?.getElementById(slotId);
    if (!container || !config) {
      this._removeCard(slotId);
      return;
    }

    activeSlots.add(slotId);
    const configKey = JSON.stringify(config);
    let cardEntry = this._cards.get(slotId);

    if (!cardEntry || cardEntry.key !== configKey) {
      const helpers = await this._loadCardHelpers();
      if (renderVersion !== this._renderVersion) {
        return;
      }

      const element = await helpers.createCardElement(config);
      if (renderVersion !== this._renderVersion) {
        return;
      }

      cardEntry = { key: configKey, element };
      this._cards.set(slotId, cardEntry);
    }

    cardEntry.element.hass = this._hass;
    if (cardEntry.element.parentElement !== container) {
      container.replaceChildren(cardEntry.element);
    }
  }

  _cleanupCards(activeSlots) {
    for (const slotId of [...this._cards.keys()]) {
      if (!activeSlots.has(slotId)) {
        this._removeCard(slotId);
      }
    }
  }

  _removeCard(slotId) {
    const entry = this._cards?.get(slotId);
    if (entry?.element?.parentElement) {
      entry.element.parentElement.removeChild(entry.element);
    }
    this._cards?.delete(slotId);
  }

  _teardownCards() {
    if (!this._cards) {
      return;
    }
    for (const slotId of [...this._cards.keys()]) {
      this._removeCard(slotId);
    }
  }

  async _loadCardHelpers() {
    if (!this._helpersPromise) {
      this._helpersPromise = window.loadCardHelpers();
    }
    return this._helpersPromise;
  }

  _styles() {
    return `
      <style>
        :host {
          display: block;
        }

        .layout {
          display: grid;
          gap: 12px;
        }

        .top-grid,
        .control-grid {
          display: grid;
          gap: 12px;
        }

        .top-grid.has-light {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .missing {
          padding: 16px;
          color: var(--secondary-text-color);
        }

        @media (max-width: 900px) {
          .top-grid.has-light {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;
  }
}

customElements.define("tuya-diffuser-esphome-card", TuyaDiffuserEsphomeCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tuya-diffuser-esphome-card",
  name: "Tuya Diffuser ESPHome Card",
  description: "Tile-based control card for the Tuya Diffuser ESPHome integration.",
});
