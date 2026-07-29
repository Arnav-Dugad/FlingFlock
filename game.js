(() => {
  "use strict";

  const W = 1600;
  const H = 900;
  const GROUND_Y = 772;
  const FIXED_DT = 1 / 120;
  const GRAVITY = 1120;
  const SLING = { x: 270, y: 617 };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const rotate = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
  const length = (v) => Math.hypot(v.x, v.y);
  const normalize = (v) => {
    const l = length(v) || 1;
    return { x: v.x / l, y: v.y / l };
  };
  const formatScore = (n) => Math.round(n).toLocaleString("en-US");

  class RNG {
    constructor(seed) {
      this.seed = seed >>> 0 || 1;
    }
    next() {
      let x = this.seed;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.seed = x >>> 0;
      return this.seed / 4294967296;
    }
    range(min, max) {
      return min + (max - min) * this.next();
    }
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    }
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }
    shuffle(arr) {
      return arr
        .map((value) => ({ value, sort: this.next() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
    }
  }

  class Soundscape {
    constructor() {
      this.ctx = null;
      this.muted = localStorage.getItem("flingflock-muted") === "true";
      this.master = null;
    }
    ensure() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    }
    tone(freq, duration, type = "sine", volume = 0.25, slide = 0) {
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration);
    }
    noise(duration = 0.12, volume = 0.16) {
      const ctx = this.ensure();
      if (!ctx) return;
      const size = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      source.buffer = buffer;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start();
    }
    launch() {
      this.tone(180, 0.24, "triangle", 0.34, 480);
    }
    hit(force) {
      if (force < 20) return;
      this.noise(0.07, clamp(force / 500, 0.03, 0.18));
      this.tone(90 + Math.min(force, 300), 0.08, "sine", 0.12, -35);
    }
    break(material) {
      const f = material === "glass" ? 950 : material === "stone" ? 110 : 240;
      this.noise(material === "stone" ? 0.22 : 0.12, 0.2);
      this.tone(f, 0.16, material === "glass" ? "sine" : "square", 0.16, material === "glass" ? 300 : -50);
    }
    pop() {
      this.tone(440, 0.12, "triangle", 0.24, 280);
      setTimeout(() => this.tone(720, 0.1, "sine", 0.18, 180), 55);
    }
    ability() {
      this.tone(260, 0.25, "sawtooth", 0.16, 720);
    }
    win() {
      [0, 140, 280, 440].forEach((d, i) => setTimeout(() => this.tone([392, 523, 659, 784][i], 0.3, "triangle", 0.18), d));
    }
    toggle() {
      this.muted = !this.muted;
      localStorage.setItem("flingflock-muted", this.muted);
      document.body.classList.toggle("muted", this.muted);
      if (!this.muted) {
        this.ensure();
        this.tone(520, 0.1, "sine", 0.12, 120);
      }
      return this.muted;
    }
  }

  const audio = new Soundscape();
  document.body.classList.toggle("muted", audio.muted);

  const BIOMES = [
    { name: "SUNMEADOW RIDGE", skyA: "#3bbecb", skyB: "#b9ebd8", hillFar: "#328c83", hill: "#176a66", ground: "#285843", grass: "#72b95d", accent: "#ffd15c" },
    { name: "EMBERWIND CANYON", skyA: "#ed895e", skyB: "#f9d58f", hillFar: "#b85d52", hill: "#6d4853", ground: "#4b3d44", grass: "#d18455", accent: "#ffdd7b" },
    { name: "MOONMIST MARSH", skyA: "#315b79", skyB: "#78a89d", hillFar: "#416a69", hill: "#254b55", ground: "#263f48", grass: "#64a98b", accent: "#b8f2dc" },
    { name: "FROSTPETAL PEAK", skyA: "#78b9d3", skyB: "#e4eee6", hillFar: "#799dac", hill: "#4d7886", ground: "#425f67", grass: "#b7ded2", accent: "#fff2bd" },
    { name: "GOLDEN THISTLE", skyA: "#55b6bd", skyB: "#f4d38a", hillFar: "#728a5c", hill: "#486a52", ground: "#3e5948", grass: "#9fb94c", accent: "#f6c653" },
  ];

  const BIRD_DATA = {
    dash: { name: "Pip", ability: "Burst dash", color: "#f0644f", belly: "#ffd0a1", r: 27 },
    split: { name: "Trio", ability: "Triple split", color: "#49b7ca", belly: "#d2f5ed", r: 26 },
    bomb: { name: "Bo", ability: "Shockwave", color: "#263d49", belly: "#83949b", r: 30 },
    loop: { name: "Rue", ability: "Loopback", color: "#91bd50", belly: "#e6eb9a", r: 27 },
  };

  const MATERIALS = {
    wood: { color: "#bd713e", edge: "#77462e", hp: 72, density: 0.0011, restitution: 0.16, friction: 0.52, score: 420 },
    glass: { color: "#7ad9db", edge: "#d1ffff", hp: 39, density: 0.0007, restitution: 0.24, friction: 0.28, score: 520 },
    stone: { color: "#81939a", edge: "#52646b", hp: 125, density: 0.0018, restitution: 0.08, friction: 0.65, score: 650 },
  };

  const canvas = $("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const state = {
    view: "landing",
    level: Math.max(1, Number(localStorage.getItem("flingflock-level")) || 1),
    unlocked: Math.max(1, Number(localStorage.getItem("flingflock-unlocked")) || 1),
    score: 0,
    impactScore: 0,
    targetCount: 0,
    targetsLeft: 0,
    bodies: [],
    particles: [],
    texts: [],
    effects: [],
    birdTypes: [],
    birdIndex: 0,
    waitingBird: null,
    activeBird: null,
    dragging: false,
    dragPoint: { ...SLING },
    paused: false,
    ended: false,
    accumulator: 0,
    lastTime: 0,
    settleTimer: 0,
    finishTimer: 0,
    failureTimer: 0,
    quakeTime: 0,
    shake: 0,
    timeScale: 1,
    slowMoTimer: 0,
    displayScore: 0,
    combo: 0,
    comboTimer: 0,
    trailTimer: 0,
    elapsed: 0,
    supportCheckTimer: 0,
    calloutCooldown: 0,
    wind: 0,
    initialHealth: 1,
    damageDone: 0,
    scope: false,
    boost: false,
    powers: { scope: 3, quake: 2, boost: 2 },
    biome: BIOMES[0],
    seed: 0,
    scenery: [],
    id: 0,
    launchedOnce: false,
  };

  function makeBody(options) {
    const body = {
      id: ++state.id,
      type: options.type || "rect",
      category: options.category || "block",
      material: options.material || null,
      x: options.x,
      y: options.y,
      w: options.w || 0,
      h: options.h || 0,
      r: options.r || 0,
      angle: options.angle || 0,
      vx: options.vx || 0,
      vy: options.vy || 0,
      av: options.av || 0,
      static: Boolean(options.static),
      sleeping: Boolean(options.sleeping),
      restTime: 0,
      removed: false,
      abilityUsed: Boolean(options.abilityUsed),
      birdType: options.birdType || null,
      sleep: 0,
      grounded: 0,
      hitCooldown: 0,
      clone: Boolean(options.clone),
      renderScale: 1,
      flash: 0,
    };
    const material = MATERIALS[body.material];
    const area = body.type === "circle" ? Math.PI * body.r * body.r : body.w * body.h;
    body.mass = options.mass || (material ? Math.max(1.2, area * material.density) : Math.max(2, area * 0.0012));
    body.invMass = body.static ? 0 : 1 / body.mass;
    body.inertia = body.type === "circle" ? 0.5 * body.mass * body.r * body.r : (body.mass * (body.w * body.w + body.h * body.h)) / 12;
    body.invInertia = body.static ? 0 : 1 / body.inertia;
    body.restitution = options.restitution ?? material?.restitution ?? 0.28;
    body.friction = options.friction ?? material?.friction ?? 0.35;
    body.hp = options.hp ?? material?.hp ?? (body.category === "target" ? 74 : Infinity);
    body.maxHp = body.hp;
    state.bodies.push(body);
    return body;
  }

  function rectAxes(body) {
    const c = Math.cos(body.angle);
    const s = Math.sin(body.angle);
    return [{ x: c, y: s }, { x: -s, y: c }];
  }

  function rectCorners(body) {
    const axes = rectAxes(body);
    const hx = body.w / 2;
    const hy = body.h / 2;
    return [
      { x: body.x + axes[0].x * hx + axes[1].x * hy, y: body.y + axes[0].y * hx + axes[1].y * hy },
      { x: body.x - axes[0].x * hx + axes[1].x * hy, y: body.y - axes[0].y * hx + axes[1].y * hy },
      { x: body.x - axes[0].x * hx - axes[1].x * hy, y: body.y - axes[0].y * hx - axes[1].y * hy },
      { x: body.x + axes[0].x * hx - axes[1].x * hy, y: body.y + axes[0].y * hx - axes[1].y * hy },
    ];
  }

  function project(points, axis) {
    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
      const d = dot(p, axis);
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    return { min, max };
  }

  function clipPolygon(poly, axis, center, limit) {
    if (!poly.length) return poly;
    const result = [];
    const signedDistance = (point) => dot({ x: point.x - center.x, y: point.y - center.y }, axis) - limit;
    let previous = poly[poly.length - 1];
    let previousDistance = signedDistance(previous);
    for (const current of poly) {
      const currentDistance = signedDistance(current);
      const previousInside = previousDistance <= 0.001;
      const currentInside = currentDistance <= 0.001;
      if (previousInside !== currentInside) {
        const t = previousDistance / (previousDistance - currentDistance);
        result.push({
          x: lerp(previous.x, current.x, t),
          y: lerp(previous.y, current.y, t),
        });
      }
      if (currentInside) result.push(current);
      previous = current;
      previousDistance = currentDistance;
    }
    return result;
  }

  function intersectionCentroid(a, b, fallback) {
    const axes = rectAxes(b);
    const center = { x: b.x, y: b.y };
    let polygon = rectCorners(a);
    polygon = clipPolygon(polygon, axes[0], center, b.w / 2);
    polygon = clipPolygon(polygon, { x: -axes[0].x, y: -axes[0].y }, center, b.w / 2);
    polygon = clipPolygon(polygon, axes[1], center, b.h / 2);
    polygon = clipPolygon(polygon, { x: -axes[1].x, y: -axes[1].y }, center, b.h / 2);
    if (!polygon.length) return fallback;
    return polygon.reduce((sum, point) => ({ x: sum.x + point.x / polygon.length, y: sum.y + point.y / polygon.length }), { x: 0, y: 0 });
  }

  function circleCircle(a, b) {
    const delta = { x: b.x - a.x, y: b.y - a.y };
    const dist = length(delta);
    const overlap = a.r + b.r - dist;
    if (overlap <= 0) return null;
    const normal = dist > 0.001 ? { x: delta.x / dist, y: delta.y / dist } : { x: 1, y: 0 };
    return {
      normal,
      penetration: overlap,
      contact: { x: a.x + normal.x * (a.r - overlap * 0.5), y: a.y + normal.y * (a.r - overlap * 0.5) },
    };
  }

  function rectRect(a, b) {
    const ca = rectCorners(a);
    const cb = rectCorners(b);
    const axes = [...rectAxes(a), ...rectAxes(b)];
    let smallest = Infinity;
    let normal = null;
    for (const axis of axes) {
      const pa = project(ca, axis);
      const pb = project(cb, axis);
      const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
      if (overlap <= 0) return null;
      if (overlap < smallest) {
        smallest = overlap;
        normal = { ...axis };
      }
    }
    const centerDelta = { x: b.x - a.x, y: b.y - a.y };
    if (dot(centerDelta, normal) < 0) normal = { x: -normal.x, y: -normal.y };
    const fallback = {
      x: (a.x + b.x) * 0.5,
      y: (a.y + b.y) * 0.5,
    };
    return {
      normal,
      penetration: smallest,
      contact: intersectionCentroid(a, b, fallback),
    };
  }

  function circleRect(circle, rect) {
    const c = Math.cos(-rect.angle);
    const s = Math.sin(-rect.angle);
    const dx = circle.x - rect.x;
    const dy = circle.y - rect.y;
    const local = { x: dx * c - dy * s, y: dx * s + dy * c };
    const closest = {
      x: clamp(local.x, -rect.w / 2, rect.w / 2),
      y: clamp(local.y, -rect.h / 2, rect.h / 2),
    };
    let toRect = { x: closest.x - local.x, y: closest.y - local.y };
    let dist = length(toRect);
    let penetration;
    if (dist < 0.0001) {
      const edgeX = rect.w / 2 - Math.abs(local.x);
      const edgeY = rect.h / 2 - Math.abs(local.y);
      if (edgeX < edgeY) toRect = { x: local.x >= 0 ? 1 : -1, y: 0 };
      else toRect = { x: 0, y: local.y >= 0 ? 1 : -1 };
      penetration = circle.r + Math.min(edgeX, edgeY);
      dist = 1;
    } else {
      penetration = circle.r - dist;
      if (penetration <= 0) return null;
    }
    const localNormal = { x: toRect.x / dist, y: toRect.y / dist };
    const normal = rotate(localNormal, rect.angle);
    const contactLocal = closest;
    const contactWorld = rotate(contactLocal, rect.angle);
    return {
      normal,
      penetration,
      contact: { x: rect.x + contactWorld.x, y: rect.y + contactWorld.y },
    };
  }

  function detectCollision(a, b) {
    if (a.type === "circle" && b.type === "circle") return circleCircle(a, b);
    if (a.type === "rect" && b.type === "rect") return rectRect(a, b);
    if (a.type === "circle") return circleRect(a, b);
    const hit = circleRect(b, a);
    if (hit) hit.normal = { x: -hit.normal.x, y: -hit.normal.y };
    return hit;
  }

  function velocityAt(body, r) {
    return { x: body.vx - body.av * r.y, y: body.vy + body.av * r.x };
  }

  function wakeBody(body) {
    if (!body || body.static || body.removed) return;
    body.sleeping = false;
    body.restTime = 0;
  }

  function bodySpeed(body) {
    return Math.hypot(body.vx, body.vy) + Math.abs(body.av) * Math.max(body.r, body.w, body.h) * 0.25;
  }

  function bodyBounds(body) {
    if (body.type === "circle") {
      return { left: body.x - body.r, right: body.x + body.r, top: body.y - body.r, bottom: body.y + body.r };
    }
    const axes = rectAxes(body);
    const extentX = Math.abs(axes[0].x) * body.w / 2 + Math.abs(axes[1].x) * body.h / 2;
    const extentY = Math.abs(axes[0].y) * body.w / 2 + Math.abs(axes[1].y) * body.h / 2;
    return { left: body.x - extentX, right: body.x + extentX, top: body.y - extentY, bottom: body.y + extentY };
  }

  function wakeUnsupportedBodies() {
    const candidates = state.bodies.filter((body) => !body.removed && !body.static);
    for (let propagation = 0; propagation < 4; propagation++) {
      let changed = false;
      for (const body of candidates) {
        if (!body.sleeping) continue;
        const bounds = bodyBounds(body);
        if (Math.abs(bounds.bottom - GROUND_Y) <= 7) continue;

        const supports = [];
        for (const support of state.bodies) {
          if (support === body || support.removed || support.category === "bird" || support.category === "target") continue;
          const supportBounds = bodyBounds(support);
          const gap = supportBounds.top - bounds.bottom;
          if (gap < -5 || gap > 7) continue;
          const left = Math.max(bounds.left, supportBounds.left);
          const right = Math.min(bounds.right, supportBounds.right);
          if (right - left < 3) continue;
          supports.push({ left, right, stable: support.static || support.sleeping });
        }

        if (!supports.length) {
          wakeBody(body);
          changed = true;
          continue;
        }

        const stableSupports = supports.filter((support) => support.stable);
        if (!stableSupports.length) {
          wakeBody(body);
          changed = true;
          continue;
        }

        const supportLeft = Math.min(...stableSupports.map((support) => support.left));
        const supportRight = Math.max(...stableSupports.map((support) => support.right));
        const stabilityMargin = body.type === "circle" ? 1 : Math.min(8, body.w * 0.08);
        if (body.x < supportLeft - stabilityMargin || body.x > supportRight + stabilityMargin) {
          wakeBody(body);
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  function damageBody(body, amount, at) {
    if (!Number.isFinite(body.hp) || amount <= 0 || body.removed) return;
    wakeBody(body);
    const resistance = body.category === "target" ? 0.82 : 1;
    const applied = Math.min(body.hp, amount * resistance);
    body.hp -= amount * resistance;
    state.damageDone += Math.max(0, applied);
    body.flash = Math.min(1, body.flash + amount / 35);
    if (body.hitCooldown <= 0 && amount > 5) {
      spawnSparks(at.x, at.y, body.material || (body.category === "target" ? "target" : "wood"), Math.min(5, Math.ceil(amount / 15)));
      body.hitCooldown = 0.08;
    }
    if (body.hp <= 0) destroyBody(body);
    updateDamageMeter();
  }

  function resolveCollision(a, b, hit, allowDamage = true) {
    const invMass = a.invMass + b.invMass;
    if (invMass === 0) return;
    const correction = Math.max(hit.penetration - 0.35, 0) * 0.76 / invMass;
    if (!a.static) {
      a.x -= hit.normal.x * correction * a.invMass;
      a.y -= hit.normal.y * correction * a.invMass;
    }
    if (!b.static) {
      b.x += hit.normal.x * correction * b.invMass;
      b.y += hit.normal.y * correction * b.invMass;
    }

    const ra = { x: hit.contact.x - a.x, y: hit.contact.y - a.y };
    const rb = { x: hit.contact.x - b.x, y: hit.contact.y - b.y };
    const va = velocityAt(a, ra);
    const vb = velocityAt(b, rb);
    const rv = { x: vb.x - va.x, y: vb.y - va.y };
    const normalSpeed = dot(rv, hit.normal);
    if (normalSpeed > 0) return;

    const raCrossN = cross(ra, hit.normal);
    const rbCrossN = cross(rb, hit.normal);
    const denom = invMass + raCrossN * raCrossN * a.invInertia + rbCrossN * rbCrossN * b.invInertia;
    const restitution = normalSpeed < -145 ? Math.min(a.restitution, b.restitution) : 0;
    let j = (-(1 + restitution) * normalSpeed) / Math.max(denom, 0.0001);
    j = Math.min(j, 2800);
    const impulse = { x: hit.normal.x * j, y: hit.normal.y * j };

    if (!a.static) {
      a.vx -= impulse.x * a.invMass;
      a.vy -= impulse.y * a.invMass;
      a.av -= cross(ra, impulse) * a.invInertia;
    }
    if (!b.static) {
      b.vx += impulse.x * b.invMass;
      b.vy += impulse.y * b.invMass;
      b.av += cross(rb, impulse) * b.invInertia;
    }

    const tangentRaw = { x: rv.x - normalSpeed * hit.normal.x, y: rv.y - normalSpeed * hit.normal.y };
    const tangentLen = length(tangentRaw);
    if (tangentLen > 0.001) {
      const tangent = { x: tangentRaw.x / tangentLen, y: tangentRaw.y / tangentLen };
      const raCrossT = cross(ra, tangent);
      const rbCrossT = cross(rb, tangent);
      const tDenom = invMass + raCrossT * raCrossT * a.invInertia + rbCrossT * rbCrossT * b.invInertia;
      let jt = -dot(rv, tangent) / Math.max(tDenom, 0.0001);
      const mu = Math.sqrt(a.friction * b.friction);
      jt = clamp(jt, -j * mu, j * mu);
      const frictionImpulse = { x: tangent.x * jt, y: tangent.y * jt };
      if (!a.static) {
        a.vx -= frictionImpulse.x * a.invMass;
        a.vy -= frictionImpulse.y * a.invMass;
        a.av -= cross(ra, frictionImpulse) * a.invInertia;
      }
      if (!b.static) {
        b.vx += frictionImpulse.x * b.invMass;
        b.vy += frictionImpulse.y * b.invMass;
        b.av += cross(rb, frictionImpulse) * b.invInertia;
      }
    }

    const impact = Math.abs(normalSpeed);
    if (allowDamage && impact > 74) {
      const damage = (impact - 55) * 0.11 + Math.sqrt(Math.abs(j)) * 0.38;
      damageBody(a, damage * (b.category === "bird" ? 1.55 : 1), hit.contact);
      damageBody(b, damage * (a.category === "bird" ? 1.55 : 1), hit.contact);
      if ((a.category === "bird" || b.category === "bird") && impact > 120) {
        state.impactScore += Math.round(impact * 0.65);
        addScore(Math.round(impact * 0.65), hit.contact);
      }
      if (impact > 145 && (a.hitCooldown <= 0 || b.hitCooldown <= 0)) audio.hit(impact);
      state.shake = Math.max(state.shake, Math.min(8, impact / 55));
      if (impact > 260) {
        state.effects.push({ type: "ring", x: hit.contact.x, y: hit.contact.y, r: 8, endR: Math.min(110, impact * 0.24), life: 0.28, maxLife: 0.28, color: "#fff3b0", width: 5 });
      }
      if ((a.category === "bird" || b.category === "bird") && impact > 245 && state.calloutCooldown <= 0) {
        showCinematic("KINETIC IMPACT", impact > 520 ? "DEVASTATING HIT" : impact > 360 ? "CRUSHING STRIKE" : "DIRECT HIT");
        state.calloutCooldown = 1.1;
      }
    }
  }

  function destroyBody(body) {
    if (body.removed) return;
    if ((body.category === "block" || body.category === "target") && Number.isFinite(body.hp) && body.hp > 0) {
      state.damageDone += body.hp;
      body.hp = 0;
      updateDamageMeter();
    }
    body.removed = true;
    if (body.category === "block") {
      const info = MATERIALS[body.material];
      const awarded = awardDestruction(info.score, { x: body.x, y: body.y });
      state.impactScore += awarded;
      burstBody(body, info.color);
      audio.break(body.material);
    } else if (body.category === "target") {
      state.targetsLeft = Math.max(0, state.targetsLeft - 1);
      const awarded = awardDestruction(5000, { x: body.x, y: body.y - 25 });
      state.impactScore += awarded;
      burstTarget(body);
      state.effects.push({ type: "ring", x: body.x, y: body.y, r: 10, endR: 125, life: 0.55, maxLife: 0.55, color: "#d9ff9d", width: 8 });
      state.slowMoTimer = 0.18;
      state.timeScale = Math.min(state.timeScale, 0.38);
      flashImpact(body.x, body.y);
      audio.pop();
      updateHUD();
    } else if (body.category === "bird" && state.activeBird === body) {
      state.activeBird = null;
    }
  }

  function awardDestruction(base, at) {
    state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
    state.comboTimer = 1.7;
    const multiplier = 1 + Math.min(state.combo - 1, 6) * 0.16;
    const amount = Math.round(base * multiplier);
    addScore(amount, at);
    if (state.combo >= 2) showCombo();
    return amount;
  }

  function showCombo() {
    const el = $("#comboCallout");
    $("#comboCount").textContent = state.combo;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  function showCinematic(kicker, title) {
    const el = $("#cinematicCallout");
    $("#calloutKicker").textContent = kicker;
    $("#calloutTitle").textContent = title;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  function updateDamageMeter() {
    const percent = clamp(Math.round((state.damageDone / Math.max(1, state.initialHealth)) * 100), 0, 100);
    $("#ridgeMeterFill").style.width = `${percent}%`;
    $("#ridgeMeterLabel").textContent = `${percent}%`;
  }

  function flashImpact(x, y) {
    const el = $("#impactFlash");
    el.style.setProperty("--flash-x", `${(x / W) * 100}%`);
    el.style.setProperty("--flash-y", `${(y / H) * 100}%`);
    el.classList.remove("fire");
    void el.offsetWidth;
    el.classList.add("fire");
  }

  function addScore(amount, at) {
    state.score += amount;
    if (at) state.texts.push({ x: at.x, y: at.y, text: `+${formatScore(amount)}`, life: 1, maxLife: 1 });
    updateHUD();
    const score = $("#scoreLabel");
    score.classList.remove("score-pop");
    void score.offsetWidth;
    score.classList.add("score-pop");
  }

  function spawnSparks(x, y, material, count = 4) {
    const color = material === "glass" ? "#b8ffff" : material === "stone" ? "#d5d7d3" : material === "target" ? "#c8f58c" : "#f1aa62";
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 260,
        vy: -40 - Math.random() * 220,
        size: 2 + Math.random() * 5,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        color,
        gravity: 600,
        shape: "chip",
      });
    }
  }

  function burstBody(body, color) {
    const count = body.material === "glass" ? 16 : 11;
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x: body.x + (Math.random() - 0.5) * body.w * 0.65,
        y: body.y + (Math.random() - 0.5) * body.h * 0.65,
        vx: body.vx * 0.35 + (Math.random() - 0.5) * 420,
        vy: body.vy * 0.25 - Math.random() * 350,
        size: 4 + Math.random() * 10,
        life: 0.7 + Math.random() * 0.7,
        maxLife: 1.4,
        color,
        gravity: 800,
        angle: Math.random() * Math.PI,
        av: (Math.random() - 0.5) * 9,
        shape: "chip",
      });
    }
  }

  function burstTarget(body) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 90 + Math.random() * 270;
      state.particles.push({
        x: body.x,
        y: body.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 90,
        size: 3 + Math.random() * 7,
        life: 0.7 + Math.random() * 0.5,
        maxLife: 1.2,
        color: i % 3 === 0 ? "#fff2b4" : "#8ece5f",
        gravity: 500,
        shape: i % 3 === 0 ? "star" : "round",
      });
    }
  }

  function explode(x, y, radius, power, visual = true) {
    for (const body of state.bodies) {
      if (body.removed || body.static) continue;
      const delta = { x: body.x - x, y: body.y - y };
      const d = Math.max(16, length(delta));
      if (d > radius + Math.max(body.r, body.w / 2)) continue;
      const falloff = 1 - clamp(d / radius, 0, 1);
      const n = normalize(delta);
      wakeBody(body);
      body.vx += n.x * power * falloff * body.invMass * 3.5;
      body.vy += n.y * power * falloff * body.invMass * 3.5 - falloff * 100;
      body.av += (Math.random() - 0.5) * 5 * falloff;
      damageBody(body, 80 * falloff, { x: body.x, y: body.y });
    }
    state.shake = Math.max(state.shake, 16);
    if (visual) {
      state.effects.push({ type: "ring", x, y, r: 12, endR: radius * 1.12, life: 0.65, maxLife: 0.65, color: "#fff09a", width: 12 });
      state.effects.push({ type: "ring", x, y, r: 4, endR: radius * 0.72, life: 0.4, maxLife: 0.4, color: "#ff7956", width: 18 });
      state.slowMoTimer = 0.16;
      state.timeScale = Math.min(state.timeScale, 0.42);
      flashImpact(x, y);
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 100 + Math.random() * 500;
        state.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          size: 5 + Math.random() * 13,
          life: 0.5 + Math.random() * 0.5, maxLife: 1,
          color: i % 3 === 0 ? "#fff3ac" : i % 2 ? "#ff895c" : "#263d49",
          gravity: 120, shape: "round",
        });
      }
      audio.noise(0.38, 0.3);
      audio.tone(70, 0.5, "sine", 0.28, -30);
    }
  }

  function generateLevel(level) {
    state.id = 0;
    state.seed = 48371 + level * 7919;
    const rng = new RNG(state.seed);
    state.biome = BIOMES[(level - 1) % BIOMES.length];
    state.bodies = [];
    state.particles = [];
    state.texts = [];
    state.effects = [];
    state.score = 0;
    state.displayScore = 0;
    state.impactScore = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.timeScale = 1;
    state.slowMoTimer = 0;
    state.elapsed = 0;
    state.trailTimer = 0;
    state.supportCheckTimer = 0;
    state.calloutCooldown = 0;
    state.wind = rng.range(-24, 24);
    if (Math.abs(state.wind) < 5) state.wind = 0;
    state.initialHealth = 1;
    state.damageDone = 0;
    state.targetsLeft = 0;
    state.birdIndex = 0;
    state.activeBird = null;
    state.waitingBird = null;
    state.dragging = false;
    state.dragPoint = { ...SLING };
    state.ended = false;
    state.paused = false;
    state.finishTimer = 0;
    state.failureTimer = 0;
    state.settleTimer = 0;
    state.quakeTime = 0;
    state.shake = 0;
    state.scope = false;
    state.boost = false;
    state.launchedOnce = false;
    state.powers = {
      scope: 3 + Math.floor((level - 1) / 12),
      quake: 2,
      boost: 2 + Math.floor((level - 1) / 16),
    };

    makeBody({ type: "rect", category: "ground", x: W / 2, y: GROUND_Y + 80, w: W + 300, h: 160, static: true, restitution: 0.08, friction: 0.82 });
    makeBody({ type: "rect", category: "ground", x: -30, y: H / 2, w: 60, h: H * 2, static: true, restitution: 0.1 });
    makeBody({ type: "rect", category: "ground", x: W + 30, y: H / 2, w: 60, h: H * 2, static: true, restitution: 0.1 });

    const structureCount = Math.min(3, 2 + Math.floor((level - 1) / 5));
    const startX = structureCount === 2 ? 1030 : 900;
    const gap = structureCount === 2 ? 300 : 245;
    let desiredTargets = Math.min(5, 2 + Math.floor((level - 1) / 3));
    const materialPool = level < 3 ? ["wood", "glass"] : level < 7 ? ["wood", "glass", "stone"] : ["wood", "glass", "stone", "stone"];

    for (let s = 0; s < structureCount; s++) {
      const baseX = startX + s * gap + rng.range(-18, 18);
      const floors = clamp(rng.int(2, 3 + Math.floor(level / 9)), 2, 4);
      let floorBottom = GROUND_Y;
      for (let f = 0; f < floors; f++) {
        const width = rng.pick([128, 144, 158]);
        const postH = rng.pick([76, 86, 96]);
        const postW = rng.pick([22, 26, 30]);
        const mat = rng.pick(materialPool);
        const secondMat = rng.next() > 0.65 ? rng.pick(materialPool) : mat;
        makeBody({ x: baseX - width / 2 + postW / 2, y: floorBottom - postH / 2, w: postW, h: postH, material: mat });
        makeBody({ x: baseX + width / 2 - postW / 2, y: floorBottom - postH / 2, w: postW, h: postH, material: secondMat });

        const beamY = floorBottom - postH - 12;
        makeBody({ x: baseX, y: beamY, w: width + 18, h: 24, material: rng.pick(materialPool) });

        if (desiredTargets > 0 && (f === 0 || rng.next() > 0.58)) {
          const targetR = rng.range(25, 30);
          makeBody({ type: "circle", category: "target", x: baseX + rng.range(-11, 11), y: floorBottom - targetR - 2, r: targetR, mass: 3.8, restitution: 0.35, friction: 0.5, hp: 72 + level * 1.2 });
          state.targetsLeft++;
          desiredTargets--;
        }
        floorBottom = beamY - 12;
      }
      if (desiredTargets > 0) {
        const topY = floorBottom - 29;
        makeBody({ type: "circle", category: "target", x: baseX, y: topY, r: 27, mass: 3.8, restitution: 0.35, friction: 0.5, hp: 74 + level });
        state.targetsLeft++;
        desiredTargets--;
      }

      if (level > 4 && rng.next() > 0.48) {
        const plankX = baseX + (rng.next() > 0.5 ? 1 : -1) * 98;
        makeBody({ x: plankX, y: GROUND_Y - 66, w: 21, h: 132, material: rng.pick(materialPool), angle: rng.range(-0.03, 0.03) });
      }
    }

    while (desiredTargets > 0) {
      const x = 950 + rng.range(0, 550);
      makeBody({ type: "circle", category: "target", x, y: GROUND_Y - 31, r: 28, mass: 3.8, restitution: 0.35, friction: 0.5, hp: 75 + level });
      state.targetsLeft++;
      desiredTargets--;
    }

    state.targetCount = state.targetsLeft;
    // Structures begin in a solved, sleeping state. They wake locally from impacts,
    // explosions, or ground pulses instead of accumulating fake startup forces.
    for (const body of state.bodies) {
      if (body.category === "block" || body.category === "target") {
        body.sleeping = true;
        body.vx = 0;
        body.vy = 0;
        body.av = 0;
      }
    }
    state.initialHealth = state.bodies.reduce((total, body) => total + (Number.isFinite(body.maxHp) ? body.maxHp : 0), 0);
    const baseBirds = ["dash", "split", "bomb", "loop"];
    const extra = level > 8 ? [rng.pick(baseBirds)] : [];
    state.birdTypes = rng.shuffle([...baseBirds, ...extra]);
    state.scenery = Array.from({ length: 17 }, (_, i) => ({
      x: rng.range(-80, W + 80),
      y: rng.range(430, 690),
      scale: rng.range(0.5, 1.6),
      kind: rng.int(0, 2),
      layer: i % 2,
    })).sort((a, b) => a.layer - b.layer);

    loadNextBird();
    updateHUD();
    $("#biomeLabel").textContent = state.biome.name;
    $("#levelLabel").textContent = String(level).padStart(2, "0");
    const windStrength = Math.abs(state.wind);
    $("#windLabel").textContent = windStrength < 1 ? "CALM" : `${state.wind > 0 ? "→" : "←"} ${windStrength < 12 ? "LIGHT" : windStrength < 20 ? "BRISK" : "STRONG"}`;
    const best = Number(localStorage.getItem(`flingflock-best-${level}`)) || 0;
    $("#bestLabel").textContent = best ? formatScore(best) : "—";
    $("#resultModal").classList.add("hidden");
    $("#pauseModal").classList.add("hidden");
    $("#hint").classList.remove("gone");
    updatePowerButtons();
    updateDamageMeter();
  }

  function loadNextBird() {
    if (state.birdIndex >= state.birdTypes.length) {
      state.waitingBird = null;
      updateBirdQueue();
      return;
    }
    state.waitingBird = {
      birdType: state.birdTypes[state.birdIndex],
      x: SLING.x,
      y: SLING.y,
      r: BIRD_DATA[state.birdTypes[state.birdIndex]].r,
    };
    state.dragPoint = { ...SLING };
    updateBirdQueue();
  }

  function launchBird() {
    if (!state.waitingBird || state.ended) return;
    const pull = { x: SLING.x - state.dragPoint.x, y: SLING.y - state.dragPoint.y };
    if (length(pull) < 18) {
      state.dragPoint = { ...SLING };
      return;
    }
    const boosted = state.boost;
    let multiplier = boosted ? 8.7 : 7.15;
    const type = state.waitingBird.birdType;
    const data = BIRD_DATA[type];
    const body = makeBody({
      type: "circle",
      category: "bird",
      birdType: type,
      x: state.dragPoint.x,
      y: state.dragPoint.y,
      r: data.r,
      vx: pull.x * multiplier,
      vy: pull.y * multiplier,
      mass: type === "bomb" ? 8.5 : 5.4,
      restitution: type === "bomb" ? 0.18 : 0.36,
      friction: 0.4,
      hp: Infinity,
    });
    state.activeBird = body;
    body.renderScale = 0.82;
    state.effects.push({ type: "ring", x: state.dragPoint.x, y: state.dragPoint.y, r: 6, endR: 56, life: 0.32, maxLife: 0.32, color: "#d8ffe9", width: 4 });
    for (let i = 0; i < 10; i++) {
      state.particles.push({
        x: state.dragPoint.x,
        y: state.dragPoint.y,
        vx: -pull.x * 0.2 + (Math.random() - 0.5) * 110,
        vy: -pull.y * 0.2 + (Math.random() - 0.5) * 110,
        size: 2 + Math.random() * 4,
        life: 0.28 + Math.random() * 0.24,
        maxLife: 0.52,
        color: "#e8ffe8",
        gravity: 80,
        shape: "round",
      });
    }
    state.waitingBird = null;
    state.birdIndex++;
    state.dragging = false;
    state.boost = false;
    state.launchedOnce = true;
    state.settleTimer = 0;
    $("#gameCanvas").classList.remove("dragging");
    $("#hint").classList.add("gone");
    $("#abilityHint").classList.remove("hidden");
    $("#abilityText").textContent = data.ability;
    updateBirdQueue();
    updatePowerButtons();
    if (length(pull) > 165) showCinematic(boosted ? "TAILWIND CHARGED" : "FULL DRAW", boosted ? "SUPER LAUNCH" : "MAXIMUM POWER");
    audio.launch();
  }

  function activateAbility() {
    const bird = state.activeBird;
    if (!bird || bird.removed || bird.abilityUsed || state.paused || state.ended) return;
    bird.abilityUsed = true;
    audio.ability();
    const speed = Math.max(length({ x: bird.vx, y: bird.vy }), 220);
    const direction = normalize({ x: bird.vx || 1, y: bird.vy });

    if (bird.birdType === "dash") {
      bird.vx = direction.x * speed * 1.72;
      bird.vy = direction.y * speed * 1.72;
      for (let i = 0; i < 16; i++) {
        state.particles.push({ x: bird.x - direction.x * i * 7, y: bird.y - direction.y * i * 7, vx: -direction.x * 60, vy: -direction.y * 60, size: 7 - i * 0.25, life: 0.25, maxLife: 0.25, color: "#ffe6a3", gravity: 0, shape: "round" });
      }
    } else if (bird.birdType === "split") {
      [-0.19, 0.19].forEach((angle) => {
        const v = rotate({ x: bird.vx, y: bird.vy }, angle);
        makeBody({
          type: "circle", category: "bird", birdType: "split", clone: true, abilityUsed: true,
          x: bird.x, y: bird.y + Math.sign(angle) * 7, r: 20,
          vx: v.x * 1.05, vy: v.y * 1.05, mass: 3.2, restitution: 0.34, friction: 0.35, hp: Infinity,
        });
      });
      bird.r = 22;
      bird.mass = 3.2;
      bird.invMass = 1 / bird.mass;
    } else if (bird.birdType === "bomb") {
      explode(bird.x, bird.y, 175, 1350);
      destroyBody(bird);
    } else if (bird.birdType === "loop") {
      bird.vx = -direction.x * speed * 1.42;
      bird.vy = -Math.abs(direction.y * speed) - 155;
      bird.av -= 7;
    }
    $("#abilityHint").classList.add("hidden");
  }

  function physicsStep(dt) {
    if (state.paused || state.ended) return;
    state.elapsed += dt;
    state.quakeTime = Math.max(0, state.quakeTime - dt);
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    state.calloutCooldown = Math.max(0, state.calloutCooldown - dt);
    state.supportCheckTimer -= dt;
    if (state.supportCheckTimer <= 0) {
      wakeUnsupportedBodies();
      state.supportCheckTimer = 0.045;
    }
    if (state.comboTimer === 0) state.combo = 0;
    state.trailTimer -= dt;
    for (const body of state.bodies) {
      if (body.removed || body.static) continue;
      body.hitCooldown -= dt;
      body.flash = Math.max(0, body.flash - dt * 4.8);
      body.renderScale = lerp(body.renderScale, 1, 0.2);
      if (body.sleeping) continue;
      body.vy += GRAVITY * dt;
      if (body.category === "bird") body.vx += state.wind * dt;
      body.vx *= Math.pow(0.995, dt * 60);
      body.vy *= Math.pow(0.998, dt * 60);
      body.av *= Math.pow(0.988, dt * 60);
      if (state.quakeTime > 0 && body.category !== "bird") {
        body.vx += Math.sin(performance.now() * 0.04 + body.id) * 1400 * dt;
      }
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle += body.av * dt;
      if (Math.abs(body.av) < 0.008) body.av = 0;
      if (Math.abs(body.vx) < 0.08) body.vx = 0;
      if (Math.abs(body.vy) < 0.08) body.vy = 0;

      if ((body.category === "block" || body.category === "target") && bodySpeed(body) < 6) {
        body.restTime += dt;
        if (body.restTime > 0.65) {
          body.sleeping = true;
          body.vx = 0;
          body.vy = 0;
          body.av = 0;
        }
      } else {
        body.restTime = 0;
      }

      if (body.y > H + 170 || body.x < -180 || body.x > W + 180) {
        if (body.category === "target") destroyBody(body);
        else body.removed = true;
        if (state.activeBird === body) state.activeBird = null;
      }
    }

    if (state.trailTimer <= 0) {
      const flyers = state.bodies.filter((body) => body.category === "bird" && !body.removed && !body.sleeping && bodySpeed(body) > 180);
      for (const bird of flyers) {
        const speed = bodySpeed(bird);
        state.particles.push({
          x: bird.x - bird.vx * 0.012,
          y: bird.y - bird.vy * 0.012,
          vx: -bird.vx * 0.035,
          vy: -bird.vy * 0.035,
          size: clamp(speed / 150, 3, 8),
          life: 0.22,
          maxLife: 0.22,
          color: BIRD_DATA[bird.birdType].belly,
          gravity: 0,
          shape: "round",
        });
      }
      state.trailTimer = 0.035;
    }

    const bodies = state.bodies.filter((b) => !b.removed);
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.removed) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (b.removed) continue;
          if (a.static && b.static) continue;
          if (a.sleeping && b.sleeping) continue;
          if (a.category === "bird" && b.category === "bird") continue;
          const maxA = a.type === "circle" ? a.r : Math.hypot(a.w, a.h) / 2;
          const maxB = b.type === "circle" ? b.r : Math.hypot(b.w, b.h) / 2;
          if (Math.abs(a.x - b.x) > maxA + maxB + 5 || Math.abs(a.y - b.y) > maxA + maxB + 5) continue;
          const hit = detectCollision(a, b);
          if (hit) {
            if (a.sleeping || b.sleeping) {
              const mover = a.sleeping ? b : a;
              const shouldWake = state.quakeTime > 0 || mover.category === "bird" || (!mover.static && bodySpeed(mover) > 32);
              if (!shouldWake) continue;
              if (a.sleeping) wakeBody(a);
              if (b.sleeping) wakeBody(b);
            }
            resolveCollision(a, b, hit, pass === 0);
          }
        }
      }
    }

    state.bodies = state.bodies.filter((b) => !b.removed);
    updateParticles(dt);
    updateEffects(dt);
    checkRoundState(dt);
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.life -= dt;
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle = (p.angle || 0) + (p.av || 0) * dt;
      p.vx *= Math.pow(0.98, dt * 60);
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const t of state.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
    }
    state.texts = state.texts.filter((t) => t.life > 0);
  }

  function updateEffects(dt) {
    for (const effect of state.effects) {
      effect.life -= dt;
      if (effect.type === "ring") {
        const progress = 1 - effect.life / effect.maxLife;
        effect.currentR = lerp(effect.r, effect.endR, 1 - Math.pow(1 - progress, 3));
      }
    }
    state.effects = state.effects.filter((effect) => effect.life > 0);
  }

  function checkRoundState(dt) {
    if (state.targetsLeft === 0) {
      state.finishTimer += dt;
      if (state.finishTimer > 1.15) endLevel(true);
      return;
    }
    if (state.activeBird) {
      const speed = length({ x: state.activeBird.vx, y: state.activeBird.vy });
      if ((speed < 24 && state.activeBird.y > 590) || state.activeBird.removed) state.settleTimer += dt;
      else state.settleTimer = 0;
      if (state.settleTimer > 1.4) {
        state.activeBird.removed = true;
        state.activeBird = null;
        $("#abilityHint").classList.add("hidden");
        setTimeout(() => {
          if (state.view === "game" && !state.ended && !state.waitingBird && !state.activeBird) loadNextBird();
        }, 340);
        state.settleTimer = 0;
      }
    } else if (!state.waitingBird && state.birdIndex < state.birdTypes.length) {
      loadNextBird();
    } else if (!state.waitingBird && state.birdIndex >= state.birdTypes.length) {
      const movingBirds = state.bodies.some((b) => b.category === "bird" && !b.removed && length({ x: b.vx, y: b.vy }) > 25);
      if (!movingBirds) state.failureTimer += dt;
      if (state.failureTimer > 1.8) endLevel(false);
    }
  }

  function starRating(score = state.score) {
    const potential = state.targetCount * 5000 + 3600;
    if (score >= potential * 0.87) return 3;
    if (score >= potential * 0.62) return 2;
    return score > 0 ? 1 : 0;
  }

  function endLevel(won) {
    if (state.ended) return;
    state.ended = true;
    state.paused = true;
    $("#abilityHint").classList.add("hidden");
    const birdsRemaining = won ? Math.max(0, state.birdTypes.length - state.birdIndex) : 0;
    const bonus = birdsRemaining * 3500;
    if (won) state.score += bonus;
    const stars = won ? starRating() : 0;

    $("#resultKicker").textContent = won ? `${state.biome.name} CLEARED` : "EXPEDITION ENDED";
    $("#resultTitle").textContent = won ? (stars === 3 ? "A flawless flight!" : stars === 2 ? "Ridge secured!" : "Muddles cleared!") : "The ridge held firm";
    $("#resultBadge").textContent = won ? "✦" : "↻";
    $("#impactScore").textContent = formatScore(state.impactScore);
    $("#flockBonus").textContent = formatScore(bonus);
    $("#totalScore").textContent = formatScore(state.score);
    $("#nextBtn").classList.toggle("hidden", !won);
    $$(".result-stars span").forEach((el, i) => {
      el.classList.toggle("earned", i < stars);
      el.style.animationDelay = `${i * 0.12}s`;
    });

    if (won) {
      const existingBest = Number(localStorage.getItem(`flingflock-best-${state.level}`)) || 0;
      if (state.score > existingBest) localStorage.setItem(`flingflock-best-${state.level}`, String(Math.round(state.score)));
      state.unlocked = Math.max(state.unlocked, state.level + 1);
      localStorage.setItem("flingflock-unlocked", String(state.unlocked));
      localStorage.setItem("flingflock-level", String(state.level + 1));
      audio.win();
    }
    updateHomeProgress();
    setTimeout(() => $("#resultModal").classList.remove("hidden"), 280);
  }

  function usePower(name) {
    if (state.paused || state.ended || state.powers[name] <= 0) return;
    if (name === "scope") {
      state.scope = !state.scope;
      if (state.scope) {
        state.powers.scope--;
        toast("Long sight engaged");
        audio.tone(680, 0.16, "sine", 0.12, 220);
      }
    } else if (name === "boost") {
      if (!state.waitingBird) return toast("Tailwind needs a loaded flyer");
      state.boost = !state.boost;
      if (state.boost) {
        state.powers.boost--;
        toast("Tailwind primed");
        audio.tone(260, 0.18, "triangle", 0.12, 380);
      }
    } else if (name === "quake") {
      state.powers.quake--;
      state.quakeTime = 0.9;
      state.shake = 15;
      for (const body of state.bodies) {
        if (body.category === "block" || body.category === "target") {
          body.vy -= 30 + Math.random() * 55;
          body.av += (Math.random() - 0.5) * 0.8;
          damageBody(body, body.category === "block" ? 7 : 2, { x: body.x, y: body.y });
        }
      }
      toast("Ground pulse released");
      audio.noise(0.45, 0.26);
      audio.tone(55, 0.6, "sine", 0.22, -20);
    }
    updatePowerButtons();
  }

  function updateHUD() {
    $("#targetsLeft").textContent = `${state.targetsLeft} ${state.targetsLeft === 1 ? "Muddle" : "Muddles"}`;
    const stars = starRating();
    [$("#star1"), $("#star2"), $("#star3")].forEach((el, i) => el.classList.toggle("earned", i < stars));
  }

  function updateBirdQueue() {
    const queue = $("#birdQueue");
    queue.innerHTML = "";
    state.birdTypes.forEach((type, i) => {
      const el = document.createElement("span");
      el.className = `queue-bird${i === state.birdIndex ? " active" : ""}${i < state.birdIndex ? " used" : ""}`;
      el.title = `${BIRD_DATA[type].name}: ${BIRD_DATA[type].ability}`;
      el.innerHTML = `<span class="bird-portrait ${type}"></span>`;
      queue.appendChild(el);
    });
  }

  function updatePowerButtons() {
    $("#scopeCount").textContent = state.powers.scope;
    $("#quakeCount").textContent = state.powers.quake;
    $("#boostCount").textContent = state.powers.boost;
    $$(".power-button").forEach((button) => {
      const name = button.dataset.power;
      button.disabled = state.powers[name] <= 0 && !state[name];
      button.classList.toggle("active", Boolean(state[name]));
    });
  }

  function updateHomeProgress() {
    $("#homeLevel").textContent = state.unlocked;
    $("#homeProgress").textContent = state.unlocked > 1 ? `${state.unlocked - 1} ridges cleared` : "New journey";
  }

  let toastTimer;
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function roundedRectPath(context, x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    context.beginPath();
    context.roundRect(x, y, w, h, radius);
  }

  function drawBackground() {
    const b = state.biome;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, b.skyA);
    gradient.addColorStop(0.7, b.skyB);
    gradient.addColorStop(1, b.hillFar);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const sunX = 1140 + Math.sin(state.level) * 120;
    const sunY = 150;
    const glow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 210);
    glow.addColorStop(0, "rgba(255,249,205,.9)");
    glow.addColorStop(0.17, "rgba(255,239,170,.28)");
    glow.addColorStop(1, "rgba(255,239,170,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 220, sunY - 220, 440, 440);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,248,207,.74)";
    ctx.fill();

    drawCloud(170, 145, 1.15, "rgba(255,255,235,.42)");
    drawCloud(670, 220, 0.76, "rgba(255,255,235,.28)");
    drawCloud(1370, 105, 0.86, "rgba(255,255,235,.32)");

    ctx.fillStyle = b.hillFar;
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    ctx.moveTo(0, 590);
    for (let x = 0; x <= W + 80; x += 80) {
      ctx.quadraticCurveTo(x + 40, 500 + Math.sin(x * 0.011 + state.level) * 60, x + 80, 570 + Math.sin(x * 0.006) * 35);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (const item of state.scenery) drawScenery(item);

    ctx.fillStyle = b.hill;
    ctx.beginPath();
    ctx.moveTo(0, 720);
    ctx.bezierCurveTo(190, 620, 380, 700, 560, 642);
    ctx.bezierCurveTo(780, 570, 910, 704, 1130, 636);
    ctx.bezierCurveTo(1340, 570, 1475, 655, W, 620);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    ctx.fillStyle = b.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    const grassGradient = ctx.createLinearGradient(0, GROUND_Y - 9, 0, GROUND_Y + 27);
    grassGradient.addColorStop(0, b.grass);
    grassGradient.addColorStop(1, b.ground);
    ctx.fillStyle = grassGradient;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 12);
    for (let x = 0; x <= W + 25; x += 24) {
      const y = GROUND_Y + Math.sin(x * 0.08 + state.level) * 4;
      ctx.lineTo(x, y);
      ctx.lineTo(x + 8, y - 8 - (x % 3) * 2);
      ctx.lineTo(x + 15, y + 1);
    }
    ctx.lineTo(W, GROUND_Y + 31);
    ctx.lineTo(0, GROUND_Y + 31);
    ctx.fill();

    ctx.globalAlpha = 0.13;
    ctx.fillStyle = "#fff9da";
    for (let i = 0; i < 120; i++) {
      const x = (i * 137 + state.seed) % W;
      const y = (i * 79 + state.seed) % H;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.fillStyle = "rgba(255,255,226,.4)";
    for (let i = 0; i < 20; i++) {
      const speed = (8 + (i % 4) * 5) * (state.wind < 0 ? -1 : 1);
      const travel = i * 149 + state.elapsed * speed * 10 + state.seed;
      const x = ((travel % (W + 80)) + W + 80) % (W + 80) - 40;
      const y = 120 + ((i * 83 + state.seed) % 510) + Math.sin(state.elapsed * 1.4 + i) * 8;
      ctx.globalAlpha = 0.12 + (i % 5) * 0.045;
      ctx.beginPath();
      ctx.ellipse(x, y, 2.8 + (i % 3), 1.2, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCloud(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-42, 10, 29, Math.PI, Math.PI * 2);
    ctx.arc(-10, 0, 43, Math.PI, Math.PI * 2);
    ctx.arc(35, 8, 30, Math.PI, Math.PI * 2);
    ctx.lineTo(67, 28);
    ctx.lineTo(-72, 28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawScenery(item) {
    const b = state.biome;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.scale(item.scale, item.scale);
    ctx.globalAlpha = item.layer ? 0.42 : 0.24;
    if (item.kind === 0) {
      ctx.fillStyle = b.hill;
      ctx.beginPath();
      ctx.moveTo(-28, 35);
      ctx.quadraticCurveTo(-8, -42, 0, -58);
      ctx.quadraticCurveTo(13, -30, 28, 35);
      ctx.fill();
      ctx.fillStyle = b.grass;
      ctx.beginPath();
      ctx.arc(-8, -41, 14, 0, Math.PI * 2);
      ctx.arc(9, -36, 17, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 1) {
      ctx.fillStyle = b.hill;
      ctx.fillRect(-8, -62, 16, 72);
      ctx.fillStyle = b.grass;
      ctx.beginPath();
      ctx.arc(0, -70, 29, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = b.accent;
      ctx.beginPath();
      ctx.moveTo(0, -42);
      ctx.lineTo(5, -4);
      ctx.lineTo(-5, -4);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -45, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSlingshot(back = false) {
    const left = { x: SLING.x - 29, y: SLING.y - 12 };
    const right = { x: SLING.x + 29, y: SLING.y - 12 };
    if (back && state.waitingBird) {
      ctx.strokeStyle = "#4e2a25";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(right.x, right.y);
      ctx.lineTo(state.dragPoint.x, state.dragPoint.y);
      ctx.stroke();
      return;
    }
    if (!back) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "#4b2f28";
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(SLING.x - 4, GROUND_Y + 1);
      ctx.quadraticCurveTo(SLING.x - 12, SLING.y + 90, left.x, left.y);
      ctx.moveTo(SLING.x + 7, GROUND_Y + 1);
      ctx.quadraticCurveTo(SLING.x + 16, SLING.y + 80, right.x, right.y);
      ctx.stroke();
      ctx.strokeStyle = "#9b5d3d";
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.fillStyle = "#d68a53";
      ctx.beginPath();
      ctx.arc(left.x - 1, left.y, 11, 0, Math.PI * 2);
      ctx.arc(right.x + 1, right.y, 11, 0, Math.PI * 2);
      ctx.fill();
      if (state.waitingBird) {
        ctx.strokeStyle = "#654038";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(state.dragPoint.x, state.dragPoint.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawTrajectory() {
    if (!state.dragging || !state.waitingBird) return;
    const pull = { x: SLING.x - state.dragPoint.x, y: SLING.y - state.dragPoint.y };
    const multiplier = state.boost ? 8.7 : 7.15;
    const vx = pull.x * multiplier;
    const vy = pull.y * multiplier;
    const count = state.scope ? 32 : 14;
    ctx.save();
    for (let i = 1; i <= count; i++) {
      const t = i * 0.075;
      const x = state.dragPoint.x + vx * t + 0.5 * state.wind * t * t;
      const y = state.dragPoint.y + vy * t + 0.5 * GRAVITY * t * t;
      if (x > W || y > GROUND_Y) break;
      const alpha = 0.72 * (1 - i / (count + 4));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i < 5 ? "#fff7d0" : "#d9f7e6";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.2, 5 - i * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBlock(body) {
    const info = MATERIALS[body.material];
    const health = clamp(body.hp / body.maxHp, 0, 1);
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    ctx.scale(body.renderScale || 1, body.renderScale || 1);
    if (body.material === "glass") {
      ctx.globalAlpha = 0.78;
      const g = ctx.createLinearGradient(-body.w / 2, -body.h / 2, body.w / 2, body.h / 2);
      g.addColorStop(0, "#e1ffff");
      g.addColorStop(0.45, info.color);
      g.addColorStop(1, "#3aa8b8");
      roundedRectPath(ctx, -body.w / 2, -body.h / 2, body.w, body.h, 3);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = info.edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.52)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-body.w * 0.35, -body.h * 0.34);
      ctx.lineTo(body.w * 0.3, body.h * 0.25);
      ctx.moveTo(-body.w * 0.25, body.h * 0.34);
      ctx.lineTo(body.w * 0.12, -body.h * 0.22);
      if (health < 0.66) {
        ctx.moveTo(0, 0);
        ctx.lineTo(body.w * 0.42, -body.h * 0.1);
        ctx.moveTo(0, 0);
        ctx.lineTo(-body.w * 0.28, body.h * 0.45);
      }
      ctx.stroke();
    } else if (body.material === "wood") {
      const g = ctx.createLinearGradient(0, -body.h / 2, 0, body.h / 2);
      g.addColorStop(0, "#d79053");
      g.addColorStop(1, info.color);
      roundedRectPath(ctx, -body.w / 2, -body.h / 2, body.w, body.h, 4);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = info.edge;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(100,53,31,.38)";
      ctx.lineWidth = 1.6;
      if (body.w > body.h) {
        for (let y = -body.h * 0.2; y <= body.h * 0.25; y += 8) {
          ctx.beginPath();
          ctx.moveTo(-body.w * 0.42, y);
          ctx.quadraticCurveTo(0, y + Math.sin(y) * 3, body.w * 0.42, y - 1);
          ctx.stroke();
        }
      } else {
        for (let x = -body.w * 0.2; x <= body.w * 0.25; x += 8) {
          ctx.beginPath();
          ctx.moveTo(x, -body.h * 0.42);
          ctx.quadraticCurveTo(x + Math.sin(x) * 3, 0, x - 1, body.h * 0.42);
          ctx.stroke();
        }
      }
      if (health < 0.55) drawCracks(body.w, body.h, "#5d3829");
    } else {
      const g = ctx.createLinearGradient(-body.w / 2, -body.h / 2, body.w / 2, body.h / 2);
      g.addColorStop(0, "#aab8b9");
      g.addColorStop(1, info.color);
      roundedRectPath(ctx, -body.w / 2, -body.h / 2, body.w, body.h, 5);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = info.edge;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(63,82,87,.22)";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(((i * 31) % Math.max(12, body.w - 10)) - body.w / 2 + 5, ((i * 19) % Math.max(12, body.h - 10)) - body.h / 2 + 5, 2 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
      if (health < 0.72) drawCracks(body.w, body.h, "#4f6065");
    }
    if (body.flash > 0) {
      ctx.globalAlpha = body.flash * 0.45;
      ctx.fillStyle = "#fffbdc";
      roundedRectPath(ctx, -body.w / 2, -body.h / 2, body.w, body.h, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawCracks(w, h, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.18, -h * 0.16);
    ctx.lineTo(w * 0.28, -h * 0.35);
    ctx.moveTo(w * 0.18, -h * 0.16);
    ctx.lineTo(w * 0.4, -h * 0.04);
    ctx.moveTo(0, 0);
    ctx.lineTo(-w * 0.18, h * 0.26);
    ctx.stroke();
  }

  function drawTarget(body) {
    const r = body.r;
    const health = clamp(body.hp / body.maxHp, 0, 1);
    const idle = body.sleeping ? Math.sin(state.elapsed * 2.2 + body.id * 0.7) * 0.018 : 0;
    const blinkPhase = (state.elapsed * 0.72 + body.id * 1.71) % 5.3;
    const eyeScale = blinkPhase > 5.06 ? 0.12 : 1;
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    ctx.scale((body.renderScale || 1) * (1 + idle), (body.renderScale || 1) * (1 - idle));
    ctx.fillStyle = "rgba(0,40,35,.18)";
    ctx.beginPath();
    ctx.ellipse(2, r * 0.82, r * 0.74, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6fa948";
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.42);
    ctx.quadraticCurveTo(-r * 1.08, -r * 1.03, -r * 0.3, -r * 0.76);
    ctx.quadraticCurveTo(0, -r * 1.22, r * 0.3, -r * 0.76);
    ctx.quadraticCurveTo(r * 1.08, -r * 1.03, r * 0.7, -r * 0.4);
    ctx.closePath();
    ctx.fill();
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 2, 0, 0, r);
    g.addColorStop(0, "#b8eb75");
    g.addColorStop(1, health < 0.5 ? "#668e42" : "#75ae4e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#426c3a";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#f7f1d4";
    ctx.beginPath();
    ctx.ellipse(-r * 0.33, -r * 0.18, r * 0.22, r * 0.22 * eyeScale, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.33, -r * 0.18, r * 0.22, r * 0.22 * eyeScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#173a35";
    ctx.beginPath();
    const eyeShift = health < 0.5 ? 3 : 1;
    ctx.ellipse(-r * 0.28 + eyeShift, -r * 0.16, r * 0.08, r * 0.08 * eyeScale, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.28 + eyeShift, -r * 0.16, r * 0.08, r * 0.08 * eyeScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#355c35";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (health > 0.45) {
      ctx.arc(0, r * 0.24, r * 0.22, 0.12, Math.PI - 0.12);
    } else {
      ctx.moveTo(-r * 0.22, r * 0.35);
      ctx.quadraticCurveTo(0, r * 0.08, r * 0.22, r * 0.35);
    }
    ctx.stroke();
    if (body.flash > 0) {
      ctx.globalAlpha = body.flash * 0.5;
      ctx.fillStyle = "#fffbdc";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBird(bodyLike) {
    const type = bodyLike.birdType;
    const data = BIRD_DATA[type];
    const r = bodyLike.r || data.r;
    const angle = bodyLike.angle ?? (bodyLike.vx ? Math.atan2(bodyLike.vy, bodyLike.vx) * 0.22 : 0);
    const speed = Math.hypot(bodyLike.vx || 0, bodyLike.vy || 0);
    const stretch = clamp(speed / 2800, 0, 0.13);
    const baseScale = bodyLike.renderScale || 1;
    ctx.save();
    ctx.translate(bodyLike.x, bodyLike.y);
    ctx.rotate(angle);
    ctx.scale(baseScale * (1 + stretch), baseScale * (1 - stretch * 0.55));
    ctx.fillStyle = "rgba(0,37,42,.18)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.8, r * 0.75, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = data.color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.18);
    ctx.lineTo(-r * 1.45, -r * 0.62);
    ctx.lineTo(-r * 1.12, 0);
    ctx.lineTo(-r * 1.48, r * 0.34);
    ctx.lineTo(-r * 0.74, r * 0.3);
    ctx.closePath();
    ctx.fill();
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
    g.addColorStop(0, lighten(data.color, 34));
    g.addColorStop(1, data.color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = data.belly;
    ctx.beginPath();
    ctx.ellipse(r * 0.14, r * 0.36, r * 0.54, r * 0.38, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffdf1";
    ctx.beginPath();
    ctx.arc(r * 0.27, -r * 0.25, r * 0.24, 0, Math.PI * 2);
    ctx.arc(r * 0.65, -r * 0.18, r * 0.21, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#102f39";
    ctx.beginPath();
    ctx.arc(r * 0.36, -r * 0.23, r * 0.08, 0, Math.PI * 2);
    ctx.arc(r * 0.71, -r * 0.17, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6c653";
    ctx.beginPath();
    ctx.moveTo(r * 0.75, r * 0.01);
    ctx.lineTo(r * 1.35, r * 0.18);
    ctx.lineTo(r * 0.75, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#713c2c";
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(r * 0.09, -r * 0.48);
    ctx.lineTo(r * 0.42, -r * 0.38);
    ctx.moveTo(r * 0.54, -r * 0.37);
    ctx.lineTo(r * 0.81, -r * 0.29);
    ctx.stroke();
    if (type === "bomb") {
      ctx.strokeStyle = "#f6c653";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, -r * 0.73);
      ctx.quadraticCurveTo(-r * 0.48, -r * 1.15, -r * 0.12, -r * 1.2);
      ctx.stroke();
      ctx.fillStyle = "#ff8e55";
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 1.2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = data.color;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.77);
      ctx.lineTo(-r * 0.42, -r * 1.32);
      ctx.lineTo(-r * 0.02, -r * 0.88);
      ctx.lineTo(r * 0.08, -r * 1.35);
      ctx.lineTo(r * 0.24, -r * 0.83);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function lighten(hex, amount) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = clamp((num >> 16) + amount, 0, 255);
    const g = clamp(((num >> 8) & 0xff) + amount, 0, 255);
    const b = clamp((num & 0xff) + amount, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function drawEffects() {
    for (const effect of state.effects) {
      if (effect.type !== "ring") continue;
      const alpha = clamp(effect.life / effect.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(1, effect.width * alpha);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.currentR || effect.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, (effect.currentR || effect.r) * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / Math.min(p.maxLife, 0.35), 0, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      ctx.fillStyle = p.color;
      if (p.shape === "star") {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const radius = i % 2 ? p.size * 0.42 : p.size;
          ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === "round") {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      }
      ctx.restore();
    }
    for (const t of state.texts) {
      ctx.save();
      ctx.globalAlpha = clamp(t.life / 0.35, 0, 1);
      ctx.fillStyle = "#fff4bd";
      ctx.strokeStyle = "rgba(7,31,45,.5)";
      ctx.lineWidth = 4;
      ctx.font = "800 17px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  function render() {
    state.displayScore = Math.abs(state.score - state.displayScore) < 1
      ? state.score
      : lerp(state.displayScore, state.score, 0.14);
    $("#scoreLabel").textContent = formatScore(state.displayScore);
    const shakeX = state.shake > 0.1 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0.1 ? (Math.random() - 0.5) * state.shake * 0.65 : 0;
    state.shake *= 0.9;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground();
    drawSlingshot(true);
    drawTrajectory();
    for (const body of state.bodies) {
      if (body.removed || body.category === "ground") continue;
      if (body.category === "block") drawBlock(body);
      else if (body.category === "target") drawTarget(body);
      else if (body.category === "bird") drawBird(body);
    }
    drawSlingshot(false);
    if (state.waitingBird) drawBird({ ...state.waitingBird, x: state.dragPoint.x, y: state.dragPoint.y, angle: state.dragging ? -0.15 : 0 });
    drawEffects();
    drawParticles();

    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.8);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,26,34,.17)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function gameLoop(time) {
    if (!state.lastTime) state.lastTime = time;
    const frame = Math.min((time - state.lastTime) / 1000, 0.04);
    state.lastTime = time;
    if (state.view === "game") {
      if (state.slowMoTimer > 0) {
        state.slowMoTimer = Math.max(0, state.slowMoTimer - frame);
      } else {
        state.timeScale = lerp(state.timeScale, 1, 0.14);
      }
      state.accumulator += frame * state.timeScale;
      let steps = 0;
      while (state.accumulator >= FIXED_DT && steps < 6) {
        physicsStep(FIXED_DT);
        state.accumulator -= FIXED_DT;
        steps++;
      }
      render();
    }
    requestAnimationFrame(gameLoop);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  }

  function beginDrag(event) {
    if (state.paused || state.ended) return;
    const point = canvasPoint(event);
    if (state.waitingBird && Math.hypot(point.x - state.dragPoint.x, point.y - state.dragPoint.y) < 70) {
      state.dragging = true;
      canvas.setPointerCapture?.(event.pointerId);
      canvas.classList.add("dragging");
      updateDrag(point);
      audio.ensure();
    } else if (state.activeBird) {
      activateAbility();
    }
  }

  function updateDrag(point) {
    if (!state.dragging) return;
    let delta = { x: point.x - SLING.x, y: point.y - SLING.y };
    const maxPull = 180;
    const d = length(delta);
    if (d > maxPull) {
      delta.x = (delta.x / d) * maxPull;
      delta.y = (delta.y / d) * maxPull;
    }
    delta.x = Math.min(32, delta.x);
    state.dragPoint.x = SLING.x + delta.x;
    state.dragPoint.y = SLING.y + delta.y;
  }

  function endDrag() {
    if (!state.dragging) return;
    state.dragging = false;
    canvas.classList.remove("dragging");
    launchBird();
  }

  function transitionToGame(level) {
    const curtain = $("#transitionCurtain");
    curtain.classList.remove("enter");
    void curtain.offsetWidth;
    curtain.classList.add("enter");
    setTimeout(() => showGame(level), 390);
    setTimeout(() => curtain.classList.remove("enter"), 980);
  }

  function showGame(level = state.level) {
    state.view = "game";
    state.level = clamp(level, 1, state.unlocked);
    $("#landing").classList.remove("active");
    $("#gameScreen").classList.add("active");
    generateLevel(state.level);
    audio.ensure();
  }

  function showLanding() {
    state.view = "landing";
    state.paused = true;
    $("#gameScreen").classList.remove("active");
    $("#landing").classList.add("active");
    $("#pauseModal").classList.add("hidden");
    $("#resultModal").classList.add("hidden");
    updateHomeProgress();
  }

  let resetOrigin = "landing";
  function openResetModal(origin = "landing") {
    resetOrigin = origin;
    if (origin === "pause") $("#pauseModal").classList.add("hidden");
    $("#resetModal").classList.remove("hidden");
  }

  function closeResetModal() {
    $("#resetModal").classList.add("hidden");
    if (resetOrigin === "pause" && state.view === "game" && !state.ended) {
      $("#pauseModal").classList.remove("hidden");
    }
  }

  function resetAllProgress() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("flingflock-")) localStorage.removeItem(key);
      }
    } catch {
      // The game still resets in memory when browser storage is unavailable.
    }
    audio.muted = false;
    document.body.classList.remove("muted");
    state.level = 1;
    state.unlocked = 1;
    state.score = 0;
    state.displayScore = 0;
    $("#resetModal").classList.add("hidden");
    $("#pauseModal").classList.add("hidden");
    showLanding();
    toast("All progress reset — fresh expedition ready");
  }

  function pauseGame(show = true) {
    if (state.view !== "game" || state.ended) return;
    state.paused = show;
    $("#pauseModal").classList.toggle("hidden", !show);
  }

  canvas.addEventListener("pointerdown", beginDrag);
  canvas.addEventListener("pointermove", (event) => updateDrag(canvasPoint(event)));
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  $("#playBtn").addEventListener("click", () => transitionToGame(Math.min(state.unlocked, Math.max(1, Number(localStorage.getItem("flingflock-level")) || 1))));
  $("#homeBtn").addEventListener("click", showLanding);
  $("#restartBtn").addEventListener("click", () => generateLevel(state.level));
  $("#pauseBtn").addEventListener("click", () => pauseGame(true));
  $("#resumeBtn").addEventListener("click", () => pauseGame(false));
  $("#pauseRestartBtn").addEventListener("click", () => {
    $("#pauseModal").classList.add("hidden");
    generateLevel(state.level);
  });
  $("#pauseHomeBtn").addEventListener("click", showLanding);
  $("#resultRestartBtn").addEventListener("click", () => generateLevel(state.level));
  $("#nextBtn").addEventListener("click", () => {
    state.level++;
    state.unlocked = Math.max(state.unlocked, state.level);
    generateLevel(state.level);
  });
  $("#prevLevelBtn").addEventListener("click", () => {
    if (state.level > 1) {
      state.level--;
      generateLevel(state.level);
    } else toast("This is the first expedition");
  });
  $("#nextLevelBtn").addEventListener("click", () => {
    if (state.level < state.unlocked) {
      state.level++;
      generateLevel(state.level);
    } else toast("Clear this ridge to unlock the next");
  });
  $("#howBtn").addEventListener("click", () => $("#howModal").classList.remove("hidden"));
  $("#resetProgressBtn").addEventListener("click", () => openResetModal("landing"));
  $("#pauseResetProgressBtn").addEventListener("click", () => openResetModal("pause"));
  $("#cancelResetBtn").addEventListener("click", closeResetModal);
  $("#confirmResetBtn").addEventListener("click", resetAllProgress);
  $$("[data-close-modal]").forEach((button) => button.addEventListener("click", () => $("#howModal").classList.add("hidden")));
  $("#howModal").addEventListener("click", (event) => {
    if (event.target === $("#howModal")) $("#howModal").classList.add("hidden");
  });
  $("#resetModal").addEventListener("click", (event) => {
    if (event.target === $("#resetModal")) closeResetModal();
  });
  $("#soundLandingBtn").addEventListener("click", () => {
    const muted = audio.toggle();
    toast(muted ? "Sound muted" : "Sound on");
  });
  $$(".power-button").forEach((button) => button.addEventListener("click", () => usePower(button.dataset.power)));

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "m") {
      const muted = audio.toggle();
      toast(muted ? "Sound muted" : "Sound on");
    }
    if (state.view !== "game") return;
    if (event.code === "Space") {
      event.preventDefault();
      activateAbility();
    } else if (event.key.toLowerCase() === "r") {
      generateLevel(state.level);
    } else if (event.key === "Escape") {
      pauseGame(!state.paused);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.view === "game" && !state.ended) pauseGame(true);
  });

  updateHomeProgress();
  const launchParams = new URLSearchParams(window.location.search);
  if (launchParams.has("play")) {
    showGame(Math.min(state.unlocked, Math.max(1, Number(localStorage.getItem("flingflock-level")) || 1)));
  }
  requestAnimationFrame(gameLoop);
})();
