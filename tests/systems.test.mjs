import test from 'node:test';
import assert from 'node:assert/strict';
import { World, WIDTH, HALF, HEIGHT, LANDMARKS, affectedChunks, biomeAt, surface, landmarkPosition } from '../src/world.js';
import { trace, stepPlayer, collides, newState, mine, place, craft, canCraft, select, equip, gain, recover,
  miningTime, encode, decode, RECIPES, DEFAULT_SETTINGS, SAVE_KEY, advanceEcho, forecast } from '../src/systems.js';
import { meshChunk } from '../src/mesh.js';

test('Una semilla reproduce chunks incluso en distinto orden y otra altera el terreno',()=>{
  const a=new World('MAREA-17'),b=new World('MAREA-17'),c=new World('MAREA-18');
  const sample=w=>Array.from({length:WIDTH},(_,i)=>surface(w,i-HALF,35));
  const first=sample(a);
  b.get(47,14,-47);b.get(-47,14,47);
  assert.deepEqual(first,sample(b));
  assert.notDeepEqual(first,sample(c));
});
test('Aparición, límites, altura y composiciones de bioma',()=>{
  for(const seed of ['MAREA-17','0','Ç🜄','una semilla larga']) {
    const w=new World(seed),p=newState(w).player;
    assert.equal(collides(w,p.x,p.y,p.z),false);
    assert.equal(collides(w,p.x,p.y-.1,p.z),true);
    assert.equal(collides(w,HALF,p.y,p.z),true);
    assert.equal(w.get(HALF,10,0),0);
    assert.equal(w.get(-HALF,0,0),9);
    assert.equal(w.set(0,0,0,0),false);
    assert.equal(w.set(0,HEIGHT,0,1),false);
    assert.deepEqual([-25,0,25].map(x=>biomeAt(x,15,0)),[1,0,2]);
    assert.equal(biomeAt(0,9,-24),3);
    for(const point of LANDMARKS) {
      const [x,y,z]=landmarkPosition(w,point);
      assert.equal(collides(w,x,y+.01,z),false,point.id);
    }
  }
});
test('Física fija, aterrizaje, avance, muro y salto',()=>{
  const w=new World('MAREA-17'),p=newState(w).player, dt=1/120;
  const step=(n,move)=>{for(let i=0;i<n;i++) stepPlayer(w,p,{x:0,z:0,...move},dt);};
  step(20);assert.ok(p.ground);
  w.set(0,15,5,1);w.set(0,16,5,1);
  step(180,{z:1});assert.ok(p.z>=6.27 && p.z<=6.29);assert.equal(p.vz,0);
  step(21,{jump:true});assert.ok(p.y>15.85 && !p.ground);
  step(100);assert.ok(p.ground && p.y>=15 && p.y<15.01);
});
test('Trazado voxel, minería, barra y colocación separan inventario y terreno',()=>{
  const w=new World('MAREA-17'),s=newState(w);
  const hit=trace(w,[.5,17.1,4.5],[0,-1,0]);
  assert.deepEqual(hit.normal,[0,1,0]);
  assert.equal(trace(w,[.5,30,.5],[0,1,0]),null);
  const before=s.bag[hit.block]??0;
  assert.ok(mine(w,s,hit));
  assert.equal(s.bag[hit.block],before+1);
  assert.equal(mine(w,s,hit),false);
  const below=trace(w,[.5,17.1,4.5],[0,-1,0]);
  assert.deepEqual(place(w,s,below,String(hit.block)),hit.cell);
  assert.equal(s.bag[hit.block]??0,before);
  assert.equal(w.edits.size,0);
  assert.equal(place(w,s,trace(w,[.5,16,7.5],[0,-1,0]),'1'),null);
  select(s,-1);assert.equal(s.selected,7);
  assert.ok(equip(s,'1'));assert.equal(s.bar[7],'1');
  assert.equal(new Set(s.bar.filter(Boolean)).size,s.bar.filter(Boolean).length);
});
test('Recetas, saturación y herramientas aplican sus costes y ventajas',()=>{
  const s=newState(new World('A'));
  assert.equal(canCraft(s,RECIPES[1]),false);
  assert.equal(craft(s,RECIPES[1]),false);
  assert.ok(craft(s,RECIPES[0]));assert.equal(s.bag.chisel,1);
  assert.equal(s.bag[1],1);assert.equal(s.bag[4],undefined);
  assert.ok(gain(s,'7',999));assert.equal(gain(s,'7'),false);
  assert.ok(miningTime(3,'chisel')<miningTime(3,'hook'));
  assert.ok(miningTime(4,'hook')<miningTime(4,'chisel'));
});
test('Malla sin caras internas e invalidación de vecinos solo al tocar bordes',()=>{
  const fake={number:0,get:(x,y,z)=>y===4&&z===0&&(x===0||x===1)?1:0};
  const data=meshChunk(fake,0,0);
  assert.equal(data.positions.length,10*6*3);
  assert.equal(data.uvs.length,10*6*2);
  assert.deepEqual(affectedChunks(0,0),['0,0','-1,0','0,-1']);
  assert.deepEqual(affectedChunks(3,4),['0,0']);
});
test('Guardado versionado y JSON portable conservan estado y cambios',()=>{
  const w=new World('MAREA-17'),s=newState(w);
  w.set(30,31,1,8);
  craft(s,RECIPES[0]);
  advanceEcho(s,'spine');
  s.player.health=76;
  const raw=encode(w,s,{...DEFAULT_SETTINGS,mute:true}), payload=decode(raw);
  assert.equal(payload.world.get(30,31,1),8);
  assert.equal(payload.settings.mute,true);
  assert.equal(payload.state.player.health,76);
  assert.equal(encode(payload.world,payload.state,payload.settings),raw);
  assert.match(SAVE_KEY,/^marea-hueca:/);
  for(const p of [null,{version:0},{...JSON.parse(raw),edits:[['100,2,2',1]]},
    {...JSON.parse(raw),inventory:{moss:1000}},{...JSON.parse(raw),bar:['constructor']},
    {...JSON.parse(raw),edits:[['0,1,0',0],['0,1,0',0]]}]) {
    assert.throws(()=>decode(JSON.stringify(p)));
  }
  assert.throws(()=>decode('medio guardado'));
});
test('Carga recupera una posición ocupada y la derrota conserva la mochila',()=>{
  const w=new World('A'),s=newState(w);
  w.set(0,15,7,1);
  const loaded=decode(encode(w,s,DEFAULT_SETTINGS));
  const {x,y,z}=loaded.state.player;
  assert.equal(collides(loaded.world,x,y,z),false);
  assert.deepEqual(loaded.state.bag,s.bag);
  s.player.health=0;
  recover(w,s);
  assert.equal(s.player.health,100);
  assert.equal(w.get(0,15,7),1);
});
test('Los ecos son opcionales e irrepetibles y la bajamar es cíclica',()=>{
  const s=newState(new World('A'));
  assert.match(advanceEcho(s,'vault'),/aguarda/);
  advanceEcho(s,'spine');advanceEcho(s,'spine');advanceEcho(s,'salt');
  advanceEcho(s,'vault');advanceEcho(s,'vault');
  assert.ok(s.finished);assert.equal(s.bag[8],3);
  assert.equal(forecast(179).low,false);
  assert.equal(forecast(181).low,true);
  assert.equal(forecast(260).low,false);
});
