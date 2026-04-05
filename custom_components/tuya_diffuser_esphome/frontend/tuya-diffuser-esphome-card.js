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
    return 6;
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
    const mode = isOn ? (attrs.mode || "continuous") : "off";
    const strength = attrs.mist_strength || "low";
    const countdownMinutes = Number(attrs.countdown_minutes ?? 120);
    const countdownLeft = Number(attrs.countdown_left ?? 0);
    const countdownProgress = countdownMinutes > 0
      ? Math.max(0, Math.min(100, Math.round((countdownLeft / countdownMinutes) * 100)))
      : 0;

    const lightEntityId =
      this._config.light_entity ||
      attrs.light_entity ||
      null;
    const lightState = lightEntityId ? this._hass?.states?.[lightEntityId] : null;

    this.shadowRoot.innerHTML = `
      ${this._styles()}
      <ha-card>
        <div class="card ${this._busyAction ? "busy" : ""}">
          <div class="hero">
            <div class="hero-copy">
              <div class="eyebrow">Local-only control</div>
              <div class="title">${title}</div>
              <div class="subtitle">
                ${this._heroSubtitle(mode, strength, countdownLeft)}
              </div>
            </div>
            <button class="power ${isOn ? "on" : "off"}" data-power-toggle>
              <span class="power-dot"></span>
              ${isOn ? "Wyłącz" : "Włącz"}
            </button>
          </div>

          <div class="stats">
            <div class="stat">
              <div class="stat-label">Tryb</div>
              <div class="stat-value">${MODE_LABELS[mode] || "Off"}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Moc</div>
              <div class="stat-value">${STRENGTH_LABELS[strength] || "Niższa"}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Timer</div>
              <div class="stat-value">${countdownMinutes} min</div>
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="label">Tryb pracy</div>
              <div class="meta">${isOn ? "Aktywny" : "Wyłączony"}</div>
            </div>
            <div class="mode-grid">
              ${this._modeButton("off", mode)}
              ${this._modeButton("continuous", mode)}
              ${this._modeButton("interval", mode)}
              ${this._modeButton("countdown", mode)}
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="label">Moc mgiełki</div>
              <div class="meta">${STRENGTH_LABELS[strength] || "Niższa"}</div>
            </div>
            <div class="strength-row">
              ${this._strengthButton("low", strength)}
              ${this._strengthButton("high", strength)}
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="label">Minutnik</div>
              <div class="meta">
                ${mode === "countdown" ? `Pozostało ${countdownLeft} min` : `Ustawione ${countdownMinutes} min`}
              </div>
            </div>
            <div class="progress-shell ${mode === "countdown" ? "visible" : ""}">
              <div class="progress-bar" style="width:${countdownProgress}%"></div>
            </div>
            <div class="stepper">
              <button class="ghost" data-minutes="${Math.max(0, countdownMinutes - 5)}">-5</button>
              <div class="value">${countdownMinutes}<span>min</span></div>
              <button class="ghost" data-minutes="${Math.min(360, countdownMinutes + 5)}">+5</button>
            </div>
            <div class="presets">
              ${this._presetButton(60, countdownMinutes)}
              ${this._presetButton(120, countdownMinutes)}
              ${this._presetButton(240, countdownMinutes)}
            </div>
          </div>

          ${this._config.show_light && lightState ? this._renderLightSection(lightEntityId, lightState) : ""}
        </div>
      </ha-card>
    `;

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
      button.addEventListener("click", () => this._setMinutes(Number(button.dataset.minutes)));
    });

    this.shadowRoot.querySelectorAll("[data-light-toggle]").forEach((button) => {
      button.addEventListener("click", () => this._toggleLight(lightEntityId, lightState));
    });

    this.shadowRoot.querySelectorAll("[data-light-brightness]").forEach((button) => {
      button.addEventListener("click", () => this._setLightBrightness(lightEntityId, Number(button.dataset.lightBrightness)));
    });

    this.shadowRoot.querySelectorAll("[data-light-more]").forEach((button) => {
      button.addEventListener("click", () => this._showMoreInfo(lightEntityId));
    });
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

  _modeButton(mode, activeMode) {
    const active = mode === activeMode;
    return `
      <button class="seg ${active ? "active" : ""}" data-mode="${mode}">
        <span>${MODE_LABELS[mode]}</span>
      </button>
    `;
  }

  _strengthButton(value, active) {
    const label = STRENGTH_LABELS[value];
    return `
      <button class="seg ${value === active ? "active" : ""}" data-strength="${value}">
        <span>${label}</span>
      </button>
    `;
  }

  _presetButton(value, active) {
    return `
      <button class="preset ${value === active ? "active" : ""}" data-minutes="${value}">
        ${value} min
      </button>
    `;
  }

  _renderLightSection(entityId, stateObj) {
    const isOn = stateObj.state === "on";
    const brightness = stateObj.attributes?.brightness
      ? Math.round((stateObj.attributes.brightness / 255) * 100)
      : 100;
    const effect = stateObj.attributes?.effect || "Manual";
    const background = this._lightPreview(stateObj);

    return `
      <div class="section light">
        <div class="section-head">
          <div class="label">Podświetlenie</div>
          <div class="meta">${isOn ? `${brightness}% · ${effect}` : "Wyłączone"}</div>
        </div>
        <div class="light-preview" style="${background}">
          <div class="light-actions">
            <button class="seg ${isOn ? "active" : ""}" data-light-toggle>
              ${isOn ? "Wyłącz światło" : "Włącz światło"}
            </button>
            <button class="ghost" data-light-more>Panel światła</button>
          </div>
        </div>
        <div class="presets light-presets">
          <button class="preset" data-light-brightness="64">25%</button>
          <button class="preset" data-light-brightness="153">60%</button>
          <button class="preset" data-light-brightness="255">100%</button>
        </div>
      </div>
    `;
  }

  _lightPreview(stateObj) {
    const rgb = stateObj.attributes?.rgb_color;
    if (Array.isArray(rgb) && rgb.length === 3) {
      return `background: linear-gradient(135deg, rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.34), rgba(255,255,255,0.06));`;
    }
    if (stateObj.state === "on") {
      return "background: linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,214,153,0.10));";
    }
    return "background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));";
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
      await this._hass.callService("tuya_diffuser_esphome", "set_countdown_minutes", {
        entity_id: this._config.entity,
        minutes,
      });
    });
  }

  async _toggleLight(entityId, lightState) {
    if (!this._hass || !entityId) return;
    const service = lightState?.state === "on" ? "turn_off" : "turn_on";
    await this._call(`light:${service}`, async () => {
      await this._hass.callService("light", service, {
        entity_id: entityId,
      });
    });
  }

  async _setLightBrightness(entityId, brightness) {
    if (!this._hass || !entityId) return;
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
        ha-card {
          overflow: hidden;
          border: none;
          background:
            radial-gradient(circle at 15% 12%, rgba(86, 163, 255, 0.24), transparent 32%),
            radial-gradient(circle at 85% 12%, rgba(0, 208, 165, 0.16), transparent 28%),
            linear-gradient(165deg, rgba(17, 27, 44, 0.98), rgba(8, 14, 24, 1));
          color: #f2f7ff;
          box-shadow: 0 22px 48px rgba(5, 10, 20, 0.28);
        }

        .card {
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        .card.busy {
          opacity: 0.9;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .hero-copy {
          min-width: 0;
        }

        .eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(210, 223, 255, 0.62);
          margin-bottom: 8px;
        }

        .title {
          font-size: 25px;
          line-height: 1.05;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .subtitle {
          font-size: 13px;
          color: rgba(224, 235, 255, 0.74);
          line-height: 1.45;
        }

        .power {
          border: 0;
          cursor: pointer;
          border-radius: 999px;
          padding: 10px 14px;
          font: inherit;
          font-weight: 700;
          color: #eef5ff;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.08);
          min-width: 102px;
          justify-content: center;
        }

        .power.on {
          background: linear-gradient(180deg, rgba(0, 198, 153, 0.9), rgba(0, 149, 115, 0.94));
        }

        .power.off {
          background: linear-gradient(180deg, rgba(91, 176, 255, 0.92), rgba(33, 119, 255, 0.92));
        }

        .power-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.9;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .stat,
        .section {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(14px);
        }

        .stat {
          padding: 12px 14px;
        }

        .stat-label,
        .label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(210, 223, 255, 0.58);
        }

        .stat-value {
          margin-top: 6px;
          font-size: 18px;
          font-weight: 700;
          color: #f7fbff;
        }

        .section {
          padding: 14px;
          display: grid;
          gap: 12px;
        }

        .section-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .meta {
          font-size: 12px;
          color: rgba(210, 223, 255, 0.72);
        }

        .mode-grid,
        .strength-row,
        .presets {
          display: grid;
          gap: 8px;
        }

        .mode-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .strength-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .presets {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .seg,
        .preset,
        .ghost {
          appearance: none;
          border: 0;
          border-radius: 12px;
          padding: 12px 10px;
          min-height: 46px;
          font: inherit;
          cursor: pointer;
          color: #f1f7ff;
          background: rgba(255, 255, 255, 0.08);
          transition: transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
        }

        .seg:hover,
        .preset:hover,
        .ghost:hover,
        .power:hover {
          transform: translateY(-1px);
        }

        .seg.active,
        .preset.active {
          background: linear-gradient(180deg, rgba(95, 178, 255, 0.94), rgba(37, 117, 255, 0.94));
          box-shadow: 0 12px 28px rgba(33, 119, 255, 0.24);
        }

        button:disabled {
          opacity: 0.6;
          cursor: default;
          transform: none;
        }

        .progress-shell {
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
          opacity: 0.45;
        }

        .progress-shell.visible {
          opacity: 1;
        }

        .progress-bar {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, rgba(0, 205, 163, 0.95), rgba(87, 160, 255, 0.95));
        }

        .stepper {
          display: grid;
          grid-template-columns: 72px 1fr 72px;
          gap: 10px;
          align-items: center;
        }

        .value {
          min-height: 50px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 6px;
          font-size: 28px;
          font-weight: 800;
        }

        .value span {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(210, 223, 255, 0.58);
        }

        .light-preview {
          border-radius: 14px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .light-actions {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 8px;
        }

        .light-presets {
          margin-top: -2px;
        }

        .missing {
          padding: 16px;
        }

        @media (max-width: 700px) {
          .stats,
          .mode-grid,
          .presets,
          .light-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .hero {
            display: grid;
          }

          .stepper {
            grid-template-columns: 60px 1fr 60px;
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
