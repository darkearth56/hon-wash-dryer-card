// wash-dryer-card — porthole-style card for a Hoover/Haier washer-dryer on the gvigroux/hon integration.
// Layouts: full | compact. Start runs the catalog selection or a configured favourite; gvigroux has no pause/stop.
const DEFAULTS = {
  layout: "full",
  name: "Wash Dryer",
  phase: "sensor.wash_dryer_program_phase",
  remaining: "sensor.wash_dryer_remaining_time",
  mode: "sensor.wash_dryer_mode",
  program_name: "sensor.wash_dryer_program_name_2",
  program_code: "sensor.wash_dryer_program_code",
  temperature: "sensor.wash_dryer_temperature",
  spin: "sensor.wash_dryer_spin_speed",
  remote: "binary_sensor.wash_dryer_remote_control",
  catalog: "input_select.wash_dryer_program_catalog",
  catalog_go: "input_button.wash_dryer_catalog_start",
  code_names: { 4: "Synthetic and Coloured", 12: "All in One 59", 17: "Low Dry" },
  favourites: [],
  compact_favourites: 3,
};

const PHASES = {
  0: "Ready", 1: "Washing", 2: "Washing", 3: "Spin", 4: "Rinse", 5: "Rinse", 6: "Rinse", 7: "Drying", 8: "Drying",
  9: "Steam", 10: "Ready", 11: "Spin", 12: "Weighing", 13: "Weighing", 14: "Washing", 15: "Washing", 16: "Washing",
  17: "Rinse", 18: "Rinse", 19: "Scheduled", 20: "Tumbling", 24: "Refresh", 25: "Washing", 26: "Heating", 27: "Washing",
};
const STAGES = { wash: [1, 2, 9, 12, 13, 14, 15, 16, 20, 24, 25, 26, 27], rinse: [4, 5, 6, 17, 18], spin: [3, 11], dry: [7, 8] };
const STAGE_LABELS = { wash: "Wash", rinse: "Rinse", spin: "Spin", dry: "Dry" };
const MODES = { 1: "Starting", 2: "Running", 3: "Paused", 7: "Ready" };
const BAD = ["unknown", "unavailable", "", undefined, null];

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (name, size = 20) => `<ha-icon icon="${esc(name)}" style="--mdc-icon-size:${size}px"></ha-icon>`;

class WashDryerCard extends HTMLElement {
  setConfig(config) {
    this._config = { ...DEFAULTS, ...config, code_names: { ...DEFAULTS.code_names, ...(config.code_names || {}) } };
    this._key = undefined;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const c = this._config;
    const ids = [c.phase, c.remaining, c.mode, c.program_name, c.program_code, c.temperature, c.spin, c.remote, c.catalog];
    const key = ids.map((id) => hass.states[id]?.state).join("|") + "|" + (hass.states[c.catalog]?.attributes.options || []).length;
    if (key === this._key) return;
    this._key = key;
    this._render();
  }

  getCardSize() {
    return this._config?.layout === "compact" ? 3 : 9;
  }

  static getStubConfig() {
    return { layout: "compact" };
  }

  _s(id) {
    return this._hass?.states[id]?.state;
  }

  _state() {
    const c = this._config;
    const phaseRaw = this._s(c.phase);
    const phase = Number(phaseRaw);
    const mode = Number(this._s(c.mode));
    const offline = BAD.includes(phaseRaw);
    const active = !offline && ((phase !== 0 && phase !== 10) || [1, 2, 3].includes(mode));
    const paused = active && mode === 3;
    const scheduled = active && phase === 19;
    const remaining = Number(this._s(c.remaining));
    const hasTime = active && Number.isFinite(remaining) && remaining > 0;
    const stage = active ? Object.keys(STAGES).find((s) => STAGES[s].includes(phase)) : undefined;
    const stages = Object.keys(STAGES);
    const code = this._s(c.program_code);
    const rawName = this._s(c.program_name);
    const programLabel = c.code_names[code] || (!BAD.includes(rawName) && rawName !== "No program" ? rawName : code && code !== "0" ? `Program code ${code}` : "");
    const phaseLabel = PHASES[phase] || (offline ? "" : `Phase ${phaseRaw}`);
    let status = offline ? "Offline" : !active ? "Ready" : paused ? "Paused" : scheduled ? "Scheduled" : MODES[mode] === "Starting" ? "Starting" : "Running";
    const subtitle = active ? [status, !paused && !scheduled ? phaseLabel : ""].filter(Boolean).join(", ") : status;
    return {
      active, paused, offline, hasTime, remaining, stage, stages, programLabel, subtitle, status,
      reached: stage ? stages.indexOf(stage) : -1,
      ends: hasTime ? new Date(Date.now() + remaining * 60000).toLocaleTimeString(this._hass.locale?.language, { hour: "2-digit", minute: "2-digit" }) : "",
      remoteOn: this._s(c.remote) === "on",
      temp: this._s(c.temperature),
      spin: this._s(c.spin),
    };
  }

  _porthole(s, small) {
    const level = s.offline ? "idle" : s.stage || (s.active ? "wash" : "idle");
    const id = `g${Math.random().toString(36).slice(2, 8)}`;
    return `<svg viewBox="0 0 200 200" class="drum ${small ? "small" : ""}" aria-hidden="true">
      <defs><clipPath id="${id}"><circle cx="100" cy="100" r="72"/></clipPath></defs>
      <circle cx="100" cy="100" r="94" class="rim"/>
      <circle cx="100" cy="100" r="80" class="seal"/>
      <circle cx="100" cy="100" r="72" class="glass"/>
      <g clip-path="url(#${id})">
        <g class="water level-${level} ${s.active && !s.paused ? "moving" : ""}">
          <path class="wave back" d="M-100 0 Q-75 -8 -50 0 T0 0 T50 0 T100 0 T150 0 T200 0 T250 0 T300 0 V200 H-100 Z"/>
          <path class="wave front" d="M-100 4 Q-75 -6 -50 4 T0 4 T50 4 T100 4 T150 4 T200 4 T250 4 T300 4 V200 H-100 Z"/>
        </g>
      </g>
      <circle cx="100" cy="100" r="72" class="shine"/>
    </svg>`;
  }

  _stagesBar(s) {
    return `<ol class="stages">${s.stages
      .map((st, i) => `<li class="${i < s.reached ? "done" : ""} ${i === s.reached ? "now" : ""}"><span class="bar"></span><span class="label">${STAGE_LABELS[st]}</span></li>`)
      .join("")}</ol>`;
  }

  _favs(s, limit) {
    const favs = (this._config.favourites || []).slice(0, limit ?? undefined);
    if (!favs.length) return "";
    return `<div class="favs">${favs
      .map((f, i) => `<button class="fav" data-fav="${i}" ${s.active || !s.remoteOn ? "disabled" : ""}>${icon(f.icon || "mdi:star-outline", 16)}<span>${esc(f.name)}</span></button>`)
      .join("")}</div>`;
  }

  _notice(s) {
    if (s.offline) return `<p class="notice">The washer isn't reporting right now. Check the hOn integration.</p>`;
    if (!s.remoteOn) return `<p class="notice">Remote control is off on the machine. Press its remote button to start programs from here.</p>`;
    if (s.paused) return `<p class="notice">Paused on the machine. Resume or stop it in the hOn app.</p>`;
    if (s.active) return `<p class="hint">Pause and stop aren't available from Home Assistant. Use the hOn app.</p>`;
    return "";
  }

  _full(s) {
    const c = this._config;
    const cat = this._hass.states[c.catalog];
    const options = cat?.attributes.options || [];
    return `<ha-card class="full ${s.active && !s.paused ? "running" : ""}">
      <header><h2>${esc(c.name)}</h2><p class="subtitle">${esc(s.subtitle)}</p></header>
      <div class="porthole">
        ${this._porthole(s)}
        <div class="readout">${
          s.hasTime ? `<span class="minutes">${s.remaining}</span><span class="unit">min left</span>` : `<span class="unit idle">${esc(s.active ? s.status : s.offline ? "Offline" : "Ready")}</span>`
        }</div>
      </div>
      ${s.hasTime ? `<p class="ends">Ends at <strong>${esc(s.ends)}</strong></p>` : ""}
      ${this._stagesBar(s)}
      ${s.active
        ? `<div class="running-info"><span class="prog">${esc(s.programLabel || "Program running")}</span><span class="meta">${[!BAD.includes(s.temp) ? `${esc(s.temp)}°C` : "", !BAD.includes(s.spin) ? `${esc(s.spin)} rpm` : ""].filter(Boolean).join(" · ")}</span></div>`
        : `${cat ? `<label class="program"><select data-catalog ${!s.remoteOn ? "disabled" : ""}>${options
            .map((o) => `<option value="${esc(o)}" ${o === cat.state ? "selected" : ""}>${esc(o)}</option>`)
            .join("")}</select>${icon("mdi:chevron-down", 18)}</label>` : ""}
           ${this._favs(s)}
           <div class="actions"><button class="primary" data-action="start" ${!s.remoteOn || !cat ? "disabled" : ""}>${icon("mdi:play", 20)}Start selected program</button></div>`}
      ${this._notice(s)}
    </ha-card>`;
  }

  _compact(s) {
    const c = this._config;
    const line = s.hasTime ? `Ends at ${s.ends}` : s.active ? [s.subtitle, s.programLabel].filter(Boolean).join(" · ") : s.status;
    return `<ha-card class="compact ${s.active && !s.paused ? "running" : ""}">
      <div class="row">
        <div class="mini">${this._porthole(s, true)}${s.hasTime ? `<span class="mini-time">${s.remaining}</span>` : ""}</div>
        <div class="titles"><h2>${esc(c.name)}</h2><p class="subtitle">${esc(line)}</p></div>
      </div>
      ${s.active ? this._stagesBar(s) : this._favs(s, c.compact_favourites)}
      ${s.offline || !s.remoteOn || s.paused ? this._notice(s) : ""}
    </ha-card>`;
  }

  _render() {
    if (!this._config || !this._hass) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const s = this._state();
    this.shadowRoot.innerHTML = STYLE + (this._config.layout === "compact" ? this._compact(s) : this._full(s));
    this.shadowRoot.querySelectorAll("[data-fav]").forEach((b) =>
      b.addEventListener("click", () => this._runFavourite(this._config.favourites[Number(b.dataset.fav)])),
    );
    this.shadowRoot.querySelector("[data-catalog]")?.addEventListener("change", (ev) =>
      this._hass.callService("input_select", "select_option", { entity_id: this._config.catalog, option: ev.target.value }),
    );
    this.shadowRoot.querySelector('[data-action="start"]')?.addEventListener("click", () => {
      const prog = this._s(this._config.catalog);
      if (!window.confirm(`Start "${prog}" now?`)) return;
      this._hass.callService("input_button", "press", { entity_id: this._config.catalog_go });
    });
  }

  _runFavourite(f) {
    if (!f) return;
    if (!window.confirm(f.confirm || `Start "${f.name}" now?`)) return;
    const [domain, service] = (f.action || "").split(".");
    if (!domain || !service) return;
    this._hass.callService(domain, service, f.data || {}, f.target);
  }
}

const STYLE = `<style>
  :host { --wd-water-top: #64b5f6; --wd-water-bottom: #1e88e5; }
  ha-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  h2 { margin: 0; font-size: 18px; font-weight: 500; color: var(--primary-text-color); }
  .subtitle { margin: 2px 0 0; font-size: 13px; color: var(--secondary-text-color); }
  .porthole { position: relative; width: 190px; height: 190px; align-self: center; }
  .drum { width: 100%; height: 100%; display: block; }
  .rim { fill: none; stroke: var(--divider-color); stroke-width: 8; }
  .seal { fill: none; stroke: var(--secondary-background-color); stroke-width: 10; }
  .glass { fill: var(--secondary-background-color); }
  .shine { fill: none; stroke: rgba(255,255,255,.25); stroke-width: 2; }
  .wave.back { fill: var(--wd-water-top); opacity: .6; }
  .wave.front { fill: var(--wd-water-bottom); opacity: .85; }
  .water { transition: transform 1.2s ease; }
  .level-idle { transform: translateY(190px); }
  .level-wash { transform: translateY(105px); }
  .level-rinse { transform: translateY(95px); }
  .level-spin { transform: translateY(150px); }
  .level-dry { transform: translateY(175px); }
  .moving .wave { animation: drift 4s linear infinite; }
  .moving .wave.back { animation-duration: 6s; }
  @keyframes drift { from { transform: translateX(0); } to { transform: translateX(100px); } }
  .readout { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
  .minutes { font-size: 38px; font-weight: 500; line-height: 1; color: var(--primary-text-color); }
  .unit { font-size: 13px; color: var(--secondary-text-color); }
  .unit.idle { font-size: 16px; color: var(--primary-text-color); }
  .ends { margin: -4px 0 0; text-align: center; font-size: 13px; color: var(--secondary-text-color); }
  .ends strong { color: var(--primary-text-color); font-weight: 500; }
  .stages { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .stages li { display: flex; flex-direction: column; gap: 4px; align-items: center; font-size: 12px; color: var(--secondary-text-color); }
  .stages .bar { width: 100%; height: 4px; border-radius: 2px; background: var(--divider-color); }
  .stages li.done .bar { background: var(--wd-water-top); }
  .stages li.now .bar { background: var(--primary-color); }
  .stages li.now .label { color: var(--primary-text-color); font-weight: 500; }
  .program { position: relative; display: flex; align-items: center; }
  .program select { width: 100%; appearance: none; font: inherit; font-size: 14px; padding: 10px 36px 10px 12px; border-radius: 8px;
    border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); }
  .program ha-icon { position: absolute; right: 10px; pointer-events: none; color: var(--secondary-text-color); }
  .favs { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
  button { font: inherit; cursor: pointer; border-radius: 8px; }
  button[disabled] { opacity: .45; cursor: default; }
  .fav { display: flex; align-items: center; gap: 6px; padding: 8px 10px; font-size: 13px; text-align: left;
    border: 1px solid var(--divider-color); background: transparent; color: var(--primary-text-color); }
  .fav span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fav ha-icon { color: var(--primary-color); flex: none; }
  .actions { display: flex; }
  .primary { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border: none;
    background: var(--primary-color); color: var(--text-primary-color, #fff); font-size: 14px; font-weight: 500; }
  .running-info { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; padding: 10px 12px; border-radius: 8px; background: var(--secondary-background-color); }
  .running-info .prog { font-weight: 500; color: var(--primary-text-color); }
  .running-info .meta { color: var(--secondary-text-color); }
  .notice, .hint { margin: 0; font-size: 12px; color: var(--secondary-text-color); }
  .notice { color: var(--warning-color, #e6a700); }
  .compact .row { display: flex; align-items: center; gap: 12px; }
  .compact .titles { flex: 1; min-width: 0; }
  .mini { position: relative; width: 56px; height: 56px; flex: none; }
  .mini-time { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 500; color: var(--primary-text-color); }
</style>`;

if (!customElements.get("wash-dryer-card")) {
  customElements.define("wash-dryer-card", WashDryerCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "wash-dryer-card", name: "Wash dryer (gvigroux hOn)", description: "Porthole-style status, progress, catalog start and favourites for the Hoover washer-dryer." });
}
