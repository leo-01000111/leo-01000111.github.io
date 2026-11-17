// The single post pass: cheap glow on bright pixels, vignette, light grain. The scene renders
// into a (multisampled) target; `uMode` is kept so the prototype's hatch / ASCII looks can come
// back later as hidden toggles.
import * as THREE from "../core/three.js";

export function createPost(g) {
  let rt = null, quad, cam, scene, mat;
  const U = { tC: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uPx: { value: 1 }, uMode: { value: 0 }, uTime: null };

  function size(w, h, pr) {
    const W = Math.max(2, Math.floor(w * pr)), H = Math.max(2, Math.floor(h * pr));
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, samples: g.qualityInfo.samples });
    U.tC.value = rt.texture; U.uRes.value.set(W, H); U.uPx.value = pr;
  }

  const api = {
    name: "post",
    init() {
      U.uTime = g.env.shade.uniforms.uTime;
      mat = new THREE.ShaderMaterial({
        uniforms: U, depthTest: false, depthWrite: false,
        vertexShader: /* glsl */`void main(){gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader: /* glsl */`
          uniform sampler2D tC; uniform vec2 uRes; uniform float uPx,uTime; uniform int uMode;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          void main(){
            vec2 fc=gl_FragCoord.xy, uv=fc/uRes;
            vec3 c=texture2D(tC,uv).rgb, gl=vec3(0.);
            for(int i=0;i<12;i++){
              float a=float(i)*.5236; vec2 d=vec2(cos(a),sin(a))*(i-(i/2)*2==0?5.:11.)*uPx/uRes;
              vec4 s=texture2D(tC,uv+d); gl+=max(s.rgb-.8,0.)*s.a; // alpha 0 (Cedric) never glows
            }
            c+=gl*.2;
            vec2 q=uv-.5; c*=1.-dot(q,q)*.7;
            c+=(hash(fc+uTime)-.5)*.025;
            gl_FragColor=vec4(c,1.);
          }`,
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
      quad = new THREE.Mesh(geo, mat);
      quad.frustumCulled = false;
      scene = new THREE.Scene(); scene.add(quad);
      cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      g.events.on("resize", s => size(s.w, s.h, s.pr));
      g.events.on("quality", () => { const s = g.size; size(s.w, s.h, s.pr); });
      size(g.size.w, g.size.h, g.size.pr);
    },
    update() {},
    render() {
      const r = g.renderer;
      r.setRenderTarget(rt); r.render(g.scene, g.camera);
      r.setRenderTarget(null); r.render(scene, cam);
    },
    dispose() {
      if (rt) rt.dispose();
      if (quad) { quad.geometry.dispose(); mat.dispose(); }
    },
  };
  return api;
}
