// Le Phare: a hexagonal concrete shaft braced by three tapering blades that start above head
// height, a gallery, a glowing lantern and a dark cap. At dusk a faint beam sweeps very slowly
// (one turn in 48 s). Signature: the three-bladed star silhouette against the sunset.
import * as THREE from "../../core/three.js";
import { K_PLAIN, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint } from "../kit/parts.js";

export default function phare(K, p, X) {
  K.at(p.x, p.z, 0, X.rnd);
  const col = C.light, y0 = 0.3, PI = Math.PI;
  K.cyl(0, 0, y0, y0 + 1.0, 2.3, 2.2, 6, tint(col, 0.9), K_RAW, PI / 6);          // plinth
  K.cyl(0, 0, y0 + 1.0, 20.5, 1.65, 1.15, 6, C.dark, K_RAW, PI / 6);   // dark core, light blades
  for (const a of [PI, PI / 3, -PI / 3]) {                                          // three blades
    const c = Math.cos(a), s = Math.sin(a), n = [-s, c], t = 0.32;
    const P = (r, y, side) => [c * r + n[0] * t * side, y, s * r + n[1] * t * side];
    // a long blade: its foot hangs 4.4 m out, 4.7 m up (clear of Cédric and the camera), its top carries the gallery
    K.hexa([P(1.3, 4.7, -1), P(4.4, 5.3, -1), P(4.4, 5.3, 1), P(1.3, 4.7, 1), P(1.0, 20.5, -1), P(2.9, 20.5, -1), P(2.9, 20.5, 1), P(1.0, 20.5, 1)], tint(col, 1.04), K_RAW);
    K.box(c * 4.0 - 0.15, c * 4.0 + 0.15, 5.12, 5.2, s * 4.0 - 0.15, s * 4.0 + 0.15, C.warmLight, K_LAMP, true);   // downlight under the blade foot
  }
  K.box(-0.55, 0.55, y0 + 1.0, 3.0, 1.55, 1.8, C.dark, K_PLAIN, false);            // door, facing the pier
  K.cyl(0, 0, 20.5, 21.1, 2.9, 2.9, 6, col, K_RAW, PI / 6, true);                  // gallery
  for (let i = 0; i < 6; i++) {
    const a = PI / 6 + i / 6 * PI * 2, b = PI / 6 + (i + 1) / 6 * PI * 2;
    K.tube([Math.cos(a) * 2.75, 22.1, Math.sin(a) * 2.75], [Math.cos(b) * 2.75, 22.1, Math.sin(b) * 2.75], 0.05, 4, C.steel, K_PLAIN);
    K.box(Math.cos(a) * 2.75 - 0.04, Math.cos(a) * 2.75 + 0.04, 21.1, 22.1, Math.sin(a) * 2.75 - 0.04, Math.sin(a) * 2.75 + 0.04, C.steel, K_PLAIN);
  }
  K.cyl(0, 0, 21.1, 23.4, 1.15, 1.15, 8, [1.0, 0.86, 0.62], K_LAMP);               // lantern
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; K.box(Math.cos(a) * 1.17 - 0.05, Math.cos(a) * 1.17 + 0.05, 21.1, 23.4, Math.sin(a) * 1.17 - 0.05, Math.sin(a) * 1.17 + 0.05, C.steel, K_PLAIN); }
  K.cyl(0, 0, 23.4, 23.8, 1.5, 1.5, 8, C.dark, K_RAW, 0, true);
  K.cyl(0, 0, 23.8, 25.2, 1.5, 0.1, 8, C.dark, K_RAW);
  K.box(-0.04, 0.04, 25.2, 26.4, -0.04, 0.04, C.steel, K_PLAIN);
  K.glow(0, 22.3, 0, [1.0, 0.82, 0.55], 7);
  K.circle(0, 0, 2.3, 26.5);

  // slow beam: two open cones from the lantern, additive, only once the light comes on
  const U = X.g.env.shade.uniforms;
  const geo = new THREE.CylinderGeometry(0.5, 7, 70, 16, 1, true);
  geo.translate(0, 35, 0); geo.rotateZ(-PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uLights: U.uLights }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying float vX; void main(){ vX=position.x; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uLights; varying float vX;
      void main(){ float f=(1.-smoothstep(2.,70.,vX))*smoothstep(0.,3.,vX); gl_FragColor=vec4(vec3(1.,.82,.55)*f*.11*smoothstep(.25,.9,uLights),1.); }`,
  });
  const beam = new THREE.Group();
  const m1 = new THREE.Mesh(geo, mat), m2 = new THREE.Mesh(geo, mat);
  m2.rotation.y = PI;
  beam.add(m1, m2);
  beam.position.set(p.x, 22.3, p.z);
  m1.frustumCulled = m2.frustumCulled = false;
  X.add(beam, [m1]);
  X.onUpdate((dt, t) => { beam.rotation.y = t * PI * 2 / 48; beam.visible = U.uLights.value > 0.2; });
}
