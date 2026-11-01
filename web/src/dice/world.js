// Three.js scene + cannon-es physics for the dice tray.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getDieDef } from './geometry.js';
import { getGeometry, getMaterial } from './textures.js';

const FOV = 38;
const GRAVITY = -45;
const UP = new THREE.Vector3(0, 1, 0);

function feltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1f5a46';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${v * 0.05})` : `rgba(0,0,0,${v * 0.12})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random(), 1 + Math.random());
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Reflection environment: the camera looks straight down, so the top faces
// mirror the zenith. Keep the zenith dark and put soft lights around the sides.
function studioEnvironment() {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.35,0.38,0.36), vec3(0.06,0.07,0.08), smoothstep(0.1, 0.9, h)); c = mix(c, vec3(0.08,0.2,0.15), smoothstep(0.0,-0.6,h)); gl_FragColor = vec4(c,1.0); }',
    })
  );
  env.add(sky);
  const panel = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.8, 3.5) });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), panel);
    m.position.set(Math.cos(a) * 40, 16, Math.sin(a) * 40);
    m.lookAt(0, 0, 0);
    env.add(m);
  }
  return env;
}

function randomQuaternion() {
  const u1 = Math.random();
  const u2 = Math.random() * Math.PI * 2;
  const u3 = Math.random() * Math.PI * 2;
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  return new CANNON.Quaternion(a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3));
}

export class DiceWorld {
  constructor(canvas, { onImpact } = {}) {
    this.canvas = canvas;
    this.onImpact = onImpact;
    this.dice = [];
    this.rolling = false;
    this.needsRender = true;
    this.insets = { top: 0, bottom: 0 };
    this.sizeFactor = 0.75; // < 1 = smaller dice (camera zooms out)
    this.holdStrip = false; // reserve a strip at the bottom for held dice
    this.tweens = [];
    this.raycaster = new THREE.Raycaster();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#163f32');
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(studioEnvironment(), 0.03).texture;
    scene.environmentIntensity = 0.9;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
    this.camera.up.set(0, 0, -1);

    scene.add(new THREE.HemisphereLight('#ffffff', '#204030', 0.6));
    const sun = new THREE.DirectionalLight('#fff6e8', 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    scene.add(sun, sun.target);
    this.sun = sun;

    const felt = feltTexture();
    this.felt = felt;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.floor = floor;

    // Strip at the bottom of the table where held dice are put aside.
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.y = 0.003;
    strip.visible = false;
    scene.add(strip);
    this.strip = strip;

    // Physics
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    world.allowSleep = true;
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.defaultContactMaterial.friction = 0.3;
    this.diceMat = new CANNON.Material('dice');
    this.wallMat = new CANNON.Material('wall');
    world.addContactMaterial(new CANNON.ContactMaterial(this.diceMat, this.wallMat, { friction: 0.28, restitution: 0.45 }));
    world.addContactMaterial(new CANNON.ContactMaterial(this.diceMat, this.diceMat, { friction: 0.15, restitution: 0.4 }));
    this.world = world;

    const plane = (rotAxis, angle) => {
      const b = new CANNON.Body({ mass: 0, material: this.wallMat, shape: new CANNON.Plane() });
      if (rotAxis) b.quaternion.setFromAxisAngle(rotAxis, angle);
      world.addBody(b);
      return b;
    };
    const X = new CANNON.Vec3(1, 0, 0);
    const Y = new CANNON.Vec3(0, 1, 0);
    this.walls = {
      floor: plane(X, -Math.PI / 2),
      ceiling: plane(X, Math.PI / 2),
      left: plane(Y, Math.PI / 2),
      right: plane(Y, -Math.PI / 2),
      top: plane(null, 0),
      bottom: plane(Y, Math.PI),
    };
    this.walls.ceiling.position.set(0, 14, 0);

    this.shapeCache = new Map();
    this.layout();
    this.lastTime = performance.now();
    this.acc = 0;
    renderer.setAnimationLoop(() => this.frame());
  }

  setInsets(top, bottom) {
    this.insets = { top, bottom };
    this.layout();
  }

  /** Sizes the tray to the screen and number of dice. */
  layout() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;

    const topF = Math.min(0.4, this.insets.top / h);
    const botF = Math.min(0.5, this.insets.bottom / h);
    const frac = Math.max(0.3, 1 - topF - botF);
    const k = 1 / (this.sizeFactor * this.sizeFactor);
    const area = Math.max(36, this.dice.length * 8) * k;
    const D = Math.sqrt(area / (aspect * frac));
    const W = D * aspect;
    const stripDepth = this.holdStrip ? 2.9 : 0;
    const height = D / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    this.camera.position.set(0, height, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    const m = 0.25;
    this.tray = {
      xMin: -W / 2 + m,
      xMax: W / 2 - m,
      zMin: -D / 2 + D * topF + m,
      zMax: D / 2 - D * botF - m - stripDepth,
    };
    this.stripZone = {
      xMin: -W / 2 + m,
      xMax: W / 2 - m,
      zMin: this.tray.zMax + 0.2,
      zMax: D / 2 - D * botF - m,
    };
    const sz = this.stripZone;
    this.strip.visible = this.holdStrip;
    this.strip.scale.set(W * 1.6, sz.zMax - sz.zMin + m, 1);
    this.strip.position.z = (sz.zMin + sz.zMax) / 2;
    const t = this.tray;
    this.walls.left.position.set(t.xMin, 0, 0);
    this.walls.right.position.set(t.xMax, 0, 0);
    this.walls.top.position.set(0, 0, t.zMin);
    this.walls.bottom.position.set(0, 0, t.zMax);
    this.walls.ceiling.position.set(0, Math.min(height * 0.6, 16), 0);

    this.floor.scale.set(W * 1.6, D * 1.6, 1);
    this.felt.repeat.set(W / 6, D / 6);

    const s = this.sun.shadow.camera;
    const r = Math.max(W, D) * 0.75;
    s.left = -r;
    s.right = r;
    s.top = r;
    s.bottom = -r;
    s.near = 1;
    s.far = height * 3;
    s.updateProjectionMatrix();
    // Low-ish sun: longer shadows and no specular hotspot on faces pointing at the camera.
    this.sun.position.set(-W * 0.55, Math.max(W, D) * 0.75, -D * 0.6);

    // Keep resting dice inside the (possibly smaller) tray.
    if (!this.rolling) {
      this.placeHeld(false);
      for (const d of this.active()) {
        const p = d.body.position;
        if (p.x < t.xMin + 0.8 || p.x > t.xMax - 0.8 || p.z < t.zMin + 0.8 || p.z > t.zMax - 0.8) {
          this.arrange();
          break;
        }
      }
    }
    this.needsRender = true;
  }

  shapeFor(type) {
    if (this.shapeCache.has(type)) return this.shapeCache.get(type);
    const def = getDieDef(type);
    const shape = new CANNON.ConvexPolyhedron({
      vertices: def.verts.map((v) => new CANNON.Vec3(v.x, v.y, v.z)),
      faces: def.faces.map((f) => f.idx),
    });
    this.shapeCache.set(type, shape);
    return shape;
  }

  /** dice: [{type, skin, group}] */
  setDice(list) {
    this.tweens = [];
    for (const d of this.dice) {
      this.scene.remove(d.mesh);
      this.world.removeBody(d.body);
    }
    this.dice = list.map((spec, i) => {
      const mesh = new THREE.Mesh(getGeometry(spec.type), getMaterial(spec.type, spec.skin));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      const body = new CANNON.Body({
        mass: 1,
        material: this.diceMat,
        shape: this.shapeFor(spec.type),
        linearDamping: 0.1,
        angularDamping: 0.1,
        sleepSpeedLimit: 0.12,
        sleepTimeLimit: 0.4,
      });
      body.addEventListener('collide', (e) => {
        if (!this.rolling || !this.onImpact) return;
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > 1.2) this.onImpact(v, e.body.mass > 0 ? 'dice' : 'floor');
      });
      this.world.addBody(body);
      mesh.userData.index = i;
      return { ...spec, index: i, mesh, body, def: getDieDef(spec.type), held: false };
    });
    this.layout();
    this.arrange();
  }

  /** Lays the dice out neatly with a random face up (initial state). */
  arrange() {
    const list = this.active();
    const n = list.length;
    if (!n) return;
    const t = this.tray;
    const W = t.xMax - t.xMin;
    const D = t.zMax - t.zMin;
    const cols = Math.max(1, Math.min(n, Math.floor(W / 2.6)));
    const rows = Math.ceil(n / cols);
    list.forEach((d, i) => {
      const r = Math.floor(i / cols);
      const inRow = Math.min(cols, n - r * cols);
      const c = i % cols;
      const x = (c - (inRow - 1) / 2) * Math.min(2.6, W / cols);
      const z = (t.zMin + t.zMax) / 2 + (r - (rows - 1) / 2) * Math.min(2.6, D / rows);
      const face = d.def.faces[Math.floor(Math.random() * d.def.faces.length)];
      const q = new THREE.Quaternion().setFromUnitVectors(face.normal, d.def.readDown ? UP.clone().negate() : UP);
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2));
      d.body.quaternion.set(q.x, q.y, q.z, q.w);
      // Rest height = distance from center to the face touching the floor.
      const down = d.def.faces.reduce((best, f) => {
        const nrm = f.normal.clone().applyQuaternion(q);
        return nrm.y < best.y ? { y: nrm.y, f } : best;
      }, { y: 2, f: null });
      d.body.position.set(x, down.f.normal.dot(down.f.center) + 0.01, z);
      d.body.velocity.setZero();
      d.body.angularVelocity.setZero();
      d.body.sleep();
      this.sync(d);
    });
    this.needsRender = true;
  }

  /** Changes skins without moving the dice. skins[i] = skin id for die i. */
  restyle(skins) {
    this.dice.forEach((d, i) => {
      d.skin = skins[i];
      d.mesh.material = getMaterial(d.type, d.skin);
    });
    this.needsRender = true;
  }

  sync(d) {
    d.mesh.position.copy(d.body.position);
    d.mesh.quaternion.copy(d.body.quaternion);
  }

  /** Throws all dice. Resolves with [{index, value, label}] once they are at rest. */
  throw(intensity = 1) {
    const t = this.tray;
    const W = t.xMax - t.xMin;
    const list = this.active();
    const n = list.length;
    const perLayer = Math.max(1, Math.floor(W / 1.9));
    const power = THREE.MathUtils.clamp(intensity, 0.7, 1.6);
    const fromBottom = Math.random() < 0.5;
    list.forEach((d, i) => {
      const layer = Math.floor(i / perLayer);
      const slot = i % perLayer;
      const inLayer = Math.min(perLayer, n - layer * perLayer);
      const x = (slot - (inLayer - 1) / 2) * 1.9 + (Math.random() - 0.5) * 0.4;
      const z = fromBottom ? t.zMax - 1.2 : t.zMin + 1.2;
      d.body.position.set(x, 2.2 + layer * 1.8, z);
      d.body.quaternion.copy(randomQuaternion());
      const dir = fromBottom ? -1 : 1;
      d.body.velocity.set((Math.random() - 0.5) * 10, 2 + Math.random() * 4, dir * (14 + Math.random() * 9) * power);
      d.body.angularVelocity.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
      d.body.wakeUp();
    });
    this.rolling = true;
    this.simTime = 0;
    this.nudges = 0;
    return new Promise((resolve) => (this.resolveRoll = resolve));
  }

  readDie(d) {
    const q = new THREE.Quaternion(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
    let best = null;
    let bestDot = -2;
    for (const f of d.def.faces) {
      const y = f.normal.clone().applyQuaternion(q).y * (d.def.readDown ? -1 : 1);
      if (y > bestDot) {
        bestDot = y;
        best = f;
      }
    }
    return { face: best, dot: bestDot };
  }

  checkSettled() {
    const elapsed = this.simTime * 1000;
    const t = this.tray;
    const list = this.active();
    // Dice that escaped the tray (should not happen) are put back.
    for (const d of list) {
      const p = d.body.position;
      if (p.y < -2 || p.x < t.xMin - 1 || p.x > t.xMax + 1 || p.z < t.zMin - 1 || p.z > t.zMax + 1) {
        d.body.position.set((t.xMin + t.xMax) / 2, 3, (t.zMin + t.zMax) / 2);
        d.body.velocity.set(0, 0, 0);
        d.body.wakeUp();
      }
    }
    const allAsleep = list.every((d) => d.body.sleepState === CANNON.Body.SLEEPING);
    const allSlow = list.every((d) => d.body.velocity.length() < 0.05 && d.body.angularVelocity.length() < 0.05);
    if (!(allAsleep || (allSlow && elapsed > 1500) || elapsed > 9000)) return;

    // Leaning dice (e.g. against each other) get a little nudge.
    // Dice lying on top of other dice are nudged off as well.
    const cocked = list.filter((d) => this.readDie(d).dot < 0.96 || d.body.position.y > d.def.restHeight + 0.35);
    if (cocked.length && this.nudges < 6 && elapsed < 15000) {
      this.nudges++;
      const cx = (t.xMin + t.xMax) / 2;
      const cz = (t.zMin + t.zMax) / 2;
      for (const d of cocked) {
        const p = d.body.position;
        // Away from the nearest other die, or towards the center when near a wall.
        let dx = cx - p.x;
        let dz = cz - p.z;
        const nearWall = p.x < t.xMin + 1.2 || p.x > t.xMax - 1.2 || p.z < t.zMin + 1.2 || p.z > t.zMax - 1.2;
        if (!nearWall) {
          let nearest = null;
          let best = Infinity;
          for (const o of list) {
            if (o === d) continue;
            const dist = o.body.position.distanceTo(p);
            if (dist < best) {
              best = dist;
              nearest = o;
            }
          }
          if (nearest && best < 2.5) {
            dx = p.x - nearest.body.position.x;
            dz = p.z - nearest.body.position.z;
          }
        }
        const len = Math.hypot(dx, dz) || 1;
        const push = 3 + Math.random() * 2.5;
        d.body.wakeUp();
        d.body.velocity.set((dx / len) * push + (Math.random() - 0.5) * 2, 6.5, (dz / len) * push + (Math.random() - 0.5) * 2);
        d.body.angularVelocity.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      }
      return;
    }
    this.rolling = false;
    const results = this.dice.map((d) => {
      const { face } = this.readDie(d);
      return { index: d.index, type: d.type, value: face.value, label: face.label };
    });
    const resolve = this.resolveRoll;
    this.resolveRoll = null;
    if (resolve) resolve(results);
  }

  // ---------- size ----------

  setSize(factor) {
    this.sizeFactor = factor;
    this.layout();
    if (!this.rolling) this.arrangeIfOutside();
  }

  setHoldStrip(on) {
    if (this.holdStrip === on) return;
    this.holdStrip = on;
    if (!on) this.dice.forEach((d) => this.unholdDie(d, false));
    this.layout();
    this.arrangeIfOutside();
  }

  arrangeIfOutside() {
    const t = this.tray;
    if (this.active().some((d) => {
      const p = d.body.position;
      return p.x < t.xMin + 0.6 || p.x > t.xMax - 0.6 || p.z < t.zMin + 0.6 || p.z > t.zMax - 0.6;
    })) this.arrange();
  }

  // ---------- holding dice aside ----------

  active() {
    return this.dice.filter((d) => !d.held);
  }

  /** Quaternion with the current top face exactly up, and the matching rest height. */
  flatPose(d) {
    const q = new THREE.Quaternion().copy(d.body.quaternion);
    const { face } = this.readDie(d);
    const want = d.def.readDown ? UP.clone().negate() : UP;
    const n = face.normal.clone().applyQuaternion(q);
    q.premultiply(new THREE.Quaternion().setFromUnitVectors(n, want));
    let low = null;
    for (const f of d.def.faces) {
      const y = f.normal.clone().applyQuaternion(q).y;
      if (!low || y < low.y) low = { y, f };
    }
    return { q, y: low.f.normal.dot(low.f.center) + 0.01 };
  }

  /** Index of the die under the given screen point, or -1. */
  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const hit = this.raycaster.intersectObjects(this.dice.map((d) => d.mesh), false)[0];
    return hit ? hit.object.userData.index : -1;
  }

  setHeld(index, held) {
    const d = this.dice[index];
    if (!d || d.held === held || this.rolling) return;
    if (held) {
      d.held = true;
      d.holdOrder = performance.now();
      this.world.removeBody(d.body);
      this.placeHeld(true);
    } else {
      this.unholdDie(d, true);
      this.placeHeld(true);
    }
  }

  unholdDie(d, animate) {
    if (!d.held) return;
    d.held = false;
    const { q, y } = this.flatPose(d);
    const spot = this.freeSpot(d);
    this.moveTo(d, new THREE.Vector3(spot.x, y, spot.z), q, animate, () => {
      this.world.addBody(d.body);
      d.body.velocity.setZero();
      d.body.angularVelocity.setZero();
      d.body.sleep();
    });
  }

  releaseAll(animate = true) {
    this.dice.forEach((d) => this.unholdDie(d, animate));
  }

  /** Lines the held dice up in the strip, in the order they were held. */
  placeHeld(animate) {
    const held = this.dice.filter((d) => d.held).sort((a, b) => a.holdOrder - b.holdOrder);
    if (!held.length) return;
    const sz = this.stripZone;
    const W = sz.xMax - sz.xMin;
    const step = Math.min(2.4, W / held.length);
    const z = (sz.zMin + sz.zMax) / 2;
    held.forEach((d, i) => {
      const { q, y } = this.flatPose(d);
      const x = (i - (held.length - 1) / 2) * step;
      this.moveTo(d, new THREE.Vector3(x, y, z), q, animate);
    });
  }

  /** A spot in the tray far away from the other dice. */
  freeSpot(self) {
    const t = this.tray;
    let best = null;
    for (let i = 0; i < 40; i++) {
      const x = t.xMin + 1 + Math.random() * (t.xMax - t.xMin - 2);
      const z = t.zMin + 1 + Math.random() * (t.zMax - t.zMin - 2);
      let min = Infinity;
      for (const o of this.dice) {
        if (o === self || o.held) continue;
        min = Math.min(min, Math.hypot(o.body.position.x - x, o.body.position.z - z));
      }
      if (!best || min > best.min) best = { x, z, min };
    }
    return best;
  }

  moveTo(d, pos, q, animate, done) {
    this.tweens = this.tweens.filter((tw) => tw.d !== d);
    if (!animate) {
      d.body.position.set(pos.x, pos.y, pos.z);
      d.body.quaternion.set(q.x, q.y, q.z, q.w);
      this.sync(d);
      if (done) done();
      this.needsRender = true;
      return;
    }
    this.tweens.push({
      d,
      p0: new THREE.Vector3().copy(d.body.position),
      p1: pos,
      q0: new THREE.Quaternion().copy(d.body.quaternion),
      q1: q,
      t0: performance.now(),
      dur: 280,
      done,
    });
    this.needsRender = true;
  }

  runTweens(now) {
    if (!this.tweens.length) return;
    this.tweens = this.tweens.filter((tw) => {
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      const e = 1 - Math.pow(1 - k, 3);
      const p = new THREE.Vector3().lerpVectors(tw.p0, tw.p1, e);
      p.y += Math.sin(Math.PI * k) * 1.2; // little hop
      const q = new THREE.Quaternion().slerpQuaternions(tw.q0, tw.q1, e);
      tw.d.body.position.set(p.x, p.y, p.z);
      tw.d.body.quaternion.set(q.x, q.y, q.z, q.w);
      this.sync(tw.d);
      if (k >= 1 && tw.done) tw.done();
      return k < 1;
    });
    this.needsRender = true;
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.runTweens(now);
    if (this.rolling) {
      this.world.step(1 / 120, dt, 8);
      this.simTime += dt;
      this.dice.forEach((d) => this.sync(d));
      this.checkSettled();
      this.needsRender = true;
    }
    if (this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = this.rolling || this.tweens.length > 0;
    }
  }
}
