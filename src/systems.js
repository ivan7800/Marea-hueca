import {SETTLEMENTS, fittingLayout} from './settlements.js';
import {SITES} from './expeditions.js';
import {BLOCKS, EDIT_LIMIT, HALF, HEIGHT, World, clamp, inside, surface, biomeAt} from './world.js';

export const ITEMS = Object.fromEntries(BLOCKS.slice(1,9).map((b,i)=>[i+1,{name:b.name, color:b.light}]));
Object.assign(ITEMS,{
  chisel:{name:'Escoplo de veta', color:'#c4ded3', kind:'tool'},
  hook:{name:'Gancho de concha', color:'#edb0a2', kind:'tool'},
  moss:{name:'Musgo vivo', color:'#9dd68d', kind:'heal'},
  needle:{name:'Aguja de resonancia', color:'#a9e4ff', kind:'tool',
    note:'F · Indica rumbo y distancia a un eco o almacén pendiente. Recarga en 8 s.'},
  saltlance:{name:'Lanza de sal', color:'#e4b5ed', kind:'tool',
    note:'F · Apunta a una raspadura a menos de 5 bloques. Gasta 1 sal violeta solo si la ahuyenta.'},
  ward:{name:'Fanal de umbral', color:'#ffe5a3', kind:'special',
    note:'F · Consume un fanal para proteger 4,5 bloques alrededor del punto de uso durante 14 s.'}
});

export const RECIPES = [
  { id:'chisel', count:1, costs:{1:3,4:2}, note:'Parte piedra y vetas con rapidez.' },
  { id:'hook', count:1, costs:{4:2,7:2}, note:'Corta fibras y ahuyenta criaturas.' },
  { id:'8', count:2, costs:{4:1,6:1}, note:'Ilumina los bloques cercanos. Colócalos para disuadir a las raspaduras.' },
  { id:'7', count:4, costs:{1:2,5:1}, note:'Cuatro bloques con acabado cobrizo.' },
  { id:'moss', count:2, costs:{2:2,4:1}, note:'Recupera 24 puntos de salud con F.' },
  { id:'ward', count:1, costs:{8:1,5:2}, note:'F · Protección temporal alrededor del punto de uso.' }
];
export const DEFAULT_SETTINGS={music:58, effects:68, sensitivity:50, view:3, mute:false, reduced:false, resolution:'auto'};
export const SAVE_VERSION=3;
export const MAX_STACK=999;
export const SLOTS=8;
export const SAVE_KEY='marea-hueca:slot:v1';
export const SET_KEY='marea-hueca:settings:v1';
export const EYE=1.62;
export const PLAYER_HEIGHT=1.8;
const R=.28;

export function newState(world) {
  const y=surface(world,0,7);
  return {
    player:{x:.5,y:y+.02,z:7.5,vx:0,vy:0,vz:0,ground:false,yaw:0,pitch:-.035,health:100},
    bag:{1:4,4:2,moss:2}, bar:['1','4',null,null,null,null,null,'moss'], selected:0,
    echoes:[], discoveries:[], finished:false, elapsed:0, deaths:0, needleReady:0, ward:null
  };
}

export function gain(state,id,count=1) {
  if (!Object.hasOwn(ITEMS,id) || (state.bag[id]??0)+count>MAX_STACK || count<1) return false;
  state.bag[id]=(state.bag[id]??0)+count;
  if (!state.bar.includes(String(id))) {
    const free=state.bar.indexOf(null);
    if (free>=0) state.bar[free]=String(id);
  }
  return true;
}

export function use(state,id,count=1) {
  if ((state.bag[id]??0)<count) return false;
  state.bag[id]-=count;
  if (!state.bag[id]) delete state.bag[id];
  return true;
}

export function canCraft(state,recipe) {
  return !!recipe && (state.bag[recipe.id]??0)+recipe.count<=MAX_STACK &&
    Object.entries(recipe.costs).every(([id,n])=>(state.bag[id]??0)>=n);
}

export function craft(state,recipe) {
  if (!canCraft(state,recipe)) return false;
  for (const [id,n] of Object.entries(recipe.costs)) use(state,id,n);
  return gain(state,recipe.id,recipe.count);
}

export function select(state,slot) {
  state.selected=((slot%SLOTS)+SLOTS)%SLOTS;
}

export function equip(state,id) {
  if (!state.bag[id]) return false;
  const previous=state.bar.indexOf(id);
  if (previous>=0) state.bar[previous]=state.bar[state.selected];
  state.bar[state.selected]=id;
  return true;
}

export function overlaps(player,x,y,z) {
  return x+1>player.x-R && x<player.x+R && z+1>player.z-R && z<player.z+R &&
    y+1>player.y && y<player.y+PLAYER_HEIGHT;
}

export function collides(world,x,y,z) {
  if (x-R < -HALF || x+R > HALF || z-R < -HALF || z+R > HALF || y<0 || y+PLAYER_HEIGHT>HEIGHT) return true;
  for (let a=Math.floor(x-R);a<=Math.floor(x+R-1e-6);a++)
    for (let b=Math.floor(y);b<=Math.floor(y+PLAYER_HEIGHT-1e-6);b++)
      for (let c=Math.floor(z-R);c<=Math.floor(z+R-1e-6);c++)
        if (world.get(a,b,c)) return true;
  return false;
}

export function stepPlayer(world,p,move,dt) {
  const speed=move.sprint?6.4:4.2;
  const length=Math.hypot(move.x,move.z)||1;
  const x=move.x/length, z=move.z/length;
  const targetX=(Math.cos(p.yaw)*x-Math.sin(p.yaw)*z)*speed;
  const targetZ=(-Math.sin(p.yaw)*x-Math.cos(p.yaw)*z)*speed;
  const respond=Math.min(1,dt*(p.ground?18:8));
  p.vx+=(targetX-p.vx)*respond;
  p.vz+=(targetZ-p.vz)*respond;
  if (move.jump && p.ground) p.vy=7.05;
  p.vy=Math.max(-24,p.vy-18*dt);
  let impact=0;
  for (const [axis,v] of [['x','vx'],['z','vz'],['y','vy']]) {
    const d=p[v]*dt;
    if (!d) continue;
    const next={x:p.x,y:p.y,z:p.z,[axis]:p[axis]+d};
    if (!collides(world,next.x,next.y,next.z)) {
      p[axis]=next[axis];
      if (axis==='y') p.ground=false;
      continue;
    }
    let low=0, high=1;
    for (let i=0;i<8;i++) {
      const m=(low+high)/2;
      const point={x:p.x,y:p.y,z:p.z,[axis]:p[axis]+m*d};
      if (collides(world,point.x,point.y,point.z)) high=m;
      else low=m;
    }
    p[axis]+=low*d;
    if (axis==='y' && d<0) { p.ground=true; impact=-p.vy; }
    p[v]=0;
  }
  return impact>13?Math.round((impact-12)*3):0;
}

// Recorre la cuadrícula en orden de distancia y conserva la cara de entrada.
export function trace(world,from,dir,reach=5.4) {
  const cell=from.map(Math.floor), step=dir.map(Math.sign);
  const length=dir.map(v=>v===0?Infinity:Math.abs(1/v));
  const edge=dir.map((v,i)=>v===0?Infinity:((cell[i]+(v>0?1:0))-from[i])/v);
  let normal=[0,0,0], t=0;
  while (t<=reach) {
    const block=world.get(...cell);
    if (block) return {cell,normal,block,distance:t};
    const axis=edge[0]<=edge[1] && edge[0]<=edge[2]?0:edge[1]<=edge[2]?1:2;
    t=edge[axis];
    cell[axis]+=step[axis];
    edge[axis]+=length[axis];
    normal=[0,0,0];
    normal[axis]=-step[axis];
  }
  return null;
}

export function miningTime(id,tool) {
  const h=BLOCKS[id].hardness;
  if (tool==='chisel' && [1,3,5,6,7].includes(id)) return h*.38;
  if (tool==='hook' && [2,4].includes(id)) return h*.32;
  return h;
}

export function mine(world,state,hit) {
  if (!hit || hit.block===9 || world.get(...hit.cell)!==hit.block || (state.bag[hit.block]??0)>=MAX_STACK) return false;
  return world.set(...hit.cell,0) && gain(state,hit.block);
}

export function place(world,state,hit,id,occupied=()=>false) {
  const n=Number(id);
  if (!hit || !hit.normal.some(Boolean) || !Number.isInteger(n) || n<1 || n>8 || !state.bag[id]) return null;
  const p=hit.cell.map((v,i)=>v+hit.normal[i]);
  if (world.get(...p) || overlaps(state.player,...p) || occupied(...p) || !world.set(...p,n)) return null;
  use(state,id);
  return p;
}

export function advanceEcho(state,id) {
  if (id==='vault') {
    if (state.echoes.length!==2) return 'El recinto aguarda los dos ecos de la superficie.';
    if (!state.finished) {
      state.finished=true;
      gain(state,'8',3);
    }
    return 'El mar no se fue. Aprendió a esperar. Tu refugio sigue en pie.';
  }
  if (['spine','salt'].includes(id) && !state.echoes.includes(id)) state.echoes.push(id);
  return null;
}

export function forecast(elapsed) {
  return {low: elapsed%260>=180, cycle:elapsed%260/260};
}

export function currentBiome(player) {
  return biomeAt(player.x,player.y,player.z);
}

export function recover(world,state) {
  const p=state.player;
  for (let r=0;r<=5;r++) {
    const x=.5+r, z=7.5, y=surface(world,Math.floor(x),Math.floor(z))+.02;
    if (!collides(world,x,y,z)) {
      Object.assign(p,{x,y,z,vx:0,vy:0,vz:0,yaw:0,pitch:-.035,health:100,ground:false});
      return;
    }
  }
  for (let z=-HALF;z<HALF;z++) for (let x=-HALF;x<HALF;x++) {
    const y=surface(world,x,z)+.02;
    if (!collides(world,x+.5,y,z+.5)) {
      Object.assign(p,{x:x+.5,y,z:z+.5,vx:0,vy:0,vz:0,yaw:0,pitch:0,health:100,ground:false});
      return;
    }
  }
  throw new Error('No queda una columna segura para regresar.');
}

export function safeSettings(data) {
  const s={...DEFAULT_SETTINGS};
  for (const key of ['music','effects','sensitivity']) if (Number.isFinite(data?.[key])) s[key]=clamp(data[key],0,100);
  if ([2,3,4].includes(data?.view)) s.view=data.view;
  for (const key of ['mute','reduced']) if (typeof data?.[key]==='boolean') s[key]=data[key];
  if (['auto','low','high'].includes(data?.resolution)) s.resolution=data.resolution;
  return s;
}

export function encode(world,state,settings) {
  const {x,y,z,yaw,pitch,health}=state.player;
  return JSON.stringify({version:SAVE_VERSION, seed:world.seed, position:[x,y,z,yaw,pitch], health,
    inventory:state.bag, bar:state.bar, selected:state.selected, echoes:state.echoes, discoveries:state.discoveries, finished:state.finished,
    elapsed:state.elapsed, deaths:state.deaths, layout:world.layout, needleReady:state.needleReady, ward:state.ward, edits:[...world.edits], settings});
}

export function decode(raw) {
  if (typeof raw!=='string' || raw.length>2_100_000) throw new Error('El archivo excede el tamaño permitido.');
  let data;
  try { data=JSON.parse(raw); } catch { throw new Error('La partida no contiene JSON válido.'); }
  const d=data;
  if (![1,2,SAVE_VERSION].includes(d?.version)) throw new Error('La versión de la partida no es compatible.');
  const fail=()=>{throw new Error('La partida contiene datos inválidos.');};
  if (typeof d.seed!=='string' || !d.seed.trim() || d.seed.length>64 || !Array.isArray(d.position) ||
      d.position.length!==5 || !d.position.every(Number.isFinite) || Math.abs(d.position[0])>=HALF ||
      Math.abs(d.position[2])>=HALF || d.position[1]<0 || d.position[1]>=HEIGHT ||
      Math.abs(d.position[3])>Math.PI*2 || Math.abs(d.position[4])>Math.PI/2 ||
      !Number.isFinite(d.health) || d.health<0 || d.health>100 || !d.inventory ||
      typeof d.inventory!=='object' || Array.isArray(d.inventory)) fail();
  const discoveries=d.version===1?[]:d.discoveries;
  const discoverySites=d.version===3?[...SITES,...SETTLEMENTS]:SITES;
  if (!Array.isArray(discoveries) || discoveries.length>discoverySites.length ||
      new Set(discoveries).size!==discoveries.length || discoveries.some(id=>!discoverySites.some(site=>site.id===id))) fail();
  if(!Array.isArray(d.edits) || d.edits.length>EDIT_LIMIT) fail();
  const editPattern=/^-?\d{1,2},\d{1,2},-?\d{1,2}$/;
  if(d.edits.some(edit=>!Array.isArray(edit) || edit.length!==2 || typeof edit[0]!=='string' || !editPattern.test(edit[0]))) fail();
  const layout=d.version===3?d.layout:fittingLayout(d.edits,d.position);
  if(!Array.isArray(layout) || layout.length!==SETTLEMENTS.length ||
      layout.some((index,i)=>!Number.isInteger(index) || index< -1 || index>=SETTLEMENTS[i].anchors.length) ||
      SETTLEMENTS.some((site,i)=>layout[i]===-1 && discoveries.includes(site.id))) fail();
  const needleReady=d.version===3?d.needleReady:0, ward=d.version===3?d.ward:null;
  if(!Number.isFinite(needleReady) || needleReady<0 || needleReady>d.elapsed+8 ||
      (ward!==null && (!ward || ![ward.x,ward.y,ward.z,ward.until].every(Number.isFinite) ||
      Math.abs(ward.x)>=HALF || Math.abs(ward.z)>=HALF || ward.y<0 || ward.y>=HEIGHT ||
      ward.until<0 || ward.until>d.elapsed+14))) fail();
  const world=new World(d.seed,layout), state=newState(world);
  state.bag={};
  for (const [id,n] of Object.entries(d.inventory)) {
    if (!Object.hasOwn(ITEMS,id) || !Number.isInteger(n) || n<1 || n>MAX_STACK) fail();
    state.bag[id]=n;
  }
  if (!Array.isArray(d.bar) || d.bar.length!==SLOTS ||
      d.bar.some(id=>id!==null && (typeof id!=='string' || !Object.hasOwn(ITEMS,id))) ||
      new Set(d.bar.filter(Boolean)).size!==d.bar.filter(Boolean).length ||
      !Number.isInteger(d.selected) || d.selected<0 || d.selected>=SLOTS ||
      !Array.isArray(d.echoes) || d.echoes.length>2 || new Set(d.echoes).size!==d.echoes.length ||
      d.echoes.some(id=>!['spine','salt'].includes(id)) || typeof d.finished!=='boolean' ||
      (d.finished && d.echoes.length!==2) || !Number.isFinite(d.elapsed) || d.elapsed<0 ||
      d.elapsed>1e9 || !Number.isInteger(d.deaths) || d.deaths<0 || d.deaths>1e6 ||
      !Array.isArray(d.edits) || d.edits.length>EDIT_LIMIT) fail();
  const seen=new Set();
  for (const edit of d.edits) {
    if (!Array.isArray(edit) || edit.length!==2 || typeof edit[0]!=='string' ||
        !/^-?\d{1,2},\d{1,2},-?\d{1,2}$/.test(edit[0]) || seen.has(edit[0])) fail();
    const [key,id]=edit, pos=key.split(',').map(Number);
    if (String(pos)!==key || !inside(...pos) || pos[1]===0 || !Number.isInteger(id) || id<0 || id>8) fail();
    seen.add(key);
    // Evita regenerar chunks al restaurar una lista ya validada.
    world.restoreEdit(...pos,id);
  }
  Object.assign(state,{bar:d.bar,selected:d.selected,echoes:d.echoes,discoveries,finished:d.finished,elapsed:d.elapsed,deaths:d.deaths,needleReady,ward});
  const [x,y,z,yaw,pitch]=d.position;
  Object.assign(state.player,{x,y,z,yaw,pitch,health:d.health});
  if (collides(world,x,y,z) || d.health===0) recover(world,state);
  return {world,state,settings:safeSettings(d.settings)};
}
