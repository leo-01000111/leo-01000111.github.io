// Sky dome: gradient, sun disc and glow, haze bands, a few slow far clouds, stars at dusk.
import * as THREE from "../core/three.js";
import { GLSL_COMMON } from "./shade.js";

export function createSky(g) {
  let mesh;
  return {
    name: "sky",
    init() {
      const mat = new THREE.ShaderMaterial({
        uniforms: g.env.shade.uniforms, side: THREE.BackSide, depthWrite: false,
        vertexShader: /* glsl */`varying vec3 vP;
          void main(){vP=position; vec4 p=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.); gl_Position=p.xyww;}`,
        fragmentShader: /* glsl */`varying vec3 vP;` + GLSL_COMMON + `
          void main(){
            vec3 d=normalize(vP); float h=d.y;
            vec3 c=skyColor(d);
            if(h>.01){
              vec2 uv=d.xz/(h+.12)*.55+vec2(uTime*.004,0.);
              float n=vnoise(uv*2.)*.55+vnoise(uv*4.7+3.)*.3+vnoise(uv*10.)*.15;
              float dens=smoothstep(.56,.78,n)*smoothstep(.01,.14,h)*(1.-smoothstep(.45,.85,h));
              float az=dot(normalize(d.xz+1e-4),normalize(uSun.xz))*.5+.5;
              vec3 cc=mix(uFogFar*1.3+uSkyMid*.3,uFogNear*1.15,az*az*az);
              c=mix(c,cc,dens*.62);
              if(uStars>.01){
                vec3 q=d*70.; vec3 id=floor(q); vec3 f=fract(q)-.5;
                float r=hash3(id);
                vec3 off=(vec3(hash3(id+1.7),hash3(id+3.1),hash3(id+5.3))-.5)*.6;
                float s=step(.962,r)*smoothstep(.1,.0,length(f-off));
                s*=.75+.25*sin(uTime*.6+r*80.);
                c+=vec3(.8,.85,1.)*s*uStars*smoothstep(.02,.25,h)*(1.-dens*.9);
              }
            }
            gl_FragColor=vec4(c,1.);
          }`,
      });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      g.scene.add(mesh);
    },
    update() {},
    dispose() { if (mesh) { mesh.geometry.dispose(); mesh.material.dispose(); g.scene.remove(mesh); } },
  };
}
