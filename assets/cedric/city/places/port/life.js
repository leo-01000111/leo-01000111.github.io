// Le Port: everything that floats, flies or waves. Moored boats and the anchored dinghy bobbing on
// the swell (sea.js swellAt), the channel and swimming-zone buoys, the bell buoy, circling gulls, a
// friend waving from the pier end, and the small lights that go with them. The launch Cédric sails
// is instance 0 of the launches: this file poses it while it lies at the berth, sailing.js while it
// moves (g.world.port.player.active). Registered through the buildings system (X.add / X.onUpdate).
import * as THREE from "../../core/three.js";
import { swellAt } from "../../env/sea.js";
import { GLSL_COMMON } from "../../env/shade.js";
import { buildCedric } from "../../player/cedric3d.js";
import * as L from "../../world/layout.js";
import { launchGeo, dinghyGeo, buoyGeo, bellGeo, gullGeo, LAUNCH, BUOY_LIGHT_Y, BELL_LIGHT_Y } from "./models.js";
import { createWake } from "./fx.js";
import { addCircle, arcPoint } from "./boat.js";

const PT = L.port, SEA = L.SEA_Y;
const eul = new THREE.Euler(0, 0, 0, "YXZ"), quat = new THREE.Quaternion(), mat4 = new THREE.Matrix4(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
const sw = { y: 0, gx: 0, gz: 0 };

// Pose one instance: position, heading (the game's heading, bow along +x), pitch (bow up +), roll (starboard down +).
export function setPose(mesh, i, x, y, z, h, pitch, roll, scale = 1) {
  eul.set(roll, -h, pitch, "YXZ"); quat.setFromEuler(eul);
  sv.set(scale, scale, scale); pv.set(x, y, z);
  mesh.setMatrixAt(i, mat4.compose(pv, quat, sv));
  mesh.instanceMatrix.needsUpdate = true;
}

export function createLife(g, X) {
  const U = g.env.shade.uniforms, cam = g.camera.position, mat = g.env.shade.world;
  const W = g.world, owned = [];
  const track = o => { owned.push(o); return o; };
  const farAt = (x, z) => 1 / (1 + Math.hypot(x - cam.x, z - cam.z) * 0.012);
  const wave = (x, z, t) => swellAt(x, z, t, farAt(x, z), sw);

  // ---- boats ----
  const lg = track(launchGeo()), dg = track(dinghyGeo());
  const launches = new THREE.InstancedMesh(lg, mat, 3), dinghies = new THREE.InstancedMesh(dg, mat, 3);
  launches.name = "port-launches"; dinghies.name = "port-dinghies";
  const tint = (m, i, r, gg, b) => m.setColorAt(i, new THREE.Color(r, gg, b));
  tint(launches, 0, 1, 1, 1); tint(launches, 1, 0.7, 0.95, 1.08); tint(launches, 2, 1.1, 0.86, 0.68);
  tint(dinghies, 0, 1, 1, 1); tint(dinghies, 1, 1.05, 1.0, 0.85); tint(dinghies, 2, 0.9, 1.0, 1.05);
  launches.frustumCulled = dinghies.frustumCulled = false;
  const p = PT.pontoon, fx = p.spine[0] - 5.2, F = p.fingers;
  // [mesh, index, x, z, heading, roll gain]
  const moored = [
    [launches, 1, fx, (F[0] + F[1]) / 2, Math.PI, 1], [launches, 2, fx, (F[2] + p.spine[2]) / 2, Math.PI, 1],
    [dinghies, 0, fx, (F[1] + F[2]) / 2, Math.PI, 1.8], [dinghies, 1, -35.4, -167, -Math.PI / 2, 1.8],
  ];
  const anchored = { x: -74, z: -134, h: 0.6 };
  for (const m of moored) addCircle(m[2], m[3], m[0] === launches ? 1.5 : 1.0);
  addCircle(anchored.x, anchored.z, 1.2);

  // the launch Cédric sails: instance 0, poses shared with sailing.js
  const player = { idx: 0, active: false, pose: { x: PT.berth.x, y: SEA, z: PT.berth.z, h: PT.berth.heading, pitch: 0, roll: 0 } };

  // ---- buoys ----
  const buoyGeoM = track(buoyGeo());
  const buoys = [];
  for (let i = 0; i < 8; i++) { const z = 24 + i * 11; buoys.push({ x: L.shoreX(z) - 38, z, col: [1, 0.8, 0.22], lamp: [1, 0.72, 0.3], ph: i * 0.9 }); }
  buoys.push({ x: -108, z: -134, col: [1, 0.22, 0.18], lamp: [1, 0.15, 0.1], ph: 0.5 }, { x: -86, z: -110, col: [0.22, 0.85, 0.35], lamp: [0.2, 1, 0.35], ph: 2.2 });
  const buoyMesh = new THREE.InstancedMesh(buoyGeoM, mat, buoys.length);
  buoyMesh.name = "port-buoys"; buoyMesh.frustumCulled = false;
  buoys.forEach((b, i) => { tint(buoyMesh, i, b.col[0], b.col[1], b.col[2]); addCircle(b.x, b.z, 0.6); });
  const bellGeoM = track(bellGeo());
  const bellMesh = new THREE.Mesh(bellGeoM, mat);
  bellMesh.name = "port-bell"; bellMesh.frustumCulled = false;
  const bell = { x: PT.bell[0], z: PT.bell[1], roll: 0, last: -9, lamp: [1, 0.85, 0.55] };

  // ---- gulls ----
  const gg = track(gullGeo()), NG = 7;
  const gullMat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide,
    vertexShader: /* glsl */`attribute vec3 color; attribute float wing; attribute float aPh; uniform float uTime;
      varying vec3 vC,vN,vW;
      void main(){ vec3 p=position; p.y+=sin(uTime*3.6+aPh)*wing*.3;
        vec4 w=modelMatrix*instanceMatrix*vec4(p,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal); vC=color;
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`varying vec3 vC,vN,vW;` + GLSL_COMMON + `
      void main(){ vec3 n=vN; float d=abs(dot(n,uLDir));
        vec3 c=vC*(uAmb*1.15+uAmbUp*.5+uSunCol*(.25+.45*d)); gl_FragColor=vec4(fog(c,vW),1.); }`,
  });
  const gulls = new THREE.InstancedMesh(gg, gullMat, NG);
  gulls.name = "port-gulls"; gulls.frustumCulled = false;
  const gph = new Float32Array(NG);
  const orbit = [];
  for (let i = 0; i < NG; i++) {
    gph[i] = g.rng() * 6.28;
    orbit.push({ cx: i < 4 ? -52 + g.rng() * 18 : -20 + g.rng() * 16, cz: i < 4 ? -150 + g.rng() * 14 : -138 + g.rng() * 14, r: 14 + g.rng() * 22, w: (0.09 + g.rng() * 0.07) * (i % 2 ? 1 : -1), a: g.rng() * 6.28, y: 10 + g.rng() * 9, py: g.rng() * 6.28 });
  }
  gg.setAttribute("aPh", new THREE.InstancedBufferAttribute(gph, 1));

  // ---- friend on the pier end ----
  const fr = PT.friend, friend = buildCedric(window.CEDRIC_DESIGN, { ink: "#ff6f55", eye: "#f5c518" }, 1.15);
  const friendGroup = new THREE.Group();
  friendGroup.rotation.order = "YXZ"; friendGroup.add(friend.mesh);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(0.8, 0.5, 1);
  const fy = g.world.groundY ? g.world.groundY(fr.x, fr.z) : L.pier.y;
  shadow.position.set(fr.x, fy + 0.04, fr.z); shadow.rotation.z = fr.heading;
  friendGroup.position.set(fr.x, fy + 0.9, fr.z); friendGroup.rotation.y = -fr.heading;

  // ---- lights ----
  const tip = arcPoint(PT.breakwater.arc.sweep), head = { x: PT.quay.x0 + 0.5, z: PT.quay.z1 - 0.5 };
  // [kind, ...] kind 0 = fixed to something moving (positions set each frame), pulse in seconds (0 = steady)
  const lights = [];
  const addLight = (col, size, pulse, ph = 0) => lights.push({ col, size, pulse, ph, x: 0, y: 0, z: 0 }) - 1;
  const navP = [addLight(LAUNCH.lights[0][3], 1.1, 0), addLight(LAUNCH.lights[1][3], 1.1, 0), addLight(LAUNCH.lights[2][3], 1.4, 0)];
  const sternA = addLight([1, 0.92, 0.75], 1.0, 0), sternC = addLight([1, 0.92, 0.75], 1.0, 0);
  const buoyL = buoys.map(b => addLight(b.lamp, 2.0, 4.6 + (b.ph % 1.3), b.ph));
  const bellL = addLight(bell.lamp, 2.4, 5.2, 1.3);
  const tipL = addLight([1, 0.12, 0.08], 3.2, 6, 0.4), headL = addLight([0.15, 1, 0.3], 3.2, 6, 3.4);
  lights[tipL].x = tip.x; lights[tipL].y = 4.45; lights[tipL].z = tip.z;
  lights[headL].x = head.x; lights[headL].y = 4.05; lights[headL].z = head.z;
  const NL = lights.length, lpos = new Float32Array(NL * 3), lcol = new Float32Array(NL * 3), lsize = new Float32Array(NL);
  lights.forEach((l, i) => { lsize[i] = l.size; });
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3).setUsage(THREE.DynamicDrawUsage));
  lgeo.setAttribute("gcol", new THREE.BufferAttribute(lcol, 3).setUsage(THREE.DynamicDrawUsage));
  lgeo.setAttribute("gsize", new THREE.BufferAttribute(lsize, 1));
  const lmat = new THREE.ShaderMaterial({
    uniforms: { uLights: U.uLights, uFogDen: U.uFogDen, uScale: { value: 600 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`attribute vec3 gcol; attribute float gsize; uniform float uScale,uLights,uFogDen; varying vec3 vC;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(gsize*uScale/max(-mv.z,.5),1.,48.);
        vC=gcol*(.05+.55*uLights)*exp(-(-mv.z)*uFogDen*.6); }`,
    fragmentShader: /* glsl */`varying vec3 vC; void main(){ float r=length(gl_PointCoord-.5)*2.; float a=pow(max(1.-r,0.),2.2); gl_FragColor=vec4(vC*a,1.); }`,
  });
  const lpts = new THREE.Points(lgeo, lmat);
  lpts.frustumCulled = false; lpts.name = "port-lights";
  const _sz = new THREE.Vector2();

  const wake = createWake(g);

  X.add(launches, [launches]); X.add(dinghies, [dinghies]); X.add(buoyMesh, [buoyMesh]); X.add(bellMesh, [bellMesh]);
  X.add(gulls, [gulls]); X.add(lpts, [lpts]); X.add(wake.mesh, [wake.mesh]); X.add(friendGroup, [friend.mesh]); X.add(shadow, [shadow]);
  X.stats((lg.userData.tris || 0) * 3 + (dg.userData.tris || 0) * 3 + (buoyGeoM.userData.tris || 0) * buoys.length + (bellGeoM.userData.tris || 0) + (gg.userData.tris || 0) * NG);

  // pose of a launch at the berth (the player's, while it lies there)
  function moorPose(out, m, t) {
    wave(m[2], m[3], t);
    out.x = m[2]; out.z = m[3]; out.h = m[4] + Math.sin(t * 0.3 + m[2]) * 0.035;
    const s = Math.sin(out.h), c = Math.cos(out.h), gain = 1.6 * m[5];
    out.y = SEA + sw.y * 0.9 + 0.04;
    out.pitch = gain * (sw.gx * c + sw.gz * s); out.roll = gain * (sw.gx * s - sw.gz * c);
    return out;
  }
  const tmp = { x: 0, y: 0, z: 0, h: 0, pitch: 0, roll: 0 };
  const playerSlot = [launches, 0, PT.berth.x, PT.berth.z, PT.berth.heading, 1];

  const api = {
    launches, dinghies, player, wake, setPose, bell,
    onBell: null, // sailing.js: (x, z) when the bell buoy rings
    wave,
    friendNear: 0,
    // light slots the sailing code can move (the player's navigation lights)
    place(pose) { // put the player's navigation lights on a pose
      const c = Math.cos(pose.h), s = Math.sin(pose.h);
      for (let i = 0; i < 3; i++) {
        const q = LAUNCH.lights[i], l = lights[navP[i]];
        l.x = pose.x + c * q[0] - s * q[2]; l.y = pose.y + q[1]; l.z = pose.z + s * q[0] + c * q[2];
      }
    },
    update(dt, t) {
      // moored launches, dinghies
      for (let i = 0; i < moored.length; i++) {
        const m = moored[i];
        if (m[0] === launches) {
          const a = moorPose(tmp, m, t); setPose(m[0], m[1], a.x, a.y, a.z, a.h, a.pitch, a.roll);
          const l = lights[m[1] === 1 ? sternA : sternC], c = Math.cos(a.h), s = Math.sin(a.h);
          l.x = a.x + c * -2.78; l.y = a.y + 1.2; l.z = a.z + s * -2.78;
        } else {
          const a = moorPose(tmp, m, t + i * 1.7); setPose(m[0], m[1], a.x, a.y - 0.05, a.z, a.h, a.pitch * 1.4, a.roll * 1.4);
        }
      }
      { // anchored dinghy swings round slowly
        wave(anchored.x, anchored.z, t);
        const h = anchored.h + Math.sin(t * 0.07) * 1.1, s = Math.sin(h), c = Math.cos(h);
        setPose(dinghies, 2, anchored.x, SEA + sw.y * 0.9 - 0.02, anchored.z, h, 2 * (sw.gx * c + sw.gz * s), 2.2 * (sw.gx * s - sw.gz * c));
      }
      if (!player.active) {
        moorPose(player.pose, playerSlot, t);
        setPose(launches, 0, player.pose.x, player.pose.y, player.pose.z, player.pose.h, player.pose.pitch, player.pose.roll);
        api.place(player.pose);
      }
      // buoys
      for (let i = 0; i < buoys.length; i++) {
        const b = buoys[i];
        wave(b.x, b.z, t + b.ph);
        setPose(buoyMesh, i, b.x, SEA + sw.y * 0.9 - 0.03, b.z, 0, 4 * sw.gz, -4 * sw.gx);
        const l = lights[buoyL[i]]; l.x = b.x; l.y = SEA + sw.y * 0.9 + BUOY_LIGHT_Y; l.z = b.z;
      }
      { // bell buoy rolls more, and rings when it tips
        wave(bell.x, bell.z, t);
        const roll = 5 * (sw.gz + sw.gx * 0.5);
        mat4.identity();
        eul.set(roll * 0.8, t * 0.03, -5 * sw.gx, "YXZ"); quat.setFromEuler(eul); pv.set(bell.x, SEA + sw.y - 0.1, bell.z); sv.set(1, 1, 1);
        bellMesh.matrix.compose(pv, quat, sv); bellMesh.matrixAutoUpdate = false; bellMesh.matrixWorldNeedsUpdate = true; bellMesh.updateMatrixWorld(true);
        if (bell.roll < 0.16 && roll >= 0.16 && t - bell.last > 5) { bell.last = t; if (api.onBell) api.onBell(bell.x, bell.z); }
        bell.roll = roll;
        const l = lights[bellL]; l.x = bell.x; l.y = SEA + sw.y + BELL_LIGHT_Y; l.z = bell.z;
      }
      // gulls
      for (let i = 0; i < NG; i++) {
        const o = orbit[i];
        o.a += o.w * dt;
        const x = o.cx + Math.cos(o.a) * o.r, z = o.cz + Math.sin(o.a) * o.r, y = o.y + Math.sin(t * 0.21 + o.py) * 1.6;
        const h = Math.atan2(Math.cos(o.a) * o.w, -Math.sin(o.a) * o.w);
        setPose(gulls, i, x, y, z, h, Math.sin(t * 0.4 + o.py) * 0.06, o.w > 0 ? 0.25 : -0.25);
      }
      // the friend waves when somebody is near
      const st = g.player.state, d = st ? Math.hypot(st.pos.x - fr.x, st.pos.z - fr.z) : 999;
      api.friendNear += ((d < 90 ? 1 : 0) - api.friendNear) * (1 - Math.exp(-dt * 0.8));
      const wv = api.friendNear;
      friendGroup.position.y = fy + 0.9 + Math.sin(t * 1.5 + 1) * 0.06;
      friendGroup.rotation.x = Math.sin(t * 1.1) * 0.16 * wv;
      friendGroup.rotation.y = -fr.heading + Math.sin(t * 0.5) * 0.12 * wv;
      friendGroup.rotation.z = Math.sin(t * 1.3) * 0.03;
      friend.swing(Math.sin(t * 2.4) * (0.15 + 0.8 * wv), -0.15 + Math.sin(t * 2.4 + 1) * 0.25 * wv);
      // lights: colour (with a slow pulse where there is one) and position
      for (let i = 0; i < NL; i++) {
        const l = lights[i], k = l.pulse ? 0.45 + 0.55 * Math.pow(Math.sin((t + l.ph * 2.1) * Math.PI * 2 / l.pulse) * 0.5 + 0.5, 1.5) : 1;
        lpos[i * 3] = l.x; lpos[i * 3 + 1] = l.y; lpos[i * 3 + 2] = l.z;
        lcol[i * 3] = l.col[0] * k; lcol[i * 3 + 1] = l.col[1] * k; lcol[i * 3 + 2] = l.col[2] * k;
      }
      lgeo.attributes.position.needsUpdate = true; lgeo.attributes.gcol.needsUpdate = true;
      g.renderer.getDrawingBufferSize(_sz);
      lmat.uniforms.uScale.value = _sz.y * 0.5 * g.camera.projectionMatrix.elements[5];
    },
    dispose() {
      for (const o of owned) o.dispose();
      gullMat.dispose(); lgeo.dispose(); lmat.dispose(); wake.dispose();
      for (const m of [launches, dinghies, buoyMesh, gulls]) m.dispose();
      shadow.geometry.dispose(); shadow.material.dispose(); friend.dispose();
    },
  };
  return api;
}
