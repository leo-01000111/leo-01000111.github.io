// Le Port: the launch's wake. One soft foam mesh on the water: a trail that spreads and fades behind
// the stern and a bow wave that opens from the stem. Positions are rewritten each frame into fixed
// buffers (nothing is allocated). The sea itself is a flat plane, so the foam sits just above it.
import * as THREE from "../../core/three.js";
import { GLSL_COMMON } from "../../env/shade.js";
import { SEA_Y } from "../../world/layout.js";

const N = 40, BOW = 7, MAXAGE = 9, EVERY = 0.2;
const V = N * 2 + 4 * BOW;

export function createWake(g) {
  const pos = new Float32Array(V * 3), info = new Float32Array(V * 2), idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  for (let arm = 0; arm < 2; arm++) for (let i = 0; i < BOW - 1; i++) { const a = N * 2 + arm * BOW * 2 + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aInfo", new THREE.BufferAttribute(info, 2).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: g.env.shade.uniforms, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: /* glsl */`attribute vec2 aInfo; varying vec2 vI; varying vec3 vW;
      void main(){ vI=aInfo; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`varying vec2 vI; varying vec3 vW;` + GLSL_COMMON + `
      void main(){
        float e=1.-abs(vI.x), a=vI.y*smoothstep(0.,.5,e);
        float n=vnoise(vW.xz*1.7+vec2(uTime*.35,0.))*.6+vnoise(vW.xz*4.3-vec2(0.,uTime*.3))*.4;
        a*=smoothstep(.16,.6,n+.3*e);
        float lum=clamp(dot(uAmb,vec3(.33))*2.4+.14,.14,1.);
        vec3 c=vec3(.84,.89,.95)*lum+uSunCol*.2+uFogNear*.12;
        gl_FragColor=vec4(fog(c,vW),a*.9);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;   // the wake follows the player's launch over the whole sea; its buffer is rewritten each frame and the bounding sphere is never refreshed
  mesh.renderOrder = 2; mesh.name = "port-wake";

  const sx = new Float32Array(N), sz = new Float32Array(N), sh = new Float32Array(N), sa = new Float32Array(N).fill(1e3), sp = new Float32Array(N);
  let head = 0, acc = 0;
  const Y = SEA_Y + 0.03;

  function put(i, x, z, across, alpha) { pos[i * 3] = x; pos[i * 3 + 1] = Y; pos[i * 3 + 2] = z; info[i * 2] = across; info[i * 2 + 1] = alpha; }

  return {
    mesh,
    // x, z, heading of the boat; u = its speed; on = false while it lies still at the berth
    update(dt, x, z, h, u, on) {
      const c = Math.cos(h), s = Math.sin(h);
      for (let i = 0; i < N; i++) sa[i] += dt;
      acc += dt;
      if (on && Math.abs(u) > 0.5 && acc >= EVERY) {
        acc = 0; head = (head + 1) % N;
        sx[head] = x - c * 2.5; sz[head] = z - s * 2.5; sh[head] = h; sa[head] = 0; sp[head] = Math.min(1, Math.abs(u) / 5);
      }
      // trail, newest first
      let last = -1;
      for (let k = 0; k < N; k++) {
        const j = (head - k + N) % N, age = sa[j], v = k * 2;
        const f = age >= MAXAGE ? 0 : Math.pow(1 - age / MAXAGE, 1.7), w = 0.55 + age * 0.6 + sp[j] * 0.25, al = f * sp[j] * 0.75 * Math.min(1, age * 2 + 0.25);
        const px = -Math.sin(sh[j]) * w, pz = Math.cos(sh[j]) * w;
        put(v, sx[j] + px, sz[j] + pz, -1, al); put(v + 1, sx[j] - px, sz[j] - pz, 1, al);
        last = j;
      }
      // bow wave: two arms opening back from the stem
      const amt = Math.max(0, Math.min(1, (Math.abs(u) - 0.6) / 3.5)) * (on ? 1 : 0) * (u > 0 ? 1 : 0.4);
      for (let arm = 0; arm < 2; arm++) {
        const sd = arm ? 1 : -1;
        for (let i = 0; i < BOW; i++) {
          const t = i / (BOW - 1), f = 2.55 - t * 3.6, l = sd * (0.1 + 1.45 * Math.pow(t, 0.8));
          const nx = -0.35 * sd, nz = -0.92, hw = 0.14 + 0.2 * t; // across the arm
          const lx1 = f + nx * hw, lz1 = l + nz * hw * sd * -1, lx2 = f - nx * hw, lz2 = l - nz * hw * sd * -1;
          const al = amt * Math.pow(1 - t, 0.9) * 0.85, v = N * 2 + arm * BOW * 2 + i * 2;
          put(v, x + c * lx1 - s * lz1, z + s * lx1 + c * lz1, -1, al); put(v + 1, x + c * lx2 - s * lz2, z + s * lx2 + c * lz2, 1, al);
        }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aInfo.needsUpdate = true;
      return last;
    },
    clear() { sa.fill(1e3); acc = 0; },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
