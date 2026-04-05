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
    this._config = config;
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

  _render() {
    if (!this.shadowRoot || !this._config) {
      return;
    }

    const stateObj = this._hass?.states?.[this._config.entity];
    if (!stateObj) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div class="missing">Nie znaleziono encji: ${this._config.entity}</div>
        </ha-card>
        ${this._styles()}
      `;
      return;
    }

    const attrs = stateObj.attributes;
    const title = this._config.title || attrs.friendly_name || "Dyfuzor";
    const isOn = stateObj.state !== "off";
    const mode = isOn ? (attrs.mode || "continuous") : "off";
    const strength = attrs.mist_strength || "low";
    const countdownMinutes = Number(attrs.countdown_minutes ?? 120);
    const countdownLeft = Number(attrs.countdown_left ?? 0);

    this.shadowRoot.innerHTML = `
      ${this._styles()}
      <ha-card>
        <div class="card">
          <div class="hero">
            <div>
              <div class="eyebrow">Sterowanie lokalne</div>
              <div class="title">${title}</div>
            </div>
            <div class="status ${isOn ? "on" : "off"}">
              ${isOn ? "Aktywny" : "Wyłączony"}
            </div>
          </div>

          <div class="section">
            <div class="label">Tryb pracy</div>
            <div class="segmented">
              ${this._modeButton("off", "Off", mode)}
              ${this._modeButton("continuous", "Ciągły", mode)}
              ${this._modeButton("interval", "Interwał", mode)}
              ${this._modeButton("countdown", "Timer", mode)}
            </div>
          </div>

          <div class="section">
            <div class="label">Moc mgiełki</div>
            <div class="segmented compact">
              ${this._strengthButton("low", "Niższa", strength)}
              ${this._strengthButton("high", "Wyższa", strength)}
            </div>
          </div>

          <div class="section">
            <div class="row-head">
              <div class="label">Minutnik</div>
              <div class="meta">
                ${mode === "countdown" ? `Pozostało ${countdownLeft} min` : `Ustawione ${countdownMinutes} min`}
              </div>
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
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => this._setMode(button.dataset.mode));
    });

    this.shadowRoot.querySelectorAll("[data-strength]").forEach((button) => {
      button.addEventListener("click", () => this._setStrength(button.dataset.strength));
    });

    this.shadowRoot.querySelectorAll("[data-minutes]").forEach((button) => {
      button.addEventListener("click", () => this._setMinutes(Number(button.dataset.minutes)));
    });
  }

  _modeButton(value, label, active) {
    const className = value === active ? "seg active" : "seg";
    return `<button class="${className}" data-mode="${value}">${label}</button>`;
  }

  _strengthButton(value, label, active) {
    const className = value === active ? "seg active" : "seg";
    return `<button class="${className}" data-strength="${value}">${label}</button>`;
  }

  _presetButton(value, active) {
    const className = value === active ? "preset active" : "preset";
    return `<button class="${className}" data-minutes="${value}">${value} min</button>`;
  }

  async _setMode(mode) {
    if (!this._hass) return;
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
  }

  async _setStrength(strength) {
    if (!this._hass) return;
    await this._hass.callService("tuya_diffuser_esphome", "set_mist_strength", {
      entity_id: this._config.entity,
      strength,
    });
  }

  async _setMinutes(minutes) {
    if (!this._hass) return;
    await this._hass.callService("tuya_diffuser_esphome", "set_countdown_minutes", {
      entity_id: this._config.entity,
      minutes,
    });
  }

  _styles() {
    return `
      <style>
        ha-card {
          overflow: hidden;
          border: none;
          background:
            radial-gradient(circle at top left, rgba(55, 142, 255, 0.22), transparent 38%),
            radial-gradient(circle at bottom right, rgba(0, 190, 150, 0.18), transparent 34%),
            linear-gradient(165deg, rgba(19, 32, 54, 0.96), rgba(8, 16, 30, 0.98));
          color: #eef4ff;
        }

        .card {
          padding: 18px;
          display: grid;
          gap: 16px;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 12px;
        }

        .eyebrow {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(214, 226, 255, 0.68);
          margin-bottom: 6px;
        }

        .title {
          font-size: 24px;
          line-height: 1.1;
          font-weight: 700;
        }

        .status {
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .status.on {
          background: rgba(0, 196, 140, 0.16);
          color: #88ffd4;
        }

        .status.off {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(238, 244, 255, 0.74);
        }

        .section {
          display: grid;
          gap: 10px;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
        }

        .label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(238, 244, 255, 0.88);
        }

        .row-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
        }

        .meta {
          font-size: 12px;
          color: rgba(214, 226, 255, 0.72);
        }

        .segmented {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .segmented.compact {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .seg,
        .preset,
        .ghost {
          appearance: none;
          border: 0;
          border-radius: 12px;
          padding: 12px 10px;
          cursor: pointer;
          font: inherit;
          color: #eef4ff;
          background: rgba(255, 255, 255, 0.08);
          transition: transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
        }

        .seg:hover,
        .preset:hover,
        .ghost:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.14);
        }

        .seg.active,
        .preset.active {
          background: linear-gradient(180deg, rgba(91, 176, 255, 0.92), rgba(33, 119, 255, 0.92));
          box-shadow: 0 10px 24px rgba(33, 119, 255, 0.28);
        }

        .stepper {
          display: grid;
          grid-template-columns: 72px 1fr 72px;
          gap: 10px;
          align-items: center;
        }

        .value {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 6px;
          min-height: 48px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
          font-size: 28px;
          font-weight: 700;
        }

        .value span {
          font-size: 13px;
          font-weight: 600;
          color: rgba(214, 226, 255, 0.72);
        }

        .presets {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .missing {
          padding: 16px;
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
  description: "Single-panel control card for the Tuya Diffuser ESPHome humidifier.",
});
