# Tuya Diffuser ESPHome

Home Assistant custom integration for Tuya diffusers flashed with ESPHome and exposed through the standard helper entities:

- `select.*_mist_mode`
- `select.*_mist_strength`
- `number.*_countdown_minutes`
- `sensor.*_countdown_left`

The integration creates one aggregated `humidifier` entity per diffuser and exposes two integration services for mist strength and countdown minutes.

## What it does

- appears in `Add Integration`
- auto-detects compatible ESPHome diffuser devices
- creates one backend `humidifier` entity instead of several loose helpers
- exposes:
  - `humidifier.turn_on`
  - `humidifier.turn_off`
  - `humidifier.set_mode`
  - `tuya_diffuser_esphome.set_mist_strength`
  - `tuya_diffuser_esphome.set_countdown_minutes`
- optionally ships a custom Lovelace card for a single compact control panel
- can also surface the matching ESPHome `light` entity inside the same card

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

If the integration auto-detected a matching `light` entity on the same ESPHome device, the card will render a secondary light section automatically.
You can also wire it manually:

```yaml
type: custom:tuya-diffuser-esphome-card
entity: humidifier.livingroom_diffuser_mist
title: Dyfuzor
light_entity: light.livingroom_diffuser_livingroom_diffuser_light
```

## Native Lovelace setup

If you prefer fully visual dashboard editing, use the original ESPHome entities directly with standard HA `tile` cards:

```yaml
- type: tile
  entity: humidifier.livingroom_diffuser
  features:
    - type: toggle
  features_position: bottom

- type: tile
  entity: light.livingroom_diffuser_livingroom_diffuser_light
  features:
    - type: toggle
  features_position: bottom

- type: tile
  entity: select.livingroom_diffuser_mist_mode
  features:
    - type: select-options
  features_position: inline

- type: tile
  entity: select.livingroom_diffuser_mist_strength
  features:
    - type: select-options
  features_position: inline

- type: tile
  entity: number.livingroom_diffuser_countdown_minutes
  features:
    - type: numeric-input
      style: buttons
  features_position: inline

- type: tile
  entity: sensor.livingroom_diffuser_countdown_left
```

## Expected source entities

The default autodiscovery looks for these ESPHome helpers on the same device:

- `select.*_mist_mode`
- `select.*_mist_strength`
- `number.*_countdown_minutes`
- `sensor.*_countdown_left`

Optional:

- `light.*`

## Repository layout

- `custom_components/tuya_diffuser_esphome/` - integration
- `custom_components/tuya_diffuser_esphome/frontend/` - optional Lovelace card
- `examples/` - sample snippets
