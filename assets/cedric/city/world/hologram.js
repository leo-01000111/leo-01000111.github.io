// The giant hologram: a translucent magenta / violet shrimp in Cédric's own pen-hatch style,
// projected from a ledge on a tower inland of Chez Basile and turned to face the bar. Additive,
// faint scanlines, a very slow drift and turn, a gentle shimmer. Faint by day, stronger after
// sunset, and it tints nearby facades through the shared uHoloP / uHoloI uniforms.
// Two draw calls: the shrimp (instanced rods) and the projector cone.
import * as THREE from "../core/three.js";
import { buildCedric } from "../player/cedric3d.js";
import * as L from "./layout.js";

export function createHologram(g) {
  let body, cone, group, base = null, beamMat, rodMat;
  const U = () => g.env.shade.uniforms;
  const centre = new THREE.Vector3();

  return {
    name: "hologram",
    init() {
      const e = g.world.holoEmitter;
      if (!e || !window.CEDRIC_DESIGN) return;
      const S = U();
      const common = { uTime: S.uTime, uLights: S.uLights, uCam: S.uCam, uFogDen: S.uFogDen };
      rodMat = new THREE.ShaderMaterial({
        uniforms: common, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */`varying vec3 vC,vW;
          void main(){ vC=vec3(1.);
            #ifdef USE_INSTANCING_COLOR
              vC=instanceColor;
            #endif
            vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: /* glsl */`uniform float uTime,uLights,uFogDen; uniform vec3 uCam; varying vec3 vC,vW;
          void main(){
            float scan=.55+.45*smoothstep(.25,.55,fract(vW.y*.85-uTime*.06));
            float shim=.88+.12*sin(uTime*1.1+vW.y*.17+vW.z*.05);
            float I=(.2+.62*uLights)*exp(-distance(vW,uCam)*uFogDen*.35);
            gl_FragColor=vec4(vC*scan*shim*I,1.);
          }`,
      });
      const len = L.hologram.length;
      body = buildCedric(window.CEDRIC_DESIGN, { ink: "#d65cff", eye: "#ff8fd8" }, len, { depth: 3, slice: 0.12, rod: 6, material: rodMat });
      group = new THREE.Group();
      group.add(body.mesh);
      base = { x: e.x, y: e.y + L.hologram.lift, z: e.z, yaw: -Math.PI / 2 };
      group.position.set(base.x, base.y, base.z);
      g.scene.add(group);

      // projector cone from the ledge up to the shrimp
      const h = L.hologram.lift - 3;
      const geo = new THREE.CylinderGeometry(len * 0.36, 1.6, h, 24, 1, true);
      geo.translate(0, h / 2, 0);
      beamMat = new THREE.ShaderMaterial({
        uniforms: common, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: /* glsl */`varying float vY; void main(){ vY=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: /* glsl */`uniform float uTime,uLights; varying float vY;
          void main(){ float f=(1.-smoothstep(0.,${h.toFixed(1)},vY))*(.8+.2*sin(uTime*.7+vY*.6));
            gl_FragColor=vec4(vec3(.75,.25,1.)*f*(.025+.07*uLights),1.); }`,
      });
      cone = new THREE.Mesh(geo, beamMat);
      cone.position.set(e.x, e.y, e.z);
      g.scene.add(cone);
      g.stats.tris += body.mesh.count * 12 + 48;
      g.world.hologram = { group, position: group.position, length: len };
    },
    update(dt, t) {
      if (!group) return;
      // very slow drift and turn, never more than a few degrees a minute
      group.position.set(base.x + Math.sin(t * 0.031) * 1.2, base.y + Math.sin(t * 0.11) * 0.9, base.z + Math.sin(t * 0.023 + 1) * 1.5);
      group.rotation.set(Math.sin(t * 0.07) * 0.03, base.yaw + Math.sin(t * 0.043) * 0.22, Math.sin(t * 0.09 + 2) * 0.04);
      body.swing(Math.sin(t * 0.2) * 0.12, Math.sin(t * 0.15 + 1) * 0.08);
      const S = U();
      centre.copy(group.position);
      S.uHoloP.value.copy(centre);
      S.uHoloI.value = 0.06 + 0.42 * S.uLights.value;
    },
    dispose() {
      if (group) { g.scene.remove(group); body.dispose(); }
      if (cone) { g.scene.remove(cone); cone.geometry.dispose(); beamMat.dispose(); }
      group = cone = null;
    },
  };
}
