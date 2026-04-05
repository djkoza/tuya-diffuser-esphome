const MODE_LABELS = {
  off: "Off",
  continuous: "Ciągły",
  interval: "Interwał",
  countdown: "Timer",
};

const STRENGTH_LABELS = {
  low: "Niższa",
  high: "Wyższa",
};

const TIMER_PRESETS = [60, 120, 240];
const LIGHT_PRESETS = [
  { value: 64, label: "25%" },
  { value: 153, label: "60%" },
  { value: 255, label: "100%" },
];

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
    return 5;
  }

  async _call(action, promiseFactory) {
    this._busyAction = action;
    this._render();
    try {
      await promiseFactory();
    } finally {
      this._busyAction = null;
      this._render();
    }
  }

  _render() {
    if (!this.shadowRoot || !this._config) {
      return;
    }

    const stateObj = this._hass?.states?.[this._config.entity];
    if (!stateObj) {
      this.shadowRoot.innerHTML = `${this._styles()}
        <ha-card>
          <div class="missing">Nie znaleziono encji: ${this._config.entity}</div>
        </ha-card>`;
      return;
    }

    const attrs = stateObj.attributes ?? {};
    const title = this._config.title || attrs.friendly_name || "Dyfuzor";
    const isOn = stateObj.state !== "off";
    const mode = isOn ? attrs.mode || "continuous" : "off";
    const strength = attrs.mist_strength || "low";
    const countdownMinutes = Number(attrs.countdown_minutes ?? 120);
    const countdownLeft = Number(attrs.countdown_left ?? 0);
    const countdownProgress =
      mode === "countdown" && countdownMinutes > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((countdownLeft / countdownMinutes) * 100))
          )
        : 0;

    const lightEntityId = this._config.light_entity || attrs.light_entity || null;
    const lightState = lightEntityId ? this._hass?.states?.[lightEntityId] : null;

    this.shadowRoot.innerHTML = `
      ${this._styles()}
      <ha-card>
        <div class="card ${this._busyAction ? "busy" : ""}">
          <div class="header">
            <div class="title-block">
              <div class="eyebrow">Local-only control</div>
              <div class="title-row">
                <div class="title">${title}</div>
                <span class="status-dot ${isOn ? "is-on" : "is-off"}"></span>
              </div>
              <div class="subtitle">${this._heroSubtitle(
                mode,
                strength,
                countdownLeft
              )}</div>
            </div>
            <button class="system-button primary" data-power-toggle>
              ${isOn ? "Wyłącz" : "Włącz"}
            </button>
          </div>

          <div class="summary">
            ${this._summaryChip("Tryb", MODE_LABELS[mode] || "Off")}
            ${this._summaryChip("Moc", STRENGTH_LABELS[strength] || "Niższa")}
            ${this._summaryChip("Timer", `${countdownMinutes} min`)}
            ${mode === "countdown"
              ? this._summaryChip("Pozostało", `${countdownLeft} min`)
              : ""}
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <div class="section-label">Tryb pracy</div>
                <div class="section-meta">${isOn ? "Aktywny" : "Wyłączony"}</div>
              </div>
              <button class="system-button compact" data-more-info data-entity="${
                this._config.entity
              }">
                Szczegóły
              </button>
            </div>
            ${this._renderModeControl(mode)}
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <div class="section-label">Moc mgiełki</div>
                <div class="section-meta">${STRENGTH_LABELS[strength] || "Niższa"}</div>
              </div>
            </div>
            ${this._renderStrengthControl(strength)}
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <div class="section-label">Minutnik</div>
                <div class="section-meta">
                  ${
                    mode === "countdown"
                      ? `Pozostało ${countdownLeft} min`
                      : `Ustawione ${countdownMinutes} min`
                  }
                </div>
              </div>
            </div>
            <div class="timer-shell">
              <div class="timer-stepper">
                <button
                  class="system-button stepper-button"
                  data-minutes="${Math.max(0, countdownMinutes - 5)}"
                >
                  -5
                </button>
                <div class="timer-value">
                  <span class="timer-number">${countdownMinutes}</span>
                  <span class="timer-unit">min</span>
                </div>
                <button
                  class="system-button stepper-button"
                  data-minutes="${Math.min(360, countdownMinutes + 5)}"
                >
                  +5
                </button>
              </div>
              <div class="progress-track ${mode === "countdown" ? "visible" : ""}">
                <div class="progress-bar" style="width:${countdownProgress}%"></div>
              </div>
            </div>
            ${this._renderTimerPresetControl(countdownMinutes)}
          </div>

          ${
            this._config.show_light && lightState
              ? this._renderLightSection(lightEntityId, lightState)
              : ""
          }
        </div>
      </ha-card>
    `;

    this._setupButtons(isOn, lightEntityId, lightState);
    this._setupControlSelects(mode, strength, countdownMinutes, lightEntityId, lightState);
  }

  _setupButtons(isOn, lightEntityId, lightState) {
    this.shadowRoot.querySelectorAll("[data-power-toggle]").forEach((button) => {
      button.disabled = !!this._busyAction;
      button.addEventListener("click", () => this._togglePower(isOn));
    });

    this.shadowRoot.querySelectorAll("[data-mode]").forEach((button) => {
      button.disabled = !!this._busyAction;
      button.addEventListener("click", () => this._setMode(button.dataset.mode));
    });

    this.shadowRoot.querySelectorAll("[data-strength]").forEach((button) => {
      button.disabled = !!this._busyAction;
      button.addEventListener("click", () => this._setStrength(button.dataset.strength));
    });

    this.shadowRoot.querySelectorAll("[data-minutes]").forEach((button) => {
      button.disabled = !!this._busyAction;
      button.addEventListener("click", () =>
        this._setMinutes(Number(button.dataset.minutes))
      );
    });

    this.shadowRoot.querySelectorAll("[data-light-toggle]").forEach((button) => {
      button.disabled = !!this._busyAction;
      button.addEventListener("click", () =>
        this._toggleLight(lightEntityId, lightState)
      );
    });

    this.shadowRoot.querySelectorAll("[data-light-brightness]").forEach((button) => {
      button.disabled = !!this._busyAction;
      button.addEventListener("click", () =>
        this._setLightBrightness(lightEntityId, Number(button.dataset.lightBrightness))
      );
    });

    this.shadowRoot.querySelectorAll("[data-more-info]").forEach((button) => {
      button.addEventListener("click", () => this._showMoreInfo(button.dataset.entity));
    });
  }

  _setupControlSelects(mode, strength, countdownMinutes, lightEntityId, lightState) {
    this._configureControlSelect(
      "mode-control",
      [
        { value: "off", label: MODE_LABELS.off },
        { value: "continuous", label: MODE_LABELS.continuous },
        { value: "interval", label: MODE_LABELS.interval },
        { value: "countdown", label: MODE_LABELS.countdown },
      ],
      mode,
      (value) => this._setMode(value)
    );

    this._configureControlSelect(
      "strength-control",
      [
        { value: "low", label: STRENGTH_LABELS.low },
        { value: "high", label: STRENGTH_LABELS.high },
      ],
      strength,
      (value) => this._setStrength(value)
    );

    this._configureControlSelect(
      "timer-presets",
      TIMER_PRESETS.map((preset) => ({
        value: String(preset),
        label: `${preset} min`,
      })),
      TIMER_PRESETS.includes(countdownMinutes) ? String(countdownMinutes) : undefined,
      (value) => this._setMinutes(Number(value))
    );

    if (!lightEntityId || !lightState) {
      return;
    }

    const brightness = lightState.attributes?.brightness;
    const presetValue = LIGHT_PRESETS.find(
      (preset) => preset.value === Number(brightness)
    )?.value;

    this._configureControlSelect(
      "light-presets",
      LIGHT_PRESETS.map((preset) => ({
        value: String(preset.value),
        label: preset.label,
      })),
      presetValue !== undefined ? String(presetValue) : undefined,
      (value) => this._setLightBrightness(lightEntityId, Number(value))
    );
  }

  _configureControlSelect(id, options, value, callback) {
    const control = this.shadowRoot.getElementById(id);
    if (!control) {
      return;
    }
    control.options = options;
    control.value = value;
    control.disabled = !!this._busyAction;
    control.addEventListener("value-changed", (ev) => {
      const next = ev.detail?.value;
      if (next !== undefined) {
        callback(String(next));
      }
    });
  }

  _summaryChip(label, value) {
    return `
      <div class="summary-chip">
        <span class="summary-chip-label">${label}</span>
        <span class="summary-chip-value">${value}</span>
      </div>
    `;
  }

  _renderModeControl(activeMode) {
    if (customElements.get("ha-control-select")) {
      return `<ha-control-select id="mode-control" aria-label="Tryb pracy"></ha-control-select>`;
    }
    return `
      <div class="fallback-grid">
        ${this._fallbackButton("off", MODE_LABELS.off, "mode", activeMode)}
        ${this._fallbackButton(
          "continuous",
          MODE_LABELS.continuous,
          "mode",
          activeMode
        )}
        ${this._fallbackButton("interval", MODE_LABELS.interval, "mode", activeMode)}
        ${this._fallbackButton(
          "countdown",
          MODE_LABELS.countdown,
          "mode",
          activeMode
        )}
      </div>
    `;
  }

  _renderStrengthControl(activeStrength) {
    if (customElements.get("ha-control-select")) {
      return `<ha-control-select id="strength-control" aria-label="Moc mgiełki"></ha-control-select>`;
    }
    return `
      <div class="fallback-grid two-columns">
        ${this._fallbackButton("low", STRENGTH_LABELS.low, "strength", activeStrength)}
        ${this._fallbackButton("high", STRENGTH_LABELS.high, "strength", activeStrength)}
      </div>
    `;
  }

  _renderTimerPresetControl(activeMinutes) {
    if (customElements.get("ha-control-select")) {
      return `<ha-control-select id="timer-presets" aria-label="Presety minutnika"></ha-control-select>`;
    }
    return `
      <div class="fallback-grid timer-presets">
        ${TIMER_PRESETS.map((preset) =>
          this._fallbackButton(String(preset), `${preset} min`, "minutes", String(activeMinutes))
        ).join("")}
      </div>
    `;
  }

  _renderLightSection(entityId, stateObj) {
    const isOn = stateObj.state === "on";
    const brightness = stateObj.attributes?.brightness
      ? Math.round((stateObj.attributes.brightness / 255) * 100)
      : 100;
    const lightLabel = isOn ? `${brightness}%` : "Wyłączone";
    const preview = this._lightPreview(stateObj);

    return `
      <div class="section">
        <div class="section-head">
          <div>
            <div class="section-label">Podświetlenie</div>
            <div class="section-meta">${lightLabel}</div>
          </div>
          <button class="system-button compact" data-more-info data-entity="${entityId}">
            Panel światła
          </button>
        </div>
        <div class="light-row">
          <div class="light-swatch">
            <span class="light-dot" style="${preview}"></span>
            <span class="light-state">${isOn ? "Włączone" : "Wyłączone"}</span>
          </div>
          <button class="system-button" data-light-toggle>
            ${isOn ? "Wyłącz światło" : "Włącz światło"}
          </button>
        </div>
        ${
          customElements.get("ha-control-select")
            ? `<ha-control-select id="light-presets" aria-label="Presety jasności światła"></ha-control-select>`
            : `<div class="fallback-grid timer-presets">
                ${LIGHT_PRESETS.map((preset) =>
                  `<button class="fallback-button" data-light-brightness="${preset.value}">${preset.label}</button>`
                ).join("")}
              </div>`
        }
      </div>
    `;
  }

  _fallbackButton(value, label, datasetKey, activeValue) {
    const active = String(value) === String(activeValue);
    return `
      <button class="fallback-button ${active ? "active" : ""}" data-${datasetKey}="${value}">
        ${label}
      </button>
    `;
  }

  _lightPreview(stateObj) {
    const rgb = stateObj.attributes?.rgb_color;
    if (Array.isArray(rgb) && rgb.length === 3) {
      return `background: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]});`;
    }
    if (stateObj.state === "on") {
      return "background: var(--warning-color, #ffb74d);";
    }
    return "background: var(--disabled-text-color);";
  }

  _heroSubtitle(mode, strength, countdownLeft) {
    if (mode === "countdown") {
      return `Timer aktywny, ${countdownLeft} min do końca`;
    }
    if (mode === "interval") {
      return `Praca interwałowa, moc ${STRENGTH_LABELS[strength] || "Niższa"}`;
    }
    if (mode === "continuous") {
      return `Praca ciągła, moc ${STRENGTH_LABELS[strength] || "Niższa"}`;
    }
    return "Urządzenie gotowe do uruchomienia";
  }

  async _setMode(mode) {
    if (!this._hass || this._busyAction) return;
    await this._call(`mode:${mode}`, async () => {
      if (mode === "off") {
        await this._hass.callService("humidifier", "turn_off", {
          entity_id: this._config.entity,
        });
        return;
      }
      await this._hass.callService("humidifier", "set_mode", {
        entity_id: this._config.entity,
        mode,
      });
    });
  }

  async _togglePower(isOn) {
    if (!this._hass || this._busyAction) return;
    await this._call(`power:${isOn ? "off" : "on"}`, async () => {
      await this._hass.callService("humidifier", isOn ? "turn_off" : "turn_on", {
        entity_id: this._config.entity,
      });
    });
  }

  async _setStrength(strength) {
    if (!this._hass || this._busyAction) return;
    await this._call(`strength:${strength}`, async () => {
      await this._hass.callService("tuya_diffuser_esphome", "set_mist_strength", {
        entity_id: this._config.entity,
        strength,
      });
    });
  }

  async _setMinutes(minutes) {
    if (!this._hass || this._busyAction) return;
    await this._call(`minutes:${minutes}`, async () => {
      await this._hass.callService(
        "tuya_diffuser_esphome",
        "set_countdown_minutes",
        {
          entity_id: this._config.entity,
          minutes,
        }
      );
    });
  }

  async _toggleLight(entityId, lightState) {
    if (!this._hass || !entityId || this._busyAction) return;
    const service = lightState?.state === "on" ? "turn_off" : "turn_on";
    await this._call(`light:${service}`, async () => {
      await this._hass.callService("light", service, {
        entity_id: entityId,
      });
    });
  }

  async _setLightBrightness(entityId, brightness) {
    if (!this._hass || !entityId || this._busyAction) return;
    await this._call(`light:brightness:${brightness}`, async () => {
      await this._hass.callService("light", "turn_on", {
        entity_id: entityId,
        brightness,
      });
    });
  }

  _showMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        bubbles: true,
        composed: true,
        detail: { entityId },
      })
    );
  }

  _styles() {
    return `
      <style>
        :host {
          display: block;
        }

        ha-card {
          color: var(--primary-text-color);
          background: var(--ha-card-background, var(--card-background-color));
        }

        .card {
          display: grid;
          gap: 16px;
          padding: 16px;
        }

        .card.busy {
          opacity: 0.72;
          pointer-events: none;
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .title-block {
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .eyebrow,
        .section-label,
        .summary-chip-label,
        .timer-unit {
          color: var(--secondary-text-color);
          font-size: 12px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .title {
          font-size: 1.25rem;
          font-weight: 600;
          line-height: 1.2;
        }

        .subtitle,
        .section-meta {
          color: var(--secondary-text-color);
          font-size: 0.95rem;
          line-height: 1.4;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex: 0 0 auto;
          background: var(--disabled-color);
        }

        .status-dot.is-on {
          background: var(--success-color, #43a047);
        }

        .summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .summary-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid var(--divider-color);
          background: var(
            --ha-color-fill-neutral-quiet-resting,
            var(--secondary-background-color)
          );
        }

        .summary-chip-value {
          font-weight: 600;
        }

        .section {
          display: grid;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--divider-color);
        }

        .section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .system-button,
        .fallback-button {
          appearance: none;
          border: 1px solid var(--divider-color);
          border-radius: var(--ha-card-border-radius, 12px);
          background: var(
            --ha-color-fill-neutral-quiet-resting,
            var(--secondary-background-color)
          );
          color: var(--primary-text-color);
          font: inherit;
          cursor: pointer;
          min-height: 42px;
          padding: 0 14px;
          transition: background-color 120ms ease, border-color 120ms ease,
            color 120ms ease, opacity 120ms ease;
        }

        .system-button:hover,
        .fallback-button:hover {
          background: var(
            --ha-color-fill-neutral-quiet-hover,
            var(--secondary-background-color)
          );
        }

        .system-button.primary {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: var(--text-primary-color, #fff);
          font-weight: 600;
        }

        .system-button.compact {
          min-height: 36px;
          padding: 0 12px;
        }

        .fallback-button.active {
          border-color: var(--primary-color);
          box-shadow: inset 0 0 0 1px var(--primary-color);
          color: var(--primary-color);
        }

        .fallback-grid {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .fallback-grid.two-columns {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .timer-presets {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .timer-shell {
          display: grid;
          gap: 10px;
        }

        .timer-stepper {
          display: grid;
          gap: 10px;
          grid-template-columns: 72px minmax(0, 1fr) 72px;
          align-items: center;
        }

        .stepper-button {
          padding: 0;
        }

        .timer-value {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 8px;
          min-height: 48px;
          border-radius: var(--ha-card-border-radius, 12px);
          background: var(
            --ha-color-fill-neutral-quiet-resting,
            var(--secondary-background-color)
          );
        }

        .timer-number {
          font-size: 1.75rem;
          font-weight: 600;
          line-height: 1;
        }

        .progress-track {
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: var(
            --ha-color-fill-neutral-normal-resting,
            rgba(127, 127, 127, 0.18)
          );
          opacity: 0.45;
        }

        .progress-track.visible {
          opacity: 1;
        }

        .progress-bar {
          height: 100%;
          border-radius: inherit;
          background: var(--primary-color);
        }

        ha-control-select {
          --control-select-color: var(--primary-color);
          --control-select-background: var(--disabled-color);
          --control-select-background-opacity: 0.14;
          --control-select-thickness: 44px;
          --control-select-border-radius: var(--ha-card-border-radius, 12px);
        }

        .light-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--divider-color);
          border-radius: var(--ha-card-border-radius, 12px);
          background: var(
            --ha-color-fill-neutral-quiet-resting,
            var(--secondary-background-color)
          );
        }

        .light-swatch {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .light-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          flex: 0 0 auto;
          box-shadow: 0 0 0 2px var(--card-background-color);
        }

        .light-state {
          color: var(--secondary-text-color);
        }

        .missing {
          padding: 16px;
        }

        @media (max-width: 700px) {
          .header,
          .light-row,
          .section-head {
            display: grid;
          }

          .fallback-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .timer-stepper {
            grid-template-columns: 60px minmax(0, 1fr) 60px;
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
  description: "Single-panel control card for the Tuya Diffuser ESPHome integration.",
});
