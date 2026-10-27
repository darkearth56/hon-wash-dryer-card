# hOn wash-dryer card

A porthole-style Lovelace card for Haier, Hoover and Candy washers and washer-dryers running on the [gvigroux/hon](https://github.com/gvigroux/hon) Home Assistant integration.

It is inspired by the `hon-washer-card` that ships with [galvani/hon](https://github.com/galvani/hon), which only works with the hon-revived family of integrations. This card reads the sensors gvigroux creates instead.

## What it shows

- A drum that fills with water according to the current stage, with minutes left in the middle and the finish time underneath
- A Wash, Rinse, Spin, Dry progress bar driven by the program phase sensor
- The running program, temperature and spin speed
- When idle: an optional program dropdown with a start button, and a set of favourite programs you define
- While running: Pause/Resume and Stop buttons, when [hon-control](https://github.com/darkearth56/hon-control) is installed
- Notices when remote control is off on the machine, when it is paused, or when it stops reporting

Every start and stop asks for confirmation first.

### Pause, resume and stop

gvigroux/hon has no working pause or stop service for washers. Install the companion integration [hon-control](https://github.com/darkearth56/hon-control), which adds them, and the card shows the buttons automatically. Without it the card hides them and points you to the hOn app.

The machine takes about a minute to report a change, so the button shows "Pausing…", "Resuming…" or "Stopping…" for a minute after you press it.

## Install

### HACS

1. HACS → three-dot menu → **Custom repositories**
2. Add `https://github.com/darkearth56/hon-wash-dryer-card` with type **Dashboard**
3. Install **hOn wash-dryer card** and reload the browser

### Manual

1. Copy `wash-dryer-card.js` into your `config/www` folder
2. Settings → Dashboards → three-dot menu → **Resources** → add `/local/wash-dryer-card.js` as a **JavaScript module**
3. Reload the browser

## Configuration

Minimal:

```yaml
type: custom:wash-dryer-card
```

Compact layout:

```yaml
type: custom:wash-dryer-card
layout: compact
compact_favourites: 3
```

Full example with favourites:

```yaml
type: custom:wash-dryer-card
layout: full
name: Wash Dryer
favourites:
  - name: Rapid 59
    icon: mdi:speedometer
    action: hon.start_program
    target:
      device_id: YOUR_HON_DEVICE_ID
    data:
      program: iot_wash_rapid_59
  - name: Drain & Spin
    icon: mdi:autorenew
    action: hon.start_program
    target:
      device_id: YOUR_HON_DEVICE_ID
    data:
      program: drain_spin
      parameters: {}
  - name: Dry, low heat
    icon: mdi:tumble-dryer
    action: script.turn_on
    target:
      entity_id: script.my_low_heat_dry
    confirm: Start a low-heat dry cycle?
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `layout` | `full` | `full` or `compact` |
| `name` | `Wash Dryer` | Card title |
| `device_id` | found from the `phase` sensor | hOn device that pause, resume and stop are sent to |
| `favourites` | `[]` | Buttons that call a service. Each has `name`, `action` (`domain.service`), and optional `icon`, `data`, `target`, `confirm` |
| `compact_favourites` | `3` | How many favourites the compact layout shows when idle |
| `code_names` | see below | Map of program code to a friendly name, for codes the program name sensor can't resolve |
| `catalog` | `input_select.wash_dryer_program_catalog` | Optional `input_select` listing programs. The dropdown is hidden if the entity doesn't exist |
| `placeholder` | `Select a program` | Catalog option that means nothing is chosen. The start button stays disabled while it's selected |
| `catalog_go` | `input_button.wash_dryer_catalog_start` | `input_button` pressed by the start button. Your own automation should start the selected program when it is pressed |
| `phase` | `sensor.wash_dryer_program_phase` | Program phase sensor |
| `remaining` | `sensor.wash_dryer_remaining_time` | Remaining time sensor (minutes) |
| `mode` | `sensor.wash_dryer_mode` | Machine mode sensor |
| `program_name` | `sensor.wash_dryer_program_name_2` | Program name sensor |
| `program_code` | `sensor.wash_dryer_program_code` | Program code sensor |
| `temperature` | `sensor.wash_dryer_temperature` | Temperature sensor |
| `spin` | `sensor.wash_dryer_spin_speed` | Spin speed sensor |
| `remote` | `binary_sensor.wash_dryer_remote_control` | Remote control binary sensor |

The entity defaults match a device named "Wash Dryer" in gvigroux/hon. If yours has a different name, override the entity options.

Default `code_names`: `2` Drain & Spin, `4` Synthetic and Coloured, `5` Rinse, `12` All in One 59, `17` Low Dry. Program codes can differ between models, so check yours.

### How states are read

| Mode sensor | Meaning |
| --- | --- |
| `7` | Idle |
| `1` | Program loaded; idle while the phase is Ready |
| `2` | Running |
| `3` | Paused |

Phase codes follow the gvigroux translations: 1–2, 14–16, 25 and 27 washing; 4–6 and 17–18 rinse; 3 and 11 spin; 7–8 drying; 9 steam; 12–13 weighing; 19 scheduled; 20 tumbling; 24 refresh; 26 heating; 0 and 10 ready.

## Changelog

- 1.2.0: Start stays disabled while the catalog is on its placeholder option (default `Select a program`). Program code 2 named Drain & Spin.
- 1.1.0: Pause, resume and stop buttons via hon-control. Mode 1 with a Ready phase now shows as idle, not starting. Program code 5 named Rinse.
- 1.0.0: First release.

## Licence

MIT
