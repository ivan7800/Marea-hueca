import {cachePosition, wardCovers} from './settlements.js';
import {SITES, sitePosition, nearbyLanterns} from './expeditions.js';
import {trace} from './systems.js';
import * as T from '../vendor/three.module.min.js';
import {atlas,meshChunk} from './mesh.js';
import {BLOCKS, BIOMES, CHUNK, HALF, biomeAt, LANDMARKS, clamp, landmarkPosition, randomAt, surface} from './world.js';

export const V = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
const unitBox=new T.BoxGeometry(1,1,1);
const wrapNear=(coordinate,center,span)=>coordinate-Math.floor((coordinate-center)/span+.5)*span;
const ATMOSPHERE=[
  {air:.023,dust:'#ded7aa',light:'#fff3d5',shade:'#e5f1de',rise:.21},
  {air:.029,dust:'#9cb4ec',light:'#d0dcff',shade:'#c7d5fa',rise:-.09},
  {air:.032,dust:'#f0bbcc',light:'#ffe9d3',shade:'#ffe3e5',rise:.34},
  {air:.046,dust:'#9dd0d1',light:'#a9d8d2',shade:'#a9c2c5',rise:.12}
];
const mat=(color,emissive=0)=>new T.MeshStandardMaterial({color,roughness:.86,emissive,emissiveIntensity:.55});
const rock=mat('#526c65'), metal=mat('#343c45'), bone=mat('#9c9087'), fur=mat('#434450');
const pearl=mat('#aff6d9','#498f8c'), iris=mat('#d994a8','#a64661');

function box(parent,material,x,y,z,sx,sy,sz) {
  const part=new T.Mesh(unitBox,material);
  part.position.set(x,y,z);part.scale.set(sx,sy,sz);parent.add(part);
  return part;
}

function halo(radius,color) {
  const mesh=new T.Mesh(new T.TorusGeometry(radius,.026,6,46),new T.MeshBasicMaterial({color,transparent:true,opacity:.8}));
  mesh.userData.ownedMaterial=true;
  return mesh;
}

function platform(scene,world,p) {
  const [x,y,z]=landmarkPosition(world,p), group=new T.Group();
  group.position.set(x,y,z); scene.add(group);
  const r=p.id==='vault'?2.25:1.62;
  const tone=mat(p.color,p.color);
  const frame=halo(r,p.color);
  frame.position.y=r+.55; group.add(frame);
  const inner=halo(r*.73,p.color);
  inner.position.y=r+.55; inner.rotation.y=.21;group.add(inner);
  const eye=new T.Mesh(new T.OctahedronGeometry(.49,0),tone);
  eye.userData.ownedMaterial=true;eye.position.y=r+.6; group.add(eye);
  box(group,metal,0,.16,0,1.53,.32,1.26);
  box(group,tone,0,.34,0,.61,.1,.67);
  for(let i=0;i<7;i++) {
    const a=(i/6)*Math.PI, b=box(group,i%2?rock:bone,Math.cos(a)*(r+.23),.52+Math.sin(a)*(r+.66),0,.27,.64,.54);
    b.rotation.z=a-Math.PI*.5;
  }
  box(group,bone,-r,.68,0,.44,1.32,.58);
  box(group,bone,r,.68,0,.44,1.32,.58);
  const floor=halo(1.68,p.color);
  floor.rotation.x=-Math.PI/2;floor.position.y=.04;group.add(floor);
  return {...p,group,eye,inner};
}

function expeditionModel(parent,world,site) {
  const group=new T.Group();
  group.position.set(...sitePosition(world,site));parent.add(group);
  if(site.id==='spire') {
    group.scale.setScalar(.76);
    const stone=mat('#586577','#202c42'), edge=mat('#b9c9ee','#455a7e');
    stone.userData.ownedMaterial=edge.userData.ownedMaterial=true;
    for(let i=0;i<7;i++) {
      const angle=i*Math.PI*2/7,r=1.8+(i%2)*.45,height=2.3+(i%4)*.9;
      const fin=box(group,i%2?stone:edge,Math.cos(angle)*r,height*.5,Math.sin(angle)*r,.24,height,.62);
      fin.rotation.y=-angle;fin.rotation.z=Math.sin(angle)*.16;
    }
    for(let i=0;i<3;i++) {
      const ring=halo(.55+i*.48,'#abc3ef');
      ring.position.y=1.1+i*.7;ring.rotation.set(.25+i*.4,.3+i*.55,.15+i*.3);group.add(ring);
    }
    const lens=new T.Mesh(new T.OctahedronGeometry(.52,0),edge);
    lens.position.y=3.4;group.add(lens);
    return;
  }
  if(site.id==='orchard') {
    group.scale.setScalar(.72);
    const shell=mat('#87616a','#4b3039'), pearlwood=mat('#c4a9a5','#655355'), sproutMat=mat('#b5d8ae','#54784a');
    shell.userData.ownedMaterial=pearlwood.userData.ownedMaterial=sproutMat.userData.ownedMaterial=true;
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4,r=1.15+(i%2)*.45;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      const cup=new T.Mesh(new T.SphereGeometry(.48,5,3,0,Math.PI*2,0,Math.PI*.62),i%2?shell:pearlwood);
      cup.position.set(x,.28,z);cup.rotation.z=(i%2?-.38:.38);group.add(cup);
      const sprout=box(group,sproutMat,x*.74,.78,z*.74,.12,.72,.12);
      sprout.rotation.z=Math.sin(a)*.25;
    }
    box(group,pearl,.0,.25,.0,.5,.5,.5);
    const crown=halo(1.45,'#e7c2d0');crown.position.y=.8;group.add(crown);
    return;
  }
  if(site.id==='witness') {
    const shell=mat('#7b9696','#294e52');
    const seam=mat('#d8a6a8','#685056');
    shell.userData.ownedMaterial=seam.userData.ownedMaterial=true;
    // Una estructura hueca y suspendida. La forma se lee desde el sendero sin cerrar la entrada.
    for(let i=0;i<9;i++) {
      const angle=i*Math.PI*2/9;
      const x=Math.cos(angle)*3.25,z=Math.sin(angle)*2.85;
      const rib=box(group,i%3===0?seam:shell,x,2.15,z,.24,3.9,.3);
      rib.rotation.z=-Math.sin(angle)*.28;
      rib.rotation.x=Math.cos(angle)*.2;
      const tip=box(group,shell,x*.83,4.3,z*.83,.33,1.2,.4);
      tip.rotation.z=Math.sin(angle)*.35;
    }
    for(let i=0;i<3;i++) {
      const arc=halo(1.3+i*.52,'#b7d6ce');
      arc.position.set(0,3.7,0);
      arc.rotation.set(.4+i*.37,.2+i*.51,.26+i*.41);
      group.add(arc);
    }
    const core=new T.Mesh(new T.IcosahedronGeometry(.48,0),seam);
    core.position.y=3.7;core.scale.set(1,.63,.8);group.add(core);
    return;
  }
  const accent=mat(site.color,site.color);
  const marker=new T.Mesh(new T.OctahedronGeometry(.28),accent);
  marker.userData.ownedMaterial=true;marker.position.y=1.25;group.add(marker);
  box(group,bone,0,.15,0,.65,.3,.65);
  for(let i=0;i<9;i++) {
    const angle=i*Math.PI*2/9;
    const ring=site.id!=='rib';
    const x=ring?Math.cos(angle)*2.4:(i-4)*.52;
    const z=ring?Math.sin(angle)*2.4:Math.cos(i*.65)*.9;
    const height=site.id==='pool'?.3+(i%3)*.28:1+(i%5)*.34;
    const post=box(group,i%2?bone:rock,x,height/2,z,.25,height,.42);
    post.rotation.z=ring?Math.cos(angle)*.25:Math.sin(i*.6)*.4;
  }
  const rim=halo(site.id==='pool'?2.1:1.1,site.color);
  rim.rotation.x=-Math.PI/2;rim.position.y=.34;group.add(rim);
}

function observatory(scene,world) {
  const g=new T.Group();
  g.position.set(-.5,surface(world,0,-7),-7.45);
  scene.add(g);
  for(let i=0;i<7;i++) {
    const a=i*Math.PI/6, b=box(g,i%2?metal:rock,Math.cos(a)*3.35,1.3+Math.sin(a)*3.04,0,.63,1.08,.56);
    b.rotation.z=a-Math.PI/2;
  }
  const ring=halo(.94,'#c5fce1');
  ring.position.set(0,4.13,.27);g.add(ring);
  const eye=new T.Mesh(new T.OctahedronGeometry(.29),pearl);
  eye.position.copy(ring.position);g.add(eye);
  for(let i=-1;i<=1;i++) box(g,pearl,i*.45,3.58,.36,.14,.05,.14);
  return eye;
}

function spawnMobs(scene,world) {
  const spots=[['limen',-7,1],['limen',9,-8],['limen',32,6],['limen',6,15],
    ['rasp',-25,-2],['rasp',-34,-12],['rasp',34,-12],['rasp',-30,12]];
  return spots.map(([kind,x,z],i)=>{
    const g=new T.Group();
    scene.add(g);
    const passive=kind==='limen';
    const torso=new T.Group();g.add(torso);
    const body=new T.Mesh(new T.OctahedronGeometry(passive?.46:.65),passive?bone:fur);
    body.scale.set(passive?1.2:1,passive?.58:1.15,passive?1.6:1.27);
    body.position.y=passive?.62:.9;torso.add(body);
    box(torso,passive?pearl:iris,0,body.position.y,.45,.44,.14,.3);
    if(!passive) {
      for(const side of [-1,1]) {
        const spine=box(torso,bone,side*.27,1.19,-.16,.12,.61,.16);
        spine.rotation.z=side*-.39;
      }
    }
    const legs=[];
    for(const side of [-1,1]) for(let l=0;l<3;l++) {
      const p=box(g,passive?rock:bone,side*(passive?.44:.46),.31,(l-1)*.34,.11,passive?.64:.78,.116);
      p.rotation.z=side*(passive?.55:.38);
      legs.push(p);
    }
    return {kind,g,torso,legs,homeX:x,homeZ:z,x,z,y:surface(world,x,z),phase:i*1.7,cool:0,flee:0,noticed:false};
  });
}

function groundNear(world,x,y,z) {
  for(let dy=1;dy>=-2;dy--) {
    const ny=Math.floor(y)+dy,a=Math.floor(x),b=Math.floor(z);
    if(world.get(a,ny-1,b) && !world.get(a,ny,b) && !world.get(a,ny+1,b)) return ny;
  }
  return null;
}

export class View {
  constructor(host) {
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('webgl2',{antialias:false,powerPreference:'high-performance'});
    if(!context) throw new Error('WebGL 2 no está disponible.');
    this.renderer=new T.WebGLRenderer({canvas,context,antialias:false,powerPreference:'high-performance'});
    this.renderer.domElement.id='world';
    this.renderer.domElement.setAttribute('aria-label','Vista en primera persona');
    host.append(this.renderer.domElement);
    this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.scene=new T.Scene();
    this.scene.background=new T.Color('#364640');
    this.scene.fog=new T.FogExp2('#3d5048',.027);
    const uniforms={
      horizon:{value:new T.Color('#455b4e')},
      zenith:{value:new T.Color('#17222c')},
      lunar:{value:new T.Color('#b9d7be')},
      direction:{value:V(-13,16.4,-76).normalize()},
      drift:{value:0}
    };
    this.sky=new T.Mesh(new T.SphereGeometry(91,20,12),new T.ShaderMaterial({
      uniforms,side:T.BackSide,depthWrite:false,
      vertexShader:`
        varying vec3 ray;
        void main(){
          ray = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
        }`,
      fragmentShader:`
        varying vec3 ray;
        uniform vec3 horizon;
        uniform vec3 zenith;
        uniform vec3 lunar;
        uniform vec3 direction;
        uniform float drift;
        void main(){
          vec3 d=normalize(ray);
          float up=clamp(d.y,0.,1.);
          vec3 color=mix(horizon,zenith,smoothstep(.01,.70,up));
          float moon=max(dot(direction,d),0.);
          color+=lunar*pow(moon,35.)*.11;
          float band=sin(d.x*18. + d.z*12. + up*32. + drift);
          color+=lunar*(smoothstep(.87,.98,band)-.5)*.025*(1.-up);
          gl_FragColor=vec4(color,1.);
          #include <colorspace_fragment>
        }`
    }));
    this.sky.renderOrder=-2;this.scene.add(this.sky);
    this.camera=new T.PerspectiveCamera(71,1,.045,100);
    this.camera.rotation.order='YXZ';
    this.fill=new T.HemisphereLight('#d6f9eb','#634d62',2.15);
    this.keyLight=new T.DirectionalLight('#fff0d3',1.45);
    this.keyLight.position.set(-30,46,15);
    this.scene.add(this.fill,this.keyLight);
    this.white=new T.Color();
    this.terrainShade=new T.Color();
    this.targetShade=new T.Color();
    this.targetLight=new T.Color();
    this.targetDust=new T.Color();
    const tex=new T.CanvasTexture(atlas());
    tex.colorSpace=T.SRGBColorSpace;tex.magFilter=T.NearestFilter;tex.minFilter=T.NearestFilter;
    tex.generateMipmaps=false;
    this.material=new T.MeshBasicMaterial({map:tex,vertexColors:true});
    this.lanterns=Array.from({length:4},()=>new T.Vector4(0,0,0,0));
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.mareaLanterns={value:this.lanterns};
      shader.uniforms.mareaShade={value:this.terrainShade};
      shader.vertexShader='varying vec3 mareaPosition;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>','#include <begin_vertex>\nmareaPosition = position;');
      shader.fragmentShader='varying vec3 mareaPosition;\nuniform vec4 mareaLanterns[4];\nuniform vec3 mareaShade;\n'+
        shader.fragmentShader.replace('#include <color_fragment>',`
          #include <color_fragment>
          diffuseColor.rgb *= mareaShade;
          vec3 lanternGlow = vec3(0.);
          if(mareaLanterns[0].w > 0.) for(int i=0;i<4;i++){
            vec3 offset = mareaPosition - mareaLanterns[i].xyz;
            float glow = max(0.,1. - dot(offset,offset) * .0625);
            lanternGlow += glow * glow * mareaLanterns[i].w * vec3(.91,.76,.49);
          }
          diffuseColor.rgb += min(lanternGlow,vec3(.6)) * (.24 + diffuseColor.rgb * .34);
        `);
    };
    this.hover=new T.LineSegments(new T.EdgesGeometry(unitBox),new T.LineBasicMaterial({color:'#d3ffe6',transparent:true,opacity:.84}));
    this.hover.scale.setScalar(1.008);
    this.scene.add(this.hover);
    this.targetSky=new T.Color();
    this.targetFog=new T.Color();
    this.chunkGroup=new T.Group();this.scene.add(this.chunkGroup);
    this.decor=new T.Group();this.scene.add(this.decor);
    this.wardRing=halo(4.5,'#ffe5a3');
    this.wardRing.rotation.x=-Math.PI/2;
    this.wardRing.visible=false;
    this.scene.add(this.wardRing);
    this.meshes=new Map();this.queue=[];
    this.dustHeight=0;
    this.dustRise=0;
    this.dustOffsets=[];
    for(let i=0;i<36;i++) this.dustOffsets.push(V(
      randomAt(42,i,4)*20,randomAt(42,i,5)*10,randomAt(42,i,6)*20));
    const dustGeometry=new T.BufferGeometry();
    this.dustPosition=new T.BufferAttribute(new Float32Array(this.dustOffsets.length*3),3);
    this.dustPosition.setUsage(T.DynamicDrawUsage);
    dustGeometry.setAttribute('position',this.dustPosition);
    this.dust=new T.Points(dustGeometry,new T.PointsMaterial({
      color:'#b5ddc0',size:.027,transparent:true,opacity:.31,depthWrite:false
    }));
    this.dust.frustumCulled=false;
    this.scene.add(this.dust);
    this.parts=[];
    this.partMaterial=new T.MeshBasicMaterial({color:'#c8d0ad',fog:true});
    for(let i=0;i<16;i++) {
      const mesh=new T.Mesh(unitBox,this.partMaterial);
      mesh.scale.setScalar(.06);
      mesh.visible=false;this.scene.add(mesh);
      this.parts.push({mesh,t:0,v:V()});
    }
  }

  resize(settings) {
    const w=innerWidth,h=innerHeight;
    const limit=settings.resolution==='low'?.58:settings.resolution==='high'?1.35:(w*h>1_450_000?.87:1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,limit));
    this.renderer.setSize(w,h);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  }

  start(world) {
    this.world=world;
    this.terrainShade.set('#eaf3eb');
    this.dustHeight=0;this.dustRise=0;
    this.decor.traverse(object=>{
      if(object.geometry && object.geometry!==unitBox) object.geometry.dispose();
      if(object.userData.ownedMaterial) object.material.dispose();
    });
    this.decor.clear();
    for(const mesh of this.meshes.values()) mesh.geometry.dispose();
    this.meshes.clear();this.chunkGroup.clear();this.queue=[];
    for(const part of this.parts) part.t=0;
    this.landmarks=LANDMARKS.map(p=>platform(this.decor,world,p));
    this.eye=observatory(this.decor,world);
    for(const site of SITES) expeditionModel(this.decor,world,site);
    for(const site of world.settlements) {
      const [x,y,z]=cachePosition(site);
      const marker=new T.Mesh(new T.OctahedronGeometry(.21),pearl);
      marker.position.set(x,y+.67,z);
      this.decor.add(marker);
    }
    this.buildLandscape(world);
    this.lightClock=0;
    this.mobs=spawnMobs(this.decor,world);

    const moon=new T.Mesh(new T.IcosahedronGeometry(6,2),new T.MeshBasicMaterial({color:'#b2c8b4',fog:false}));
    moon.userData.ownedMaterial=true;moon.position.set(-13,33,-69);this.decor.add(moon);
    const line=new T.Mesh(new T.TorusGeometry(8.7,.045,4,60),new T.MeshBasicMaterial({color:'#b6c8bd',fog:false,transparent:true,opacity:.66}));
    line.userData.ownedMaterial=true;line.position.copy(moon.position);line.rotation.set(.25,.1,.61);this.decor.add(line);
    this.moon=moon;
    this.moonArc=line;
    const satellite=new T.Mesh(new T.IcosahedronGeometry(2.15,1),new T.MeshBasicMaterial({
      color:'#b6a8ce',fog:false,transparent:true,opacity:.78
    }));
    satellite.userData.ownedMaterial=true;
    satellite.position.set(29,22,-84);
    this.decor.add(satellite);
    this.satellite=satellite;
    const arc=new T.Mesh(new T.TorusGeometry(12.2,.065,5,96),new T.MeshBasicMaterial({
      color:'#94cfc6',fog:false,transparent:true,opacity:.29
    }));
    arc.userData.ownedMaterial=true;
    arc.position.set(4,15,-78);
    arc.rotation.set(.28,.16,-.19);
    this.decor.add(arc);
    this.farArc=arc;
    const points=[];
    for(let i=0;i<154;i++) {
      const a=randomAt(world.number,i,273)*Math.PI*2,y=randomAt(world.number,i,274)*50+27;
      points.push(Math.cos(a)*88,y,Math.sin(a)*88);
    }
    const stars=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points,3));
    if(!this.starMat) this.starMat=new T.PointsMaterial({color:'#afc8c2',size:.12,fog:false,transparent:true,opacity:.44});
    this.decor.add(new T.Points(stars,this.starMat));
  }

  buildLandscape(world) {
    const palettes=['#d1b67c','#8eb6c5','#e5adc5'];
    this.plants=[];
    for(let biome=0;biome<3;biome++) {
      const data=[];
      for(let z=-HALF+3;z<HALF-3;z+=2) for(let x=-HALF+3;x<HALF-3;x+=2) {
        if(biomeAt(x,20,z)!==biome || Math.abs(z)<3) continue;
        if(randomAt(world.number+791,x,z)<(biome===0?.68:.79)) continue;
        if(world.settlements.some(site=>x>=site.x-2 && x<site.x+site.width+2 && z>=site.z-2 && z<site.z+site.depth+2)) continue;
        if(SITES.some(site=>Math.hypot(x-site.x,z-site.z)<(site.id==='witness'?6:3.5))) continue;
        const y=surface(world,x,z);
        if(y<9 || y>27 || !world.get(x,y-1,z)) continue;
        data.push({x,y,z,scale:.7+randomAt(world.number+94,x,z)*.6});
      }
      // Tres familias dibujadas con triángulos planos, sin materiales ni objetos por planta.
      const vertices=[];
      const triangle=(a,b,c)=>vertices.push(...a,...b,...c);
      if(biome===0) {
        for(let i=0;i<5;i++) {
          const a=i*2.4,dx=Math.cos(a),dz=Math.sin(a);
          const height=.95+(i%3)*.25;
          triangle([dx*.03,0,dz*.03],[dx*.17,height*.57,dz*.17],[dx*.27,height,dz*.27]);
          triangle([dx*.03,0,dz*.03],[dx*.27,height,dz*.27],[dx*.07,height*.56,dz*.07]);
        }
      } else if(biome===1) {
        for(let i=0;i<4;i++) {
          const a=i*Math.PI/2,dx=Math.cos(a),dz=Math.sin(a);
          triangle([0,0,0],[dx*.08,.45,dz*.08],[dx*.57,.76,dz*.57]);
          triangle([0,0,0],[dx*.57,.76,dz*.57],[dx*.32,1.2,dz*.32]);
          triangle([dx*.32,1.2,dz*.32],[dx*.57,.76,dz*.57],[dx*.49,1.36,dz*.49]);
        }
      } else {
        for(let i=0;i<6;i++) {
          const a=i*1.047,dx=Math.cos(a),dz=Math.sin(a);
          triangle([0,.03,0],[dx*.17,.22,dz*.17],[dx*.51,.39,dz*.51]);
          triangle([dx*.17,.22,dz*.17],[dx*.51,.39,dz*.51],[dx*.38,.88,dz*.38]);
        }
      }
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
      geometry.computeVertexNormals();
      const mesh=new T.InstancedMesh(geometry,
        new T.MeshStandardMaterial({color:palettes[biome],side:T.DoubleSide,roughness:.9,emissive:palettes[biome],emissiveIntensity:.08}),data.length);
      mesh.userData.ownedMaterial=true;
      const dummy=new T.Object3D();
      data.forEach((plant,i)=>{
        dummy.position.set(plant.x+.5,plant.y,plant.z+.5);
        dummy.rotation.y=randomAt(world.number+93,plant.x,plant.z)*6.28;
        dummy.scale.setScalar(plant.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;
      this.decor.add(mesh);this.plants.push({mesh,data});

      // Una variante poco común aporta otra lectura por bioma sin sembrar más plantas.
      const uncommon=data.filter(plant=>randomAt(world.number+97,plant.x,plant.z)>.78);
      if(uncommon.length) {
        const rare=[];
        const leaf=(a,b,c)=>rare.push(...a,...b,...c);
        if(biome===0) {
          for(let i=0;i<5;i++) {
            const a=i*Math.PI*2/5,dx=Math.cos(a),dz=Math.sin(a);
            leaf([0,0,0],[dx*.22,.22,dz*.22],[dx*.42,.52,dz*.42]);
            leaf([dx*.22,.22,dz*.22],[dx*.42,.52,dz*.42],[dx*.18,.58,dz*.18]);
          }
        } else if(biome===1) {
          for(let i=0;i<3;i++) {
            const a=i*Math.PI*2/3,dx=Math.cos(a),dz=Math.sin(a);
            leaf([0,0,0],[dx*.19,.38,dz*.19],[dx*.28,1.12,dz*.28]);
            leaf([0,0,0],[dx*.28,1.12,dz*.28],[dx*.07,1.22,dz*.07]);
          }
        } else {
          for(let i=0;i<4;i++) {
            const a=i*Math.PI/2,dx=Math.cos(a),dz=Math.sin(a);
            leaf([0,.02,0],[dx*.32,.12,dz*.32],[dx*.42,.45,dz*.42]);
            leaf([0,.02,0],[dx*.42,.45,dz*.42],[dx*.08,.6,dz*.08]);
          }
        }
        const rareGeometry=new T.BufferGeometry();
        rareGeometry.setAttribute('position',new T.Float32BufferAttribute(rare,3));
        rareGeometry.computeVertexNormals();
        const rareColors=['#9bb28a','#c3b8a1','#c4b0b9'];
        const rareMesh=new T.InstancedMesh(rareGeometry,new T.MeshStandardMaterial({color:rareColors[biome],side:T.DoubleSide,roughness:.92,emissive:rareColors[biome],emissiveIntensity:.045}),uncommon.length);
        rareMesh.userData.ownedMaterial=true;
        uncommon.forEach((plant,i)=>{
          dummy.position.set(plant.x+.5,plant.y,plant.z+.5);
          dummy.rotation.y=randomAt(world.number+98,plant.x,plant.z)*6.28;
          dummy.scale.setScalar(plant.scale);dummy.updateMatrix();rareMesh.setMatrixAt(i,dummy.matrix);
        });
        rareMesh.instanceMatrix.needsUpdate=true;rareMesh.frustumCulled=false;
        this.decor.add(rareMesh);this.plants.push({mesh:rareMesh,data:uncommon});
      }
    }
    const vertices=[];
    for(let side=0;side<4;side++) for(let n=-HALF;n<HALF;n+=3) {
      const x=side<2?(side?HALF+2:-HALF-2):n;
      const z=side>=2?(side===2?-HALF-2:HALF+2):n;
      const x2=side<2?x:n+3,z2=side>=2?z:n+3;
      const h=21+5*randomAt(world.number+112,n,side);
      vertices.push(x,8,z,x2,8,z2,x,h,z,x2,8,z2,x2,h,z2,x,h,z);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    const rim=new T.Mesh(geometry,new T.MeshBasicMaterial({color:'#34494d',side:T.DoubleSide,fog:true}));
    rim.userData.ownedMaterial=true;this.decor.add(rim);
  }

  updatePlants(x,z) {
    for(const {mesh,data} of this.plants) {
      const i=data.findIndex(p=>p.x===x && p.z===z);
      if(i<0) continue;
      const plant=data[i],dummy=new T.Object3D();
      const visible=surface(this.world,x,z)===plant.y && this.world.get(x,plant.y-1,z);
      dummy.position.set(x+.5,plant.y,z+.5);
      dummy.scale.setScalar(visible?plant.scale:0);
      dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.instanceMatrix.needsUpdate=true;
    }
  }

  rebuild(key) {
    const prev=this.meshes.get(key);
    if(prev) {this.chunkGroup.remove(prev);prev.geometry.dispose();}
    const [x,z]=key.split(',').map(Number);
    const {positions,uvs,colors}=meshChunk(this.world,x,z);
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    g.computeBoundingSphere();
    const mesh=new T.Mesh(g,this.material);
    this.meshes.set(key,mesh);this.chunkGroup.add(mesh);
  }

  stream(p,range) {
    const x=Math.floor(p.x/CHUNK),z=Math.floor(p.z/CHUNK);
    const wanted=[];
    for(let a=-HALF/CHUNK;a<HALF/CHUNK;a++) for(let b=-HALF/CHUNK;b<HALF/CHUNK;b++) {
      if(Math.max(Math.abs(a-x),Math.abs(b-z))<range) wanted.push([a+','+b,(a-x)**2+(b-z)**2]);
    }
    wanted.sort((a,b)=>a[1]-b[1]);
    const keys=new Set(wanted.map(([key])=>key));
    for(const [key,mesh] of this.meshes) if(!keys.has(key)) {
      mesh.geometry.dispose();this.meshes.delete(key);this.chunkGroup.remove(mesh);
    }
    this.queue=wanted.map(([key])=>key).filter(key=>!this.meshes.has(key));
  }

  process() {
    if(this.queue.length) this.rebuild(this.queue.shift());
  }

  change(keys) {
    for(const key of keys) if(this.meshes.has(key)) this.rebuild(key);
  }

  burst(cell,reduced,placing,id) {
    if(reduced) return;
    this.partMaterial.color.set(BLOCKS[id].light);
    for(let i=0;i<(placing?7:this.parts.length);i++) {
      const part=this.parts[i];
      part.t=.16+Math.random()*.22;
      part.mesh.scale.setScalar(placing?.045:.065);
      part.mesh.position.set(cell[0]+.5,cell[1]+.6,cell[2]+.5);
      const speed=placing?1.3:3;
      part.v.set((Math.random()-.5)*speed,Math.random()*speed,(Math.random()-.5)*speed);
    }
  }

  nearLandmark(p) {
    return this.landmarks.find(e=>Math.hypot(e.group.position.x-p.x,e.group.position.z-p.z,(e.group.position.y-p.y)*1.25)<3.15);
  }

  updateWard(ward,elapsed) {
    this.ward=ward;
    this.wardRing.visible=!!ward && elapsed<ward.until;
    if(this.wardRing.visible) this.wardRing.position.set(ward.x,ward.y+.06,ward.z);
  }

  scared(p,dir,reach=3,kind=null) {
    let hit=false;
    for(const m of this.mobs) {
      if(kind && m.kind!==kind) continue;
      const dx=m.x-p.x,dz=m.z-p.z,dist=Math.hypot(dx,dz,m.y-p.y);
      if(dist>reach || (dist>.01 && (dx*dir[0]+dz*dir[2])/dist<.48)) continue;
      const eye=[p.x,p.y+1.15,p.z];
      const vertical=m.y+.8-eye[1];
      const sight=Math.hypot(dx,vertical,dz)||1;
      if(trace(this.world,eye,[dx/sight,vertical/sight,dz/sight],Math.max(0,sight-.3))) continue;
      m.flee=7;m.noticed=false;m.charge=0;hit=true;
    }
    return hit;
  }

  mobOnBlock(x,y,z) {
    return this.mobs.some(m=>m.x>x-.32 && m.x<x+1.32 && m.z>z-.32 && m.z<z+1.32 && m.y<y+1 && m.y+1.55>y);
  }

  creatures(dt,p,t,low,damage,warning,reduced,peaceful=false) {
    let danger=0;
    for(const m of this.mobs) {
      const dx=p.x-m.x,dz=p.z-m.z,dist=Math.hypot(dx,dz);
      const reach=low?8.5:5.7;
      const vertical=Math.abs(p.y-m.y);
      m.cool=Math.max(0,m.cool-dt);m.flee=Math.max(0,m.flee-dt);
      const lit=m.kind==='rasp' && (wardCovers(this.ward,t,m) || (dist<reach && nearbyLanterns(this.world,m,3.3,1).length>0));
      const active=!peaceful && m.kind==='rasp' && !m.flee && !lit && dist<reach && vertical<2.2;
      const canStrike=active && dist<1.45 && vertical<1.3 && m.cool===0 &&
        !trace(this.world,[m.x,m.y+1,m.z],[dx/(dist||1),(p.y-m.y)/(dist||1),dz/(dist||1)],Math.max(0,dist-.25));
      if(!canStrike) m.charge=0;
      if(active) {
        danger=Math.max(danger,clamp(1-dist/reach,.22,1));
        if(!m.noticed) warning();
        if(canStrike) {
          if(!m.charge) warning(true);
          m.charge=(m.charge||0)+dt;
          if(m.charge>=.48) {
            damage(low?13:9,'Una raspadura te alcanzó.');
            m.cool=2.25;m.charge=0;
          }
        }
      }
      m.noticed=active;
      const retreat=lit || m.flee>0 || (m.kind==='limen' && dist<3.3 && vertical<2.2);
      const tx=active?dx:retreat?-dx:m.homeX+Math.sin(t*.11+m.phase)*2.2-m.x;
      const tz=active?dz:retreat?-dz:m.homeZ+Math.cos(t*.14+m.phase)*2.1-m.z;
      const len=Math.hypot(tx,tz)||1,speed=active?1.7:retreat?2.15:.64;
      if(len>.12 && !(active && dist<1.02)) {
        const ax=clamp(m.x+tx/len*dt*speed,-47.5,47.5),az=clamp(m.z+tz/len*dt*speed,-47.5,47.5);
        for(const [x,z] of [[ax,az],[ax,m.z],[m.x,az]]) {
          const y=groundNear(this.world,x,m.y,z);
          if(y===null) continue;
          m.x=x;m.z=z;m.y=y;break;
        }
      }
      m.g.position.set(m.x,m.y,m.z);
      m.g.rotation.y=Math.atan2(tx,tz);
      const windup=Math.min(1,(m.charge||0)/.48);
      const recoil=Math.max(0,(m.cool-1.9)/.35);
      m.torso.rotation.x=-windup*.29+recoil*.19;
      m.torso.position.y=windup*.16-recoil*.09;
      const gait=retreat?15:active?11:5;
      const swing=windup || recoil ? .09 : retreat?.39:.26;
      for(let i=0;i<m.legs.length;i++) {
        m.legs[i].rotation.x=reduced?0:Math.sin(t*gait+i*1.9+m.phase)*swing;
      }
    }
    return danger;
  }

  frame(p,hit,dt,t,biome,low,settings,moving) {
    this.lightClock-=dt;
    if(this.lightClock<=0) {
      this.lightClock=.15;
      const lights=nearbyLanterns(this.world,p,13,settings.resolution==='low'?2:4);
      this.lanterns.forEach((uniform,i)=>{
        const light=lights[i];
        if(light) uniform.set(light.x,light.y,light.z,1);
        else uniform.set(0,0,0,0);
      });
    }
    const b=BIOMES[biome], air=ATMOSPHERE[biome];
    this.targetShade.set(air.shade).lerp(this.white,.32);
    this.targetLight.set(air.light);
    this.targetDust.set(air.dust);
    const backdrop=1-Math.exp(-dt*1.8);
    this.terrainShade.lerp(this.targetShade,backdrop);
    this.fill.color.lerp(this.targetLight,backdrop);
    this.keyLight.color.lerp(this.targetLight,backdrop);
    this.keyLight.intensity=T.MathUtils.lerp(this.keyLight.intensity,biome===3?.65:low?.85:1.45,backdrop);
    this.dust.material.color.lerp(this.targetDust,backdrop);
    this.dust.visible=!settings.reduced && settings.resolution!=='low';
    if(this.dust.visible) {
      const count=biome===3?15:36;
      this.dustRise=T.MathUtils.lerp(this.dustRise,air.rise,backdrop);
      this.dustHeight=(this.dustHeight+dt*this.dustRise)%10;
      this.dust.geometry.setDrawRange(0,count);
      for(let i=0;i<count;i++) {
        const o=this.dustOffsets[i];
        this.dustPosition.setXYZ(i,wrapNear(o.x+t*.13,p.x,20),
          wrapNear(o.y+this.dustHeight,p.y+2,10),wrapNear(o.z+Math.sin(t*.11+i)*.8,p.z,20));
      }
      this.dustPosition.needsUpdate=true;
    }
    this.targetSky.set(b.sky).multiplyScalar(low?.57:1);
    this.targetFog.set(b.fog).multiplyScalar(low?.53:1);
    const w=Math.min(1,dt*2.3);
    this.scene.background.lerp(this.targetSky,w);
    this.sky.material.uniforms.horizon.value.copy(this.scene.background);
    this.sky.material.uniforms.zenith.value.copy(this.scene.background).multiplyScalar(biome===3?.54:.42);
    this.sky.material.uniforms.lunar.value.set(biome===3?'#292735':'#b9d7be');
    this.sky.position.set(p.x,p.y+1.62,p.z);
    this.sky.material.uniforms.drift.value=settings.reduced?0:t*.008;
    this.scene.fog.color.lerp(this.targetFog,w);
    this.scene.fog.density=T.MathUtils.lerp(this.scene.fog.density,air.air+(low?.007:0)+(settings.view===2?.008:0),backdrop);
    const surfaceVisibility=biome===3?0:Math.max(.16,1-Math.max(0,18-p.y)*.12);
    this.starMat.opacity=(low?.78:.44)*surfaceVisibility;
    this.moon.material.opacity=surfaceVisibility;
    this.moonArc.material.opacity=.66*surfaceVisibility;
    this.satellite.material.opacity=.78*surfaceVisibility;
    this.farArc.material.opacity=(.29+.035*Math.sin(settings.reduced?0:t*.04))*surfaceVisibility;
    if(!settings.reduced) {
      this.moon.rotation.y=t*.008;
      this.moonArc.rotation.z=.61+Math.sin(t*.018)*.018;
      this.satellite.rotation.set(t*.006,t*.014,t*.004);
      this.farArc.rotation.z=-.19+Math.sin(t*.025)*.025;
    }
    this.sky.material.uniforms.direction.value.set(
      -.17+.018*Math.sin(settings.reduced?0:t*.018),
      .215+.012*Math.sin(settings.reduced?0:t*.025),
      -.963
    ).normalize();
    this.sky.material.uniforms.lunar.value.set(biome===3?'#292735':low?'#d0a8c9':'#b9d7be');
    const bob=!settings.reduced && moving && p.ground?Math.sin(t*12)*.034:0;
    this.camera.position.set(p.x,p.y+1.62+bob,p.z);
    this.camera.rotation.set(p.pitch,p.yaw,0);
    this.hover.visible=!!hit;
    if(hit) this.hover.position.set(hit.cell[0]+.5,hit.cell[1]+.5,hit.cell[2]+.5);
    if(!settings.reduced) {
      this.eye.rotation.y=t*.24;
      for(const e of this.landmarks) {
        e.eye.rotation.set(t*.24,t*.49,.34);
        e.inner.rotation.y=.3+Math.sin(t*.6)*.28;
        if(e.id==='vault') {
          e.inner.scale.set(1+.095*Math.sin(t*.37),1+.055*Math.cos(t*.44),1);
          e.eye.position.y=e.inner.position.y+.05+Math.sin(t*.65)*.08;
        }
      }
    }
    for(const part of this.parts) {
      part.t-=dt;part.mesh.visible=part.t>0 && !settings.reduced;
      if(part.mesh.visible) {part.v.y-=dt*8;part.mesh.position.addScaledVector(part.v,dt);}
    }
    this.renderer.render(this.scene,this.camera);
  }
}
