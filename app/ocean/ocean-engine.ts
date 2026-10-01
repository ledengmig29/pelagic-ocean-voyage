import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createOceanMaterial, sampleOceanHeight } from "./ocean-shaders";
import { createBottle } from "./ocean-models";
import { createTallShip } from "./tall-ship";
import { createBottleWater } from "./bottle-water";
import { BOTTLE_WATER_LEVEL } from "./bottle-profile";
import { applyShipBuoyancy } from "./ship-buoyancy";
import { createShipEntry } from "./ship-entry";
import { getOceanTransition } from "./ocean-transition";
import { createOceanRain, createRainClock } from "./ocean-rain";
import { SHIP_STORM_WAVE_SCALE, SHIP_BOTTLE_WAVE_SCALE, SHIP_CLOSE_YAW, SHIP_BOTTLE_YAW } from "./ship-motion";

export type OceanScene = {
  render: (time: number, progress: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

export const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const skyVertex = `varying vec3 vDirection;
void main(){ vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const skyFragment = `
uniform float uTime,uStorm,uReveal,uFlash; uniform vec3 uSunDirection;
varying vec3 vDirection;
float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.17,.13));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=noise(p)*a;p=p*2.03+vec3(3.2,7.1,2.8);a*=.5;}return v;}
void main(){
 vec3 d=normalize(vDirection); float h=max(d.y,0.); float sun=pow(max(dot(d,uSunDirection),0.),1400.);
 vec3 calm=mix(vec3(.44,.55,.60),vec3(.025,.095,.165),pow(h,.43));
 float glow=pow(max(dot(d,uSunDirection),0.),16.); calm+=vec3(.5,.31,.13)*glow;
 vec3 storm=mix(vec3(.19,.24,.29),vec3(.025,.054,.095),pow(h,.42));
 vec3 color=mix(calm,storm,uStorm);
 vec3 p=d*5.0+vec3(uTime*.005,0.,uTime*.003); float clouds=fbm(p*2.1);
 float mask=smoothstep(mix(.56,.37,uStorm),.76,clouds)*smoothstep(-.02,.12,d.y);
 vec3 cloudColor=mix(vec3(.48,.57,.61),vec3(.045,.067,.09),uStorm);
 color=mix(color,cloudColor,mask*.88);
 color+=vec3(4.5,3.6,2.3)*sun*(1.-uStorm*.99);
 color+=vec3(.5,.66,.85)*uFlash;
 color=mix(color,vec3(.018,.042,.061),uReveal);
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

function seeded(index: number) {
  return THREE.MathUtils.euclideanModulo(Math.sin(index * 127.1 + 311.7) * 43758.5453, 1);
}

function createLightning() {
  const positions:number[]=[];
  let previous=new THREE.Vector3(-36,105,-115);
  for(let i=1;i<18;i++){
    const next=new THREE.Vector3(-36+(seeded(i+410)-.5)*12,105-i*5.2,-115+(seeded(i+710)-.5)*9);
    positions.push(...previous.toArray(),...next.toArray());
    if(i===6||i===11){
      let branch=next.clone();
      for(let j=1;j<5;j++){
        const end=branch.clone().add(new THREE.Vector3(3+seeded(j+i)*4,-5.3,1.1));
        positions.push(...branch.toArray(),...end.toArray());branch=end;
      }
    }
    previous=next;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  return new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xc5e3ff,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
}

/** One seekable scene shared by the scrolling page, Remotion and HyperFrames. */
export function createOceanScene(container:HTMLElement,options:{quality?:"high"|"balanced";onReady?:()=>void;reducedMotion?:boolean;interactive?:boolean}={}):OceanScene {
  let width=Math.max(container.clientWidth,1),height=Math.max(container.clientHeight,1);
  const quality=options.quality??"high";
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==="high"?1.65:1.15));
  renderer.setSize(width,height);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.domElement.setAttribute("aria-label","三维海洋：宁静海面、白色三桅帆船风暴和瓶中世界");
  container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color("#071b28");
  const camera=new THREE.PerspectiveCamera(49,width/height,.5,6000);
  const sunDirection=new THREE.Vector3(.52,.13,-.84).normalize();
  const skyMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uStorm:{value:0},uReveal:{value:0},uFlash:{value:0},uSunDirection:{value:sunDirection}},
    vertexShader:skyVertex,fragmentShader:skyFragment,side:THREE.BackSide,depthWrite:false
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(2800,40,24),skyMaterial);
  scene.add(sky);
  const cubeTarget=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const cubeCamera=new THREE.CubeCamera(1,6000,cubeTarget);
  cubeCamera.update(renderer,scene);
  const stormCubeTarget=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const stormCubeCamera=new THREE.CubeCamera(1,6000,stormCubeTarget);
  skyMaterial.uniforms.uStorm.value=1;stormCubeCamera.update(renderer,scene);
  skyMaterial.uniforms.uStorm.value=0;
  scene.environment=cubeTarget.texture;

  // 4000 × 4000 / 512²; concentrate vertices near the camera instead of undersampling short waves.
  const segments=quality==="high"?512:320;
  const waterGeometry=new THREE.PlaneGeometry(4000,4000,segments,segments);
  waterGeometry.rotateX(-Math.PI/2);
  const pos=waterGeometry.attributes.position;
  const density=110,spread=Math.asinh(2000/density);
  for(let i=0;i<pos.count;i++){
    pos.setX(i,density*Math.sinh(pos.getX(i)/2000*spread));
    pos.setZ(i,density*Math.sinh(pos.getZ(i)/2000*spread));
  }
  const oceanMaterial=createOceanMaterial(cubeTarget.texture);
  oceanMaterial.uniforms.uSkyStormCube.value=stormCubeTarget.texture;
  oceanMaterial.uniforms.uSunDirection.value.copy(sunDirection);
  const ocean=new THREE.Mesh(waterGeometry,oceanMaterial);
  ocean.frustumCulled=false;
  // While fading, exterior water is in front of the submerged liquid shell.
  // Composite it after shell (4) / meniscus (5); the opaque interior keeps depth.
  ocean.renderOrder=6;
  scene.add(ocean);
  // Reuse the original triangles around the bottle, including a margin for
  // horizontal Gerstner displacement. Identical vertices prevent a seam when
  // the two complementary shader regions still form one continuous ocean.
  const interiorGeometry=new THREE.BufferGeometry();
  interiorGeometry.setAttribute("position",pos);
  const interiorIndices:number[]=[];
  const oceanIndices=waterGeometry.index!;
  for(let i=0;i<oceanIndices.count;i+=3){
    const a=oceanIndices.getX(i),b=oceanIndices.getX(i+1),c=oceanIndices.getX(i+2);
    const minX=Math.min(pos.getX(a),pos.getX(b),pos.getX(c));
    const maxX=Math.max(pos.getX(a),pos.getX(b),pos.getX(c));
    const minZ=Math.min(pos.getZ(a),pos.getZ(b),pos.getZ(c));
    const maxZ=Math.max(pos.getZ(a),pos.getZ(b),pos.getZ(c));
    if(maxX>=-64&&minX<=80&&maxZ>=-40&&minZ<=40)interiorIndices.push(a,b,c);
  }
  interiorGeometry.setIndex(interiorIndices);
  const interiorMaterial=createOceanMaterial(cubeTarget.texture);
  // Every changing uniform is deliberately shared, so reflection, foam,
  // buoyancy and hull exclusion cannot drift between the two surfaces.
  interiorMaterial.uniforms={...oceanMaterial.uniforms,uOceanRegion:{value:1}};
  const interiorOcean=new THREE.Mesh(interiorGeometry,interiorMaterial);
  interiorOcean.frustumCulled=false;
  scene.add(interiorOcean);
  const oceanVolume=createBottleWater();scene.add(oceanVolume.group);
  const ship=createTallShip();scene.add(ship.group);
  const placeShip=createShipEntry(ship.group);
  const bottle=createBottle(cubeTarget.texture);scene.add(bottle.group);
  const rain=createOceanRain();scene.add(rain.object);
  const rainClock=createRainClock(options.interactive??false);
  const lightning=createLightning();scene.add(lightning);
  const ambient=new THREE.HemisphereLight(0xc7deec,0x202321,2.2);scene.add(ambient);
  const sunLight=new THREE.DirectionalLight(0xffefdc,3.3);sunLight.position.set(-70,85,10);scene.add(sunLight);
  sunLight.castShadow=true;
  sunLight.shadow.mapSize.setScalar(quality==="high"?2048:1024);
  Object.assign(sunLight.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:180});
  sunLight.shadow.normalBias=.09;
  sunLight.shadow.bias=-.0002;
  sunLight.target.position.set(0,9,0);scene.add(sunLight.target);
  const rimLight=new THREE.DirectionalLight(0xabcde7,2.2);rimLight.position.set(10,40,-75);scene.add(rimLight);
  const flashLight=new THREE.PointLight(0xcceaff,0,500);flashLight.position.set(-25,80,-85);scene.add(flashLight);

  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(width,height),.20,.55,.9);composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let disposed=false;
  const look=new THREE.Vector3();

  function render(time:number,progress:number){
    if(disposed)return;
    const p=Number.isFinite(progress)?THREE.MathUtils.clamp(progress,0,1):0;
    const transition=getOceanTransition(p);
    const storm=smooth(.25,.41,p)*(1-.72*transition.stormRelease);
    const reveal=transition.backdropReveal;
    const enter=smooth(.235,.395,p);
    const close=smooth(.18,.40,p);
    const cycle=THREE.MathUtils.euclideanModulo(time,10.7);
    const pulse=Math.exp(-Math.pow((cycle-3.15)*22,2))+.65*Math.exp(-Math.pow((cycle-3.44)*26,2));
    const flash=options.reducedMotion?0:pulse*storm*(1-reveal);
    skyMaterial.uniforms.uTime.value=time;
    skyMaterial.uniforms.uStorm.value=storm;
    skyMaterial.uniforms.uReveal.value=reveal;
    skyMaterial.uniforms.uFlash.value=flash;
    oceanMaterial.uniforms.uTime.value=time;
    oceanMaterial.uniforms.uStorm.value=storm;
    oceanMaterial.uniforms.uReveal.value=reveal;
    oceanMaterial.uniforms.uFlash.value=flash;
    const seaLevel=BOTTLE_WATER_LEVEL*transition.seaLevelMix;
    const waveScale=THREE.MathUtils.lerp(THREE.MathUtils.lerp(1,SHIP_STORM_WAVE_SCALE,enter),SHIP_BOTTLE_WAVE_SCALE,transition.waveDamping);
    oceanMaterial.uniforms.uSeaLevel.value=seaLevel;
    oceanMaterial.uniforms.uWaveScale.value=waveScale;
    oceanMaterial.uniforms.uOuterOceanOpacity.value=transition.outerOceanOpacity;
    ocean.visible=transition.outerOceanOpacity>0;
    oceanMaterial.transparent=transition.outerOceanOpacity<1;
    oceanMaterial.depthWrite=transition.outerOceanOpacity===1;
    const waterHeight=(x:number,z:number)=>seaLevel+waveScale*sampleOceanHeight(x,z,time,storm);
    oceanVolume.update(time,transition.volumeReveal,waterHeight,transition.bottleReveal);
    bottle.setReveal(transition.bottleReveal);
    lightning.material.opacity=flash;
    lightning.visible=flash>0.001;
    flashLight.intensity=flash*280;
    ambient.intensity=THREE.MathUtils.lerp(2.2,.95,storm)+reveal*.05+flash*1.5;
    sunLight.intensity=THREE.MathUtils.lerp(3.3,.55,storm);
    rimLight.intensity=1.8+storm*.8+reveal*.15;
    const wide=width/height<.8;
    camera.fov=THREE.MathUtils.lerp(49,wide?52:36,transition.framing);
    const pull=transition.cameraPullback,remain=1-pull;
    const curve=(a:number,b:number,c:number,d:number)=>remain*remain*remain*a+3*remain*remain*pull*b+3*remain*pull*pull*c+pull*pull*pull*d;
    camera.position.set(
      curve(THREE.MathUtils.lerp(0,24,close),45,92,wide?160:166),
      curve(THREE.MathUtils.lerp(12,18,close),34,56,wide?70:78),
      curve(THREE.MathUtils.lerp(83,88,close),135,202,wide?270:269)
    );
    look.set(THREE.MathUtils.lerp(-22,wide?0:-4,close),THREE.MathUtils.lerp(3,10,close),THREE.MathUtils.lerp(-150,0,close));
    // Follow the rising sea and keep the ship centred during the pullback.
    // Only compose the bottle beside the title once the exterior has faded.
    look.y+=seaLevel;
    look.x=THREE.MathUtils.lerp(look.x,wide?4:-32,transition.framing);
    look.y=THREE.MathUtils.lerp(look.y,8,transition.framing);
    look.z=THREE.MathUtils.lerp(look.z,wide?0:15,transition.framing);
    camera.lookAt(look);camera.updateProjectionMatrix();
    // Frustum clipping reveals the advancing bow naturally; there is no
    // visibility switch that can expose a pre-existing slice of the ship.
    const yaw=THREE.MathUtils.lerp(SHIP_CLOSE_YAW,SHIP_BOTTLE_YAW,transition.cameraPullback);
    placeShip(camera,enter,yaw,ship.group.position);
    applyShipBuoyancy(ship.group,yaw,waterHeight);
    oceanMaterial.uniforms.uShipActive.value=1;
    oceanMaterial.uniforms.uShipInverse.value.copy(ship.group.matrixWorld).invert();
    ship.update(time,storm);
    const precipitationTime=options.reducedMotion?6:rainClock(time,p);
    rain.update(precipitationTime,storm*.29*(1-transition.stormRelease),camera);
    oceanMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    bloom.strength=.17+flash*.25;
    composer.render();
  }

  render(0,0);
  options.onReady?.();
  return {
    render,
    resize(w,h){
      if(disposed||w<1||h<1)return;
      width=w;height=h;
      camera.aspect=w/h;camera.updateProjectionMatrix();
      renderer.setSize(w,h);composer.setSize(w,h);
    },
    dispose(){
      if(disposed)return;disposed=true;
      ship.dispose();bottle.dispose();waterGeometry.dispose();oceanMaterial.dispose();
      interiorGeometry.dispose();interiorMaterial.dispose();
      oceanVolume.dispose();
      sky.geometry.dispose();skyMaterial.dispose();rain.dispose();
      lightning.geometry.dispose();lightning.material.dispose();cubeTarget.dispose();stormCubeTarget.dispose();
      sunLight.shadow.dispose();composer.dispose();bloom.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    }
  };
}
