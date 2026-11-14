export const WIDTH = 96;
export const HALF = WIDTH / 2;
export const HEIGHT = 40;
export const CHUNK = 16;
export const EDIT_LIMIT = 40000;
export const DEFAULT_SEED = 'MAREA-17';

export const BLOCKS = [
  null,
  { name:'Caliza de marea', color:'#a2a28b', light:'#bbc0a4', hardness:.42, tone:140 },
  { name:'Limo frío', color:'#4c655b', light:'#74947e', hardness:.31, tone:96 },
  { name:'Vetas de basalto', color:'#42464f', light:'#626572', hardness:.78, tone:108 },
  { name:'Junco osificado', color:'#94805a', light:'#bd9f69', hardness:.26, tone:256 },
  { name:'Sal violeta', color:'#664963', light:'#a36f9c', hardness:.45, tone:235 },
  { name:'Nácar resonante', color:'#53a69a', light:'#9de5c6', hardness:.65, tone:392 },
  { name:'Concha laminada', color:'#86645a', light:'#be8e76', hardness:.48, tone:182 },
  { name:'Fanal de nácar', color:'#70beb1', light:'#d1ffe4', hardness:.22, tone:540 },
  { name:'Sustrato', color:'#27282f', light:'#3d3d48', hardness:Infinity, tone:65 }
];

export const BIOMES = [
  { name:'La Costra', note:'CALIZA · JUNCO', sky:'#364640', fog:'#3d5048', accent:'#aae0b7', pitch:55 },
  { name:'El Espinazo', note:'BASALTO · NÁCAR', sky:'#343447', fog:'#3b3a4e', accent:'#aeb9ee', pitch:46.25 },
  { name:'La Salina Ciega', note:'SAL VIOLETA · CONCHA', sky:'#553c4a', fog:'#594250', accent:'#eeb7c6', pitch:65.41 },
  { name:'La Cámara Sorda', note:'CALIZA · NÁCAR', sky:'#171a24', fog:'#1f222a', accent:'#a4d6d1', pitch:41.2 }
];

export const LANDMARKS = [
  { id:'spine', title:'Costilla partida', x:-28, z:-5, color:'#a6b8fc', line:'«Íbamos a ponerle un nombre al silencio. Se nos adelantó.»' },
  { id:'salt', title:'Pozo que escucha', x:28, z:1, color:'#ffb5ce', line:'«Toca dos veces. Si devuelve tres, vuelve a casa.»' },
  { id:'vault', title:'Cámara Sorda', x:0, y:9, z:-24, color:'#a5ffe1', line:'«El mar no se fue. Aprendió a esperar.»' }
];

export const clamp = (v,min,max) => Math.max(min,Math.min(v,max));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = t => t*t*(3-2*t);

export function hashSeed(text) {
  let h=2166136261;
  for (const char of text) h=Math.imul(h ^ char.codePointAt(0), 16777619);
  return h >>> 0;
}

export function randomAt(seed,x,z) {
  let n=seed ^ Math.imul(x,374761393) ^ Math.imul(z,668265263);
  n=Math.imul(n ^ n>>>13,1274126177);
  return ((n ^ n>>>16) >>> 0)/4294967296;
}

function noise(seed,x,z,scale) {
  x/=scale;
  z/=scale;
  const a=Math.floor(x), b=Math.floor(z), u=smooth(x-a), v=smooth(z-b);
  return mix(mix(randomAt(seed,a,b),randomAt(seed,a+1,b),u),
    mix(randomAt(seed,a,b+1),randomAt(seed,a+1,b+1),u),v);
}

export function biomeAt(x,y,z) {
  if (y<14 && Math.abs(x)<11 && z<-15 && z>-34) return 3;
  if (x<-15) return 1;
  if (x>15) return 2;
  return 0;
}

export function inside(x,y,z) {
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
    x>=-HALF && x<HALF && z>=-HALF && z<HALF && y>=0 && y<HEIGHT;
}

export const chunkKey = (x,z) => `${Math.floor(x/CHUNK)},${Math.floor(z/CHUNK)}`;
export const blockKey = (x,y,z) => `${x},${y},${z}`;

export function affectedChunks(x,z) {
  return [...new Set([[x,z],[x-1,z],[x+1,z],[x,z-1],[x,z+1]]
    .filter(([a,b])=>inside(a,0,b)).map(([a,b])=>chunkKey(a,b)))];
}

function column(seed,x,z) {
  const n=noise(seed,x,z,19), q=noise(seed+18,x,z,6);
  const biome=biomeAt(x,20,z);
  let h=Math.round(14 + (n-.5)*7 + (q-.5)*4);
  if (biome===1) h+=Math.round(2+3*Math.pow(Math.sin(x*.24+z*.12),4));
  if (biome===2) h+=Math.round(2*Math.sin(z*.28+Math.sin(x*.45)));
  if (Math.abs(x)<3 && z>=-20 && z<=11) h=14;
  if (Math.abs(x)<11 && z<-17 && z>-34) h=Math.max(h,15);
  if (LANDMARKS.slice(0,2).some(p=>Math.abs(x-p.x)<3 && Math.abs(z-p.z)<3)) h=15;
  if (Math.abs(z)<3 && Math.abs(x)<34 && Math.abs(x)>=3) {
    const rise=x<-15?Math.min(2,Math.floor((-x-15)/5)):0;
    h=14+rise;
  }
  return {h,biome};
}

export function columnHeight(world,x,z) {
  return column(world.number,x,z).h;
}

function makeChunk(world,cx,cz) {
  const data=new Uint8Array(CHUNK*CHUNK*HEIGHT);
  const startX=cx*CHUNK, startZ=cz*CHUNK;
  for (let dz=0;dz<CHUNK;dz++) for (let dx=0;dx<CHUNK;dx++) {
    const x=startX+dx, z=startZ+dz;
    const {h,biome}=column(world.number,x,z);
    const r=randomAt(world.number+53,x,z);
    const shape=Math.pow(Math.sin((x+z*.45)*.54),10);
    const location=LANDMARKS.slice(0,2).some(p=>Math.hypot(x-p.x,z-p.z)<3.7);
    const path=(Math.abs(x)<3 && z>=-20 && z<=11) || Math.abs(z)<3 || location;
    const spike=!path && biome===1 && shape>.48 ? Math.floor(2+shape*(5+r*9)) : 0;
    const shell=!path && biome===2 && r>.965 ? 2+Math.floor(4*noise(world.number,x,z,4)) : 0;
    const reed=!path && biome===0 && r>.94 ? (r>.978?2:1) : 0;
    for (let y=0;y<HEIGHT;y++) {
      let id=0;
      if (y===0) id=9;
      else if (y<h-2) id=3;
      else if (y<=h) id=biome===1?3:biome===2?5:(r>.76?2:1);
      else if (y<=h+spike) id=y===h+spike && r>.5?6:3;
      else if (y<=h+shell) id=y===h+shell && r>.977?6:7;
      else if (y<=h+reed) id=4;
      if (y===h && biome===1 && r>.955 && !path) id=6;
      if (y===h && biome===0 && Math.abs(z)<3 && Math.abs(x)>=7 && Math.abs(x)<=15) id=7;
      if (Math.abs(x)<9 && z<-18 && z>-32 && y>=8 && y<=12+(8-Math.abs(x))*0.25) {
        id=0;
        if (Math.abs(x)===7 && z%4===0 && y<12) id=y===9?6:3;
      }
      if (Math.abs(x)<=1 && z<=-9 && z>=-20) {
        const floor=Math.max(7,14-(-9-z));
        if (y>floor && (y<=floor+4 || z>=-15)) id=0;
        if (y===floor) id=(z%3===0 && x===-1)?8:7;
        if (Math.abs(x)===1 && z< -15 && y===floor+1 && z%3===0) id=8;
      }
      if (Math.abs(x)===2 && z>=-12 && z<=-9 && y===15) id=z===-9?8:7;
      if (Math.abs(x)===3 && z===-7 && y>=15 && y<=18) id=y===18?8:7;
      if (Math.abs(x-3)<=1 && z===4 && y>=h+1 && y<=h+2) id=4;
      if (biome===2 && !path && z>5 && z<34) {
        const radius=Math.hypot((x-32)*.88,z-21);
        const rib=Math.abs(radius-8)<.59 || Math.abs(radius-13.5)<.58;
        if (rib && y===h) id=7;
        if (rib && y===h+1 && r>.57) id=r>.9?6:7;
      }
      if (Math.abs(x-2)<=1 && z===-26 && y===8) id=7;
      data[(dz*CHUNK+dx)*HEIGHT+y]=id;
    }
  }
  return data;
}

export class World {
  constructor(seed) {
    this.seed=seed;
    this.number=hashSeed(seed);
    this.chunks=new Map();
    this.edits=new Map();
  }

  get(x,y,z) {
    if (!inside(x,y,z)) return 0;
    return this.edits.get(blockKey(x,y,z)) ?? this.base(x,y,z);
  }

  base(x,y,z) {
    if (!inside(x,y,z)) return 0;
    const key=chunkKey(x,z);
    if (!this.chunks.has(key)) this.chunks.set(key,makeChunk(this,Math.floor(x/CHUNK),Math.floor(z/CHUNK)));
    return this.chunks.get(key)[((z & 15)*CHUNK+(x & 15))*HEIGHT+y];
  }

  set(x,y,z,id) {
    if (!inside(x,y,z) || y===0 || !Number.isInteger(id) || id<0 || id>8) return false;
    const key=blockKey(x,y,z);
    if (id===this.base(x,y,z)) {
      this.edits.delete(key);
      return true;
    }
    if (this.edits.size>=EDIT_LIMIT && !this.edits.has(key)) return false;
    this.edits.set(key,id);
    return true;
  }
}

export function surface(world,x,z) {
  for (let y=HEIGHT-1;y>=0;y--) if (world.get(x,y,z)) return y+1;
  return 1;
}

export function landmarkPosition(world,p) {
  return [p.x+.5,p.y??surface(world,p.x,p.z),p.z+.5];
}
