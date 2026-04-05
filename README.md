# Tuya Diffuser ESPHome

Home Assistant custom integration for Tuya diffusers flashed with ESPHome and exposed through the standard helper entities:

- `select.*_mist_mode`
- `select.*_mist_strength`
- `number.*_countdown_minutes`
- `sensor.*_countdown_left`

The integration creates one aggregated `humidifier` entity per diffuser and adds two integration services for mist strength and countdown minutes.

## What it does

- appears in `Add Integration`
- auto-detects compatible ESPHome diffuser devices
- creates one backend entity instead of several loose helpers
- exposes:
  - `humidifier.turn_on`
  - `humidifier.turn_off`
  - `humidifier.set_mode`
  - `tuya_diffuser_esphome.set_mist_strength`
  - `tuya_diffuser_esphome.set_countdown_minutes`
- optionally ships a custom Lovelace card for a single compact control panel

## Installation

### HACS

1. Add this repository as a custom repository in HACS.
2. Category: `Integration`
3. Install `Tuya Diffuser ESPHome`
4. Restart Home Assistant

### Add the integration

1. Open `Settings -> Devices & Services`
2. Click `Add Integration`
3. Search for `Tuya Diffuser ESPHome`
4. Select an auto-detected diffuser or configure the source entities manually

## Optional custom card

The integration exposes the frontend resource at:

`/api/tuya_diffuser_esphome/frontend/tuya-diffuser-esphome-card.js`

Add it as a Lovelace resource, then use:

```yaml
type: custom:tuya-diffuser-esphome-card
entity: humidifier.livingroom_diffuser_mist
title: Dyfuzor
```

## Expected source entities

The default autodiscovery looks for these ESPHome helpers on the same device:

- `select.*_mist_mode`
- `select.*_mist_strength`
- `number.*_countdown_minutes`
- `sensor.*_countdown_left`

## Repository layout

- `custom_components/tuya_diffuser_esphome/` - integration
- `custom_components/tuya_diffuser_esphome/frontend/` - optional Lovelace card
- `examples/` - sample snippets
