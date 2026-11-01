// wash-dryer-card — porthole-style card for a Hoover/Haier washer-dryer on the gvigroux/hon integration.
// Layouts: full | compact. Start runs the catalog selection or a configured favourite.
// Pause, resume and stop appear when the hon_control integration (darkearth56/hon-control) is installed.
const VERSION = "1.4.0";
const DEFAULTS = {
  layout: "full",
  name: "Washer Dryer",
  device_id: "",
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
  code_names: { 2: "Drain & Spin", 4: "Synthetic and Coloured", 5: "Rinse", 12: "All in One 59", 17: "Low Dry" },
  favourites: [],
  compact_favourites: 3,
  placeholder: "Select a program",
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

// Garment shapes in a 24x24 box. T-shirts are Material Design Icons (Pictogrammers Free License); sock and towel are drawn here.
const GARMENTS = {
  crew: [["M16,21H8A1,1 0 0,1 7,20V12.07L5.7,13.07C5.31,13.46 4.68,13.46 4.29,13.07L1.46,10.29C1.07,9.9 1.07,9.27 1.46,8.88L7.34,3H9C9,4.1 10.34,5 12,5C13.66,5 15,4.1 15,3H16.66L22.54,8.88C22.93,9.27 22.93,9.9 22.54,10.29L19.71,13.12C19.32,13.5 18.69,13.5 18.3,13.12L17,12.12V20A1,1 0 0,1 16,21"]],
  vneck: [["M16,21H8A1,1 0 0,1 7,20V12.07L5.7,13.07C5.31,13.46 4.68,13.46 4.29,13.07L1.46,10.29C1.07,9.9 1.07,9.27 1.46,8.88L7.34,3H9C9.29,4.8 10.4,6.37 12,7.25C13.6,6.37 14.71,4.8 15,3H16.66L22.54,8.88C22.93,9.27 22.93,9.9 22.54,10.29L19.71,13.12C19.32,13.5 18.69,13.5 18.3,13.12L17,12.12V20A1,1 0 0,1 16,21"]],
  sock: [["M9 2h6v10l3.8 3.8a3 3 0 0 1 -4.2 4.2l-5 -5A2 2 0 0 1 9 13.6z"], ["M9 2h6v2.2H9z", "trim"]],
  towel: [["M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1H4a1 1 0 0 1 -1 -1V7a1 1 0 0 1 1 -1z"], ["M3 13h18v2H3z", "trim"]],
};
// Each garment is lifted up the drum wall by the paddles, then drops back across the drum, turning as it falls.
const TUMBLE = [
  { kind: "crew", fill: 1, begin: 0, spin: "0;110;300;360", rest: [84, 150, -25],
    path: "M100,156 A56,56 0 0,1 52.5,70.3 Q80,72 116,150 L100,156", points: "0;0.494;0.929;1" },
  { kind: "sock", fill: 2, begin: 1.1, spin: "0;120;-60;0", rest: [118, 148, 35],
    path: "M100,152 A52,52 0 0,1 51.1,82.2 Q76,80 108,146 L100,152", points: "0;0.501;0.950;1" },
  { kind: "towel", fill: 3, begin: 2.2, spin: "0;100;270;360", rest: [101, 156, 6],
    path: "M100,158 A58,58 0 0,1 56.9,61.2 Q86,66 124,152 L100,158", points: "0;0.487;0.910;1" },
  { kind: "vneck", fill: 4, begin: 3.3, spin: "0;115;-70;0", rest: [97, 139, -70],
    path: "M100,154 A54,54 0 0,1 51.5,76.3 Q78,76 112,148 L100,154", points: "0;0.496;0.939;1" },
];

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
    const key =
      ids.map((id) => hass.states[id]?.state).join("|") +
      "|" + (hass.states[c.catalog]?.attributes.options || []).length +
      "|" + Boolean(hass.services?.hon_control) + "|" + (this._pending || "");
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
    // Mode 1 with a Ready phase is a program loaded but not started, which is idle.
    const active = !offline && ((phase !== 0 && phase !== 10) || [2, 3].includes(mode));
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
      controls: Boolean(this._hass.services?.hon_control) && Boolean(this._deviceId()),
    };
  }

  _deviceId() {
    const c = this._config;
    return c.device_id || this._hass?.entities?.[c.phase]?.device_id || "";
  }

  _control(action) {
    const services = { pause: "pause_program", resume: "resume_program", stop: "stop_program" };
    if (action === "stop" && !window.confirm("Stop the current program?")) return;
    this._pending = action;
    this._render();
    this._hass
      .callService("hon_control", services[action], {}, { device_id: this._deviceId() })
      .catch((err) => window.alert(`Couldn't ${action}: ${err?.message || err}`))
      .finally(() => {
        // The machine takes about a minute to report the change; keep the button busy until then.
        setTimeout(() => {
          this._pending = undefined;
          this._key = undefined;
          if (this._hass) this.hass = this._hass;
        }, 60000);
      });
  }

  _controlButtons(s, compact) {
    if (!s.active || !s.controls) return "";
    const busy = Boolean(this._pending);
    const dis = busy || !s.remoteOn ? "disabled" : "";
    const toggle = s.paused ? "resume" : "pause";
    const label = busy ? `${this._pending === "stop" ? "Stopping" : this._pending === "pause" ? "Pausing" : "Resuming"}…` : s.paused ? "Resume" : "Pause";
    if (compact) {
      return `<button class="round" data-control="${toggle}" ${dis} aria-label="${label}" title="${label}">${icon(s.paused ? "mdi:play" : "mdi:pause", 22)}</button>`;
    }
    return `<div class="actions">
      <button class="primary" data-control="${toggle}" ${dis}>${icon(s.paused ? "mdi:play" : "mdi:pause", 20)}${label}</button>
      <button class="secondary" data-control="stop" ${dis}>${icon("mdi:stop", 20)}Stop</button>
    </div>`;
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
      ${level === "dry" ? this._dryer(s, id) : ""}
      <circle cx="100" cy="100" r="72" class="shine"/>
    </svg>`;
  }

  _dryer(s, clip) {
    const moving = s.active && !s.paused;
    const shape = (g) => GARMENTS[g.kind].map(([d, cls]) => `<path class="${cls || `cloth c${g.fill}`}" d="${d}"/>`).join("");
    const paddles = [0, 120, 240].map((a) => `<path d="M90 28.7 Q100 46 110 28.7 Z" transform="rotate(${a} 100 100)"/>`).join("");
    const items = TUMBLE.map((g) => {
      const art = `<g transform="translate(-16 -16) scale(1.35)">${shape(g)}</g>`;
      if (!moving) return `<g transform="translate(${g.rest[0]} ${g.rest[1]}) rotate(${g.rest[2]})">${art}</g>`;
      const t = `dur="4.4s" repeatCount="indefinite" begin="-${g.begin}s" keyTimes="0;0.55;0.82;1" calcMode="spline" keySplines="0 0 1 1;0.45 0 1 1;0 0 0.5 1"`;
      return `<g><animateMotion ${t} path="${g.path}" keyPoints="${g.points}"/>
        <g><animateTransform attributeName="transform" type="rotate" ${t} values="${g.spin}"/>${art}</g></g>`;
    }).join("");
    return `<g clip-path="url(#${clip})" class="dryer ${moving ? "moving" : ""}">
        <circle cx="100" cy="100" r="72" class="glow"/>
        <g class="paddles">${paddles}</g>
        ${items}
      </g>`;
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
    if (this._pending) return `<p class="hint">Sent. The machine takes about a minute to report the change.</p>`;
    if (s.controls) return s.paused ? `<p class="notice">Paused.</p>` : "";
    if (s.paused) return `<p class="notice">Paused on the machine. Resume or stop it in the hOn app.</p>`;
    if (s.active) return `<p class="hint">Install hon_control to pause and stop from here, or use the hOn app.</p>`;
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
        ? `<div class="running-info"><span class="prog">${esc(s.programLabel || "Program running")}</span><span class="meta">${[Number(s.temp) > 0 ? `${esc(s.temp)}°C` : "", Number(s.spin) > 0 ? `${esc(s.spin)} rpm` : ""].filter(Boolean).join(" · ")}</span></div>
           ${this._controlButtons(s, false)}`
        : `${cat ? `<label class="program ${cat.state === c.placeholder ? "empty" : ""}"><select data-catalog ${!s.remoteOn ? "disabled" : ""}>${options
            .map((o) => `<option value="${esc(o)}" ${o === cat.state ? "selected" : ""}>${esc(o)}</option>`)
            .join("")}</select>${icon("mdi:chevron-down", 18)}</label>` : ""}
           ${this._favs(s)}
           <div class="actions"><button class="primary" data-action="start" ${!s.remoteOn || !cat || cat.state === c.placeholder ? "disabled" : ""}>${icon("mdi:play", 20)}Start selected program</button></div>`}
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
        ${this._controlButtons(s, true)}
      </div>
      ${s.active ? this._stagesBar(s) : this._favs(s, c.compact_favourites)}
      ${s.offline || !s.remoteOn || (s.paused && !s.controls) ? this._notice(s) : ""}
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
    this.shadowRoot.querySelectorAll("[data-control]").forEach((b) =>
      b.addEventListener("click", () => this._control(b.dataset.control)),
    );
    this.shadowRoot.querySelector('[data-action="start"]')?.addEventListener("click", () => {
      const prog = this._s(this._config.catalog);
      if (!prog || prog === this._config.placeholder) return;
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
  :host { --wd-water-top: #64b5f6; --wd-water-bottom: #1e88e5; --wd-heat: #ff8a50;
    --wd-cloth-1: #64b5f6; --wd-cloth-2: #f06292; --wd-cloth-3: #ffd54f; --wd-cloth-4: #81c784; }
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
  .level-dry { transform: translateY(200px); }
  .dryer .glow { fill: var(--wd-heat); opacity: .1; }
  .dryer.moving .glow { animation: glow 2.2s ease-in-out infinite alternate; }
  .dryer .paddles { fill: var(--divider-color); transform-origin: 100px 100px; transform-box: view-box; }
  .dryer.moving .paddles { animation: turn 6.6s linear infinite; }
  .dryer .cloth { stroke: rgba(0,0,0,.12); stroke-width: .6; }
  .dryer .trim { fill: rgba(255,255,255,.55); }
  .dryer .c1 { fill: var(--wd-cloth-1); } .dryer .c2 { fill: var(--wd-cloth-2); }
  .dryer .c3 { fill: var(--wd-cloth-3); } .dryer .c4 { fill: var(--wd-cloth-4); }
  @keyframes turn { to { transform: rotate(360deg); } }
  @keyframes glow { from { opacity: .06; } to { opacity: .2; } }
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
  .program.empty select { color: var(--secondary-text-color); }
  .program ha-icon { position: absolute; right: 10px; pointer-events: none; color: var(--secondary-text-color); }
  .favs { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
  button { font: inherit; cursor: pointer; border-radius: 8px; }
  button[disabled] { opacity: .45; cursor: default; }
  .fav { display: flex; align-items: center; gap: 6px; padding: 8px 10px; font-size: 13px; text-align: left;
    border: 1px solid var(--divider-color); background: transparent; color: var(--primary-text-color); }
  .fav span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fav ha-icon { color: var(--primary-color); flex: none; }
  .actions { display: flex; gap: 8px; }
  .secondary { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; font-size: 14px; font-weight: 500;
    border: 1px solid var(--divider-color); background: transparent; color: var(--primary-text-color); }
  .round { flex: none; width: 44px; height: 44px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center;
    background: var(--primary-color); color: var(--text-primary-color, #fff); }
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
  console.info(`%c wash-dryer-card ${VERSION} `, "background:#1e88e5;color:#fff;border-radius:3px");
  customElements.define("wash-dryer-card", WashDryerCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "wash-dryer-card", name: "Washer dryer (gvigroux hOn)", description: "Porthole-style status, progress, catalog start and favourites for the Hoover washer-dryer." });
}
