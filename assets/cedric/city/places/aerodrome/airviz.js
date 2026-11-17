// Thermals you can see: warm motes that spiral slowly upward round each thermal's core, and a few dark
// birds (gulls) circling and climbing in the lift. One Points draw: the shader places everything from a
// handful of per-thermal centres, so nothing is touched per frame but those centres. Premultiplied blend:
// motes add light (alpha 0), birds darken (alpha > 0).
import * as THREE from "../../core/three.js";
import { seeded } from "../../core/rng.js";
import { THERMALS, thermalCenter } from "./air.js";

const MOTES = 40, BIRDS = 3;

export function createAirViz(g) {
  let pts = null, mat = null;
  const centres = THERMALS.map(() => new THREE.Vector3());
  const c = { x: 0, z: 0 }, sz = new THREE.Vector2();
  return {
    init() {
      const U = g.env.shade.uniforms, rnd = seeded(777);
      const n = THERMALS.length * (MOTES + BIRDS), a0 = new Float32Array(n * 4), a1 = new Float32Array(n * 4), pos = new Float32Array(n * 3);
      let i = 0;
      THERMALS.forEach((th, ti) => {
        for (let k = 0; k < MOTES + BIRDS; k++, i++) {
          const bird = k >= MOTES;
          a0.set([ti, rnd(), bird ? 0.3 + rnd() * 0.5 : 0.1 + Math.sqrt(rnd()) * 0.85, rnd() * 6.283], i * 4);
          a1.set([bird ? 1 : 0, 0.8 + rnd() * 0.4, bird ? 2.6 + rnd() * 1.2 : 2.2 + rnd() * 2.4, rnd()], i * 4);
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("a0", new THREE.BufferAttribute(a0, 4));
      geo.setAttribute("a1", new THREE.BufferAttribute(a1, 4));
      mat = new THREE.ShaderMaterial({
        uniforms: { uC: { value: centres }, uTime: U.uTime, uLights: U.uLights, uFogDen: U.uFogDen, uScale: { value: 600 } },
        transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        vertexShader: /* glsl */`attribute vec4 a0; attribute vec4 a1; uniform vec3 uC[${THERMALS.length}]; uniform float uTime,uScale,uFogDen;
          varying vec4 vP;
          void main(){
            vec3 c=uC[int(a0.x+.5)]; float bird=step(.5,a1.x);
            float u=fract(a0.y+uTime/mix(34.,150.,bird)*a1.y);
            float h=mix(10.+u*300.,70.+u*230.,bird);
            float ang=a0.w+uTime*mix(.34,.2,bird)*a1.y+h*.016;
            float r=c.z*a0.z*mix(.8,.55,bird);
            vec3 p=vec3(c.x+cos(ang)*r,h,c.y+sin(ang)*r);
            vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
            float dist=max(-mv.z,.5);
            gl_PointSize=clamp(a1.z*uScale/dist,1.,96.);
            float fade=smoothstep(0.,.1,u)*(1.-smoothstep(.72,1.,u));
            vP=vec4(bird,mix(fade,smoothstep(0.,.06,u)*(1.-smoothstep(.94,1.,u)),bird)*exp(-dist*uFogDen*mix(.5,.9,bird)),uTime*mix(0.,4.2,bird)*a1.y+a1.w*6.28,0.);
          }`,
        fragmentShader: /* glsl */`uniform float uLights; varying vec4 vP;
          void main(){
            vec2 q=gl_PointCoord*2.-1.;
            if(vP.x<.5){ float a=pow(max(1.-length(q),0.),2.4); gl_FragColor=vec4(vec3(1.,.72,.45)*a*vP.y*.2*(1.-.4*uLights),0.); }
            else{
              float ax=abs(q.x), flap=sin(vP.z)*.3;
              float yl=-ax*(.3+flap*.7)+.18;               // two arms of a shallow V, tips flexing with the beat
              float th=.1*(1.-.55*ax)+.03;
              float cov=(1.-smoothstep(th*.55,th,abs(q.y-yl)))*(1.-smoothstep(.82,1.,ax));
              cov=max(cov,1.-smoothstep(.1,.2,length(q-vec2(0.,.06))));
              float a=cov*vP.y;
              gl_FragColor=vec4(vec3(.05,.035,.08)*a,a);
            }
          }`,
      });
      pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = 2;
      g.scene.add(pts);
    },
    // called by the flight system with the same clock the air model uses
    set(t) {
      if (!pts) return;
      for (let i = 0; i < THERMALS.length; i++) { thermalCenter(i, t, c); centres[i].set(c.x, c.z, THERMALS[i].r); }
      g.renderer.getDrawingBufferSize(sz);
      mat.uniforms.uScale.value = sz.y * 0.5 * g.camera.projectionMatrix.elements[5];
    },
    dispose() { if (pts) { g.scene.remove(pts); pts.geometry.dispose(); mat.dispose(); pts = null; } },
  };
}
