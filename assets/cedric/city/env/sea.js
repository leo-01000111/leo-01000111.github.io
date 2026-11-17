// Sea: one big plane. Swell is a normal trick (summed sine gradients), a glitter path runs
// towards the sun, the sky is reflected with a fresnel term, and a soft foam line laps the beach.
import * as THREE from "../core/three.js";
import { GLSL_COMMON } from "./shade.js";
import { coast, SEA_Y } from "../world/layout.js";

export function createSea(g) {
  let mesh;
  const shore = coast.waves.reduce((s, w) => s + `+${w[0].toFixed(3)}*sin(z/${w[1].toFixed(3)}+${w[2].toFixed(3)})`, `${coast.x0.toFixed(3)}`);
  return {
    name: "sea",
    init() {
      const mat = new THREE.ShaderMaterial({
        uniforms: g.env.shade.uniforms,
        vertexShader: /* glsl */`varying vec3 vW;
          void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
        fragmentShader: /* glsl */`varying vec3 vW;` + GLSL_COMMON + `
          float shoreX(float z){return ${shore};}
          void main(){
            vec3 V=normalize(vW-uCam); float dist=distance(vW,uCam); float t=uTime; vec2 p=vW.xz;
            float far=1./(1.+dist*.012);
            vec2 k1=vec2(.36,.10),k2=vec2(.22,.52),k3=vec2(.90,.35),k4=vec2(1.7,-.8);
            vec2 gr=k1*cos(dot(p,k1)+t*.55)*.12+k2*cos(dot(p,k2)+t*.7)*.07
                   +(k3*cos(dot(p,k3)+t*1.1)*.03+k4*cos(dot(p,k4)+t*1.5)*.012)*far;
            vec3 n=normalize(vec3(-gr.x,1.,-gr.y));
            vec3 r=reflect(V,n); r.y=abs(r.y); r=normalize(r);
            float sr=max(dot(r,uSun),0.);
            float glitter=(pow(sr,300.)*4.+pow(sr,60.)*.9+pow(sr,10.)*.25)*uSunGlow*uDisc;
            float cv=clamp(dot(-V,n),0.,1.);
            float F=.03+.97*pow(1.-cv,5.);
            float w2=sin(p.x*.33+p.y*.21+t*.3)*.5+.5;
            float lum=clamp(dot(uAmb,vec3(.33))*2.2+.12,.12,1.);
            vec3 body=mix(vec3(.02,.07,.11),vec3(.06,.17,.21),w2)*lum;
            vec3 c=mix(body,skyColor(r),F)+vec3(1.,.7,.42)*glitter;
            float s=shoreX(p.y)-p.x;                                     // distance offshore, metres
            if(s<14.){
              float lap=.9+.5*sin(t*.5+p.y*.07)+.3*sin(t*.37+p.y*.21);
              float nz=.55+.45*vnoise(vec2(p.y*.6,s*1.5-t*.2));
              float foam=smoothstep(lap,lap*.2,s)*nz;
              float line2=smoothstep(.3,0.,abs(s-lap*2.1-1.6))*.35*vnoise(vec2(p.y*.4,t*.15+s));
              vec3 fc=(vec3(.82,.84,.9)*lum+uFogNear*.2);
              c=mix(c,fc,clamp(foam+line2,0.,1.)*.8);
            }
            gl_FragColor=vec4(fog(c,vW),1.);
          }`,
      });
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(-1400, SEA_Y, 0);
      g.scene.add(mesh);
    },
    update() {},
    dispose() { if (mesh) { mesh.geometry.dispose(); mesh.material.dispose(); g.scene.remove(mesh); } },
  };
}

// --- port ---
// The swell the shader draws, as a height and a slope, so boats can ride on it. Same waves as the
// fragment shader above (k, speed, amplitude); the two small ones fade with distance from the camera.
// out = { y, gx, gz }; far = 1 / (1 + distance to camera * 0.012).
const SWELL = [[0.36, 0.10, 0.55, 0.12, 0], [0.22, 0.52, 0.7, 0.07, 0], [0.90, 0.35, 1.1, 0.03, 1], [1.7, -0.8, 1.5, 0.012, 1]];
export function swellAt(x, z, t, far, out) {
  let y = 0, gx = 0, gz = 0;
  for (let i = 0; i < 4; i++) {
    const w = SWELL[i], a = w[3] * (w[4] ? far : 1), ph = w[0] * x + w[1] * z + t * w[2];
    y += a * Math.sin(ph); const c = a * Math.cos(ph); gx += c * w[0]; gz += c * w[1];
  }
  out.y = y; out.gx = gx; out.gz = gz;
  return out;
}
// --- end port ---
