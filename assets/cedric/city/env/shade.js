// Shared shading: one uniform set (by reference), one GLSL chunk, and the materials built on it.
// Flat lambert from the sun, violet/teal ambient, fog that is orange towards the sun and violet
// away from it, snow tint on up-facing faces, wet darkening, lit windows, neon, and the dithered
// "window" that cuts geometry between the camera and Cedric.
import * as THREE from "../core/three.js";

export function createUniforms() {
  const V = () => ({ value: new THREE.Vector3() });
  const F = v => ({ value: v });
  return {
    uSun: V(), uLDir: V(), uSunCol: V(), uAmb: V(), uAmbUp: V(), uFogNear: V(), uFogFar: V(),
    uCam: V(), uPl: V(), uFol: V(), uSkyTop: V(), uSkyMid: V(), uSkyHor: V(),
    uFogDen: F(0.0065), uTime: F(0), uSnow: F(0), uWet: F(0), uLights: F(0), uNeon: F(0),
    uStars: F(0), uSunGlow: F(0.5), uDisc: F(1), uCut: F(1), // uCut 0 = no dithered window (roof level)
    uHoloP: V(), uHoloI: F(0), // hologram light on nearby facades (world/hologram.js sets them)
  };
}

export const GLSL_COMMON = /* glsl */`
uniform vec3 uSun,uLDir,uSunCol,uAmb,uAmbUp,uFogNear,uFogFar,uCam,uPl,uFol,uSkyTop,uSkyMid,uSkyHor,uHoloP;
uniform float uFogDen,uTime,uSnow,uWet,uLights,uNeon,uStars,uSunGlow,uDisc,uHoloI,uCut;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float hash3(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
vec3 fogc(vec3 w){vec3 v=w-uCam;float s=dot(normalize(v.xz+1e-4),normalize(uSun.xz))*.5+.5;return mix(uFogFar,uFogNear,s*s);}
vec3 fog(vec3 c,vec3 w){return mix(c,fogc(w),1.-exp(-distance(w,uCam)*uFogDen));}
vec3 skyColor(vec3 d){
  float h=max(d.y,0.);
  vec3 c=mix(uSkyHor,uSkyMid,smoothstep(0.,.2,h)); c=mix(c,uSkyTop,smoothstep(.12,.65,h));
  float away=1.-smoothstep(-.3,.85,dot(normalize(d.xz+1e-4),normalize(uSun.xz)));
  c=mix(c,mix(uFogFar,uSkyTop,smoothstep(0.,.45,h)),away*.85);
  float s=max(dot(d,uSun),0.);
  c+=vec3(1.,.5,.22)*pow(s,10.)*.55*uSunGlow*2. + vec3(1.,.9,.7)*smoothstep(.9993,.9996,s)*1.1*uDisc;
  return c*(.92+.08*sin(h*40.+d.x*3.));
}`;

// Shared vertex stage: merged world geometry (identity transform) and InstancedMesh both work.
// Instanced foliage sways a little, more towards the top of the model.
const WORLD_VERT = /* glsl */`
  attribute vec3 color; attribute float kind;
  uniform float uTime;
  varying vec3 vW,vN,vC; varying float vK;
  void main(){
    vec4 w=vec4(position,1.); vec3 n=normal, c=color;
    #ifdef USE_INSTANCING
      w=instanceMatrix*w; n=mat3(instanceMatrix)*n;
      if(kind>1.5&&kind<2.5){ float h=max(position.y-.5,0.);
        w.xz+=vec2(sin(uTime*.9+w.x*.31+w.z*.17),cos(uTime*.7+w.z*.29+w.x*.11))*.03*h; }
    #endif
    #ifdef USE_INSTANCING_COLOR
      c*=instanceColor;
    #endif
    w=modelMatrix*w;
    vW=w.xyz; vN=normalize(mat3(modelMatrix)*n); vC=c; vK=kind;
    gl_Position=projectionMatrix*viewMatrix*w;
  }`;

// dithered window between the camera and Cedric, so buildings never hide him
const CUT = /* glsl */`
  if(uCut>.5&&vW.y>.4){ vec3 cp=uPl-uCam; float t=dot(vW-uCam,cp)/dot(cp,cp);
    if(t>0.&&t<.92){ float r=length(vW-uCam-cp*t);
      if(r<1.1+1.9*t && mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),2.)<1.) discard; } }`;

// kind: 0 wall with windows, 1 plain, 2 foliage, 3 neon, 4 glazing band, 5 raw concrete,
// 6 lamp (lit with the window-light amount)
export function createWorldMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */`
      varying vec3 vW,vN,vC; varying float vK;` + GLSL_COMMON + `
      void main(){` + CUT + `
        int k=int(vK+.5);
        vec3 base=vC, em=vec3(0.), add=vec3(0.);
        bool wall=abs(vN.y)<.5, xf=abs(vN.x)>abs(vN.z);
        float u=xf?vW.z:vW.x, dep=xf?vW.x:vW.z;
        if(k==0){
          if(wall){
            vec2 g=vec2(u/2.4,vW.y/3.2), id=floor(g), f=fract(g);
            base*=.9+.1*step(.5,fract(vW.y*1.7));                      // board-formed concrete
            base*=.75+.25*smoothstep(0.,14.,vW.y);                      // grime near the street
            float win=step(.16,f.x)*step(f.x,.84)*step(.34,f.y)*step(f.y,.8);
            if(win>.5&&vW.y>1.){
              float h=hash(id+floor(dep*.2)*7.3);
              base=vec3(.03,.04,.07)+uSkyHor*.07*(1.-uLights);        // dark glass, a little sky in it
              float thr=mix(.97,.6,uLights);
              if(h>thr) em=(h>.93?vec3(.25,.95,1.):vec3(1.,.6,.24))*(.55+.5*hash(id.yx))*(.35+.65*uLights);
            }
          }
        } else if(k==5){
          if(wall){
            float pl=vW.y/.34;
            base*=.92+.1*hash(vec2(floor(pl),floor(u/2.6)+floor(dep*.5)*3.));   // board courses
            base*=.94+.06*smoothstep(.0,.12,fract(pl));                        // board joints
            float fl=vW.y/3.2, st=vnoise(vec2(u*1.3+dep*.7,floor(fl)*3.7));
            base*=1.-.3*smoothstep(.5,.85,st)*pow(1.-fract(fl),1.5);            // water stains under ledges
            base*=.78+.22*smoothstep(0.,9.,vW.y);                               // grime near the street
          } else base*=.94+.08*hash(floor(vW.xz*.7));
        } else if(k==4){
          base=vec3(.022,.026,.04);
          if(wall){
            vec2 g=vec2(u/1.45,(vW.y-.5)/3.2), id=floor(g), f=fract(g);   // rows break inside the sills
            float frame=step(f.x,.05)+step(.96,f.y)+step(f.y,.04);
            vec3 V=normalize(vW-uCam), R=reflect(V,vN);
            float fr=.18+.82*pow(1.-abs(dot(V,vN)),3.);
            add=skyColor(normalize(vec3(R.x,max(R.y,.015),R.z)))*.5*fr;
            float h=hash(id+floor(dep*.25)*5.1), thr=mix(.985,.5,uLights);
            if(h>thr){
              em=(h>.95?vec3(.3,.85,1.):h>.9?vec3(1.,.42,.55):vec3(1.,.6,.27))*(.5+.6*hash(id.yx+3.))*(.3+.7*uLights);
              em*=.65+.35*f.y; add*=.3;
            }
            if(frame>.5){ base=vec3(.05,.05,.06); em=vec3(0.); add*=.2; }
          }
        } else if(k==2){
          base=mix(vec3(.06,.20,.11),uFol,step(.3,vC.r))*(.6+.6*fract(vC.r*7.));
          add=uSunCol*base*1.4*pow(max(dot(normalize(vW-uCam),uSun),0.),6.);  // backlit leaves
        }
        if((k<3||k==5)&&vN.y>.5) base=mix(base,vec3(.86,.89,.96),uSnow*(k==2?.75:.6));
        base*=1.-.35*uWet;
        vec3 c;
        if(k==3){ c=vC*(.35+1.9*uNeon); }
        else if(k==6){ c=vC*(.22+1.5*uLights); }
        else{
          float ndl=max(dot(vN,uLDir),0.);
          float back=max(-dot(vN.xz,normalize(uLDir.xz+1e-4)),0.);
          vec3 amb=uAmb+uAmbUp*max(vN.y,0.)+vec3(-.03,.05,.07)*back*(1.-uLights*.5);
          c=base*(amb+uSunCol*ndl)+em+add;
          if(uHoloI>0.){ vec3 hv=uHoloP-vW; float hd2=dot(hv,hv);           // magenta spill from the hologram
            c+=base*vec3(.95,.3,1.)*uHoloI*max(dot(vN,hv*inversesqrt(hd2+1e-4)),0.)/(1.+hd2/2200.); }
          if(vN.y>.5) c=mix(c,fogc(vW)*.5,uWet*.22);                   // puddle sheen
        }
        gl_FragColor=vec4(fog(c,vW),1.);
      }`,
  });
}

// Transparent glazing (La Serre): sky reflection with fresnel, a warm glow from inside at night.
export function createGlassMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */`
      varying vec3 vW,vN,vC; varying float vK;` + GLSL_COMMON + `
      void main(){
        vec3 V=normalize(vW-uCam), N=vN; if(dot(N,V)>0.) N=-N;
        vec3 R=reflect(V,N);
        float fr=pow(1.-abs(dot(V,N)),3.);
        vec3 c=skyColor(normalize(vec3(R.x,abs(R.y)+.02,R.z)))*(.25+.6*fr)+vC*(.06+.55*uLights);
        gl_FragColor=vec4(fog(c,vW),.18+.55*fr);
      }`,
  });
}

// Camera-facing or wall signs: canvas texture, fogged, glowing with the neon amount.
export function createSignMaterial(U, map) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({ uMap: { value: map } }, U),
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vW;
      void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vW; uniform sampler2D uMap;` + GLSL_COMMON + `
      void main(){ vec4 t=texture2D(uMap,vUv); vec3 c=t.rgb*(.45+1.7*uNeon);
        gl_FragColor=vec4(fog(c,vW),t.a); }`,
  });
}

export function createShade(g) {
  const U = createUniforms();
  const api = {
    name: "shade", uniforms: U,
    init() { api.world = createWorldMaterial(U); api.glass = createGlassMaterial(U); },
    update() {},
    // runs after everything moved this frame
    late(dt, t) {
      const tm = g.env.time, p = tm.p, w = g.env.weather.state, st = g.player.state;
      U.uTime.value = t;
      U.uSun.value.copy(tm.sunDir); U.uLDir.value.copy(tm.lightDir);
      U.uSunCol.value.copy(p.sunCol); U.uAmb.value.copy(p.amb); U.uAmbUp.value.copy(p.ambUp);
      U.uFogNear.value.copy(p.fogNear); U.uFogFar.value.copy(p.fogFar);
      U.uSkyTop.value.copy(p.skyTop); U.uSkyMid.value.copy(p.skyMid); U.uSkyHor.value.copy(p.skyHor);
      U.uFogDen.value = p.fogDen * w.fogMul;
      U.uLights.value = p.lights; U.uNeon.value = p.neon; U.uSunGlow.value = p.glow; U.uDisc.value = p.disc;
      U.uStars.value = p.stars * w.starMul;
      U.uSnow.value = w.snow; U.uWet.value = w.wet;
      U.uFol.value.set(w.foliage[0], w.foliage[1], w.foliage[2]);
      U.uCut.value = g.level && (g.level.id === "roof" || g.level.id === "serre") ? 0 : 1; // --- serre ---   // the roof's furniture is thin: the camera boom keeps real walls out of the way
      U.uCam.value.copy(g.camera.position);
      U.uPl.value.set(st.pos.x, st.pos.y + 0.2, st.pos.z);
    },
    dispose() { if (api.world) api.world.dispose(); if (api.glass) api.glass.dispose(); },
  };
  return api;
}
