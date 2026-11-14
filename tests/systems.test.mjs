import test from 'node:test';
import assert from 'node:assert/strict';
import { World, WIDTH, HALF, HEIGHT, LANDMARKS, affectedChunks, biomeAt, surface, landmarkPosition } from '../src/world.js';
import { trace, stepPlayer, collides, newState, mine, place, craft, canCraft, select, equip, gain, recover,
  miningTime, encode, decode, RECIPES, DEFAULT_SETTINGS, SAVE_VERSION, SAVE_KEY, advanceEcho, forecast } from '../src/systems.js';
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

test('Una partida v1 conserva construcción, fanales, mochila y progreso al migrar',()=>{
  const w=new World('MAREA-17'),s=newState(w);
  w.set(-1,18,7,8);
  advanceEcho(s,'spine');
  const old=JSON.parse(encode(w,s,DEFAULT_SETTINGS));
  old.version=1;
  delete old.discoveries;
  const restored=decode(JSON.stringify(old));
  assert.equal(restored.world.get(-1,18,7),8);
  assert.deepEqual(restored.state.bag,s.bag);
  assert.deepEqual(restored.state.echoes,['spine']);
  assert.deepEqual(restored.state.discoveries,[]);
});

test('Los hallazgos son únicos y el índice de fanales sigue al bloque',async()=>{
  const {SITES,discover,nearbyLanterns}=await import('../src/expeditions.js');
  const w=new World('MAREA-17'),s=newState(w),site=SITES[0];
  s.bag[4]=999;
  assert.equal(discover(s,site,gain),false);
  assert.equal(s.bag[2],undefined);
  s.bag[4]=2;
  assert.equal(discover(s,site,gain),true);
  assert.equal(discover(s,site,gain),false);
  const cell=[-1,18,7],player={x:.5,y:18,z:7.5};
  assert.ok(w.set(...cell,8));
  const loaded=decode(encode(w,s,DEFAULT_SETTINGS));
  assert.deepEqual(loaded.state.discoveries,[site.id]);
  assert.equal(nearbyLanterns(loaded.world,player).length,1);
  assert.ok(loaded.world.set(...cell,w.base(...cell)));
  assert.equal(nearbyLanterns(loaded.world,player).length,0);
});

test('Las tres estructuras tienen entradas transitables y usan mallas de chunks',()=>{
  for(const seed of ['MAREA-17','A','bajamar']) {
    const w=new World(seed);
    assert.equal(w.settlements.length,3);
    for(const site of w.settlements) {
      const x=site.x+(site.id==='boyas'?2:5);
      for(let z=site.z+5;z<site.z+site.depth;z++) {
        assert.equal(collides(w,x+.5,site.y+1,z+.5),false);
        assert.ok(w.get(x,site.y,z));
      }
      assert.equal(w.get(x,site.y+1,site.z+site.cache[1]),7);
      assert.ok(meshChunk(w,Math.floor(x/16),Math.floor(site.z/16)).positions.length);
    }
  }
});

test('Migrar una partida v2 respeta las ediciones y la posición en las huellas originales',()=>{
  const w=new World('MAREA-17',[-1,-1]),s=newState(w);
  w.set(4,22,-16,8);
  Object.assign(s.player,{x:-24.5,y:surface(w,-25,12)+.02,z:12.5,yaw:.8});
  const old=JSON.parse(encode(w,s,DEFAULT_SETTINGS));
  old.version=2;
  advanceEcho(s,'spine');
  old.echoes=s.echoes;
  const load=decode(JSON.stringify(old));
  assert.deepEqual(load.world.layout,[1,1,0]);
  assert.equal(load.world.get(4,22,-16),8);
  assert.equal(load.state.player.x,-24.5);
  assert.equal(load.state.player.y,s.player.y);
  assert.deepEqual(load.state.echoes,['spine']);
  assert.deepEqual(decode(encode(load.world,load.state,load.settings)).world.layout,[1,1,0]);
});

test('Suministros únicos, receta de umbral y persistencia de los efectos',async()=>{
  const {discover}=await import('../src/expeditions.js');
  const {nearestSignal,wardCovers}=await import('../src/settlements.js');
  const w=new World('MAREA-17'),s=newState(w);
  for(const site of w.settlements) {
    assert.equal(discover(s,site,gain),true);
    assert.equal(discover(s,site,gain),false);
  }
  assert.equal(s.bag.needle,1);
  assert.equal(s.bag.saltlance,1);
  gain(s,'8');
  assert.ok(craft(s,RECIPES.find(recipe=>recipe.id==='ward')));
  assert.equal(s.bag.ward,2);
  assert.equal(s.bag[5],5);
  assert.equal(nearestSignal(w,s,[]),undefined);
  s.ward={x:.5,y:15,z:7.5,until:14};
  s.needleReady=8;
  const load=decode(encode(w,s,DEFAULT_SETTINGS));
  assert.deepEqual(load.state.discoveries,['boyas','costillas','aljibe']);
  assert.equal(load.state.needleReady,8);
  assert.ok(wardCovers(load.state.ward,1,{x:4,y:15,z:7.5}));
  assert.equal(wardCovers(load.state.ward,14,{x:4,y:15,z:7.5}),false);
});

test('Migrar v3 conserva emplazamientos y construcciones y evita la huella ocupada del aljibe',()=>{
  const w=new World('MAREA-17',[1,2,-1]),s=newState(w);
  w.set(25,24,14,8);
  const old=JSON.parse(encode(w,s,DEFAULT_SETTINGS));
  old.version=3;
  old.layout=[1,2];
  old.discoveries=['boyas'];
  const loaded=decode(JSON.stringify(old));
  assert.deepEqual(loaded.world.layout,[1,2,1]);
  assert.equal(loaded.world.get(25,24,14),8);
  assert.deepEqual(loaded.state.discoveries,['boyas']);
  assert.deepEqual(loaded.state.player,s.player);
  assert.deepEqual(decode(encode(loaded.world,loaded.state,loaded.settings)).world.layout,[1,2,1]);
  assert.throws(()=>decode(JSON.stringify({...old,layout:[1,2,1]})));
});

test('Modo Libre conserva construcciones sin consumir bloques ni sufrir daño al guardar',()=>{
  const world=new World('LIBRE-17'), state=newState(world,'free');
  const before=state.bag['1'];
  const p=state.player;
  const hit={cell:[0,Math.floor(p.y)-1,8],normal:[0,1,0],block:1};
  const placed=place(world,state,hit,'1');
  assert.ok(placed);
  assert.equal(state.bag['1'],before);
  const mined=mine(world,state,{cell:placed,block:1});
  assert.equal(mined,true);
  assert.equal(state.bag['1'],before);
  assert.equal(canCraft(state,RECIPES[0]),true);
  assert.equal(craft(state,RECIPES[0]),true);
  const restored=decode(encode(world,state,DEFAULT_SETTINGS));
  assert.equal(restored.state.mode,'free');
  assert.equal(restored.state.bag['1'],before);
  assert.deepEqual([...restored.world.edits],[...world.edits]);
});

test('La versión 4 abre como Supervivencia y el modo del archivo se valida',()=>{
  const world=new World('ANTIGUA-17'),state=newState(world);
  const old=JSON.parse(encode(world,state,DEFAULT_SETTINGS));
  old.version=4;
  delete old.mode;
  assert.equal(decode(JSON.stringify(old)).state.mode,'survival');
  old.version=SAVE_VERSION;
  old.mode='invalid';
  assert.throws(()=>decode(JSON.stringify(old)),/inválidos/);
});

test('La Fosa del Testigo se descubre una sola vez en ambos modos',async()=>{
  const {SITES,discover}=await import('../src/expeditions.js');
  const site=SITES.find(s=>s.id==='witness');
  for(const mode of ['survival','free']) {
    const state=newState(new World('TESTIGO-17'),mode);
    assert.equal(discover(state,site,gain),true);
    assert.equal(discover(state,site,gain),false);
    assert.deepEqual(decode(encode(new World('TESTIGO-17'),state,DEFAULT_SETTINGS)).state.discoveries,['witness']);
  }
});

test('Las reglas configurables de Libre persisten y Supervivencia antigua conserva agresión',()=>{
  const freeWorld=new World('LIBRE-REGLAS');
  const free=newState(freeWorld,'free',{damage:true,creatures:false});
  assert.deepEqual(free.rules,{damage:true,creatures:false});
  const restored=decode(encode(freeWorld,free,DEFAULT_SETTINGS));
  assert.deepEqual(restored.state.rules,free.rules);
  const survivalWorld=new World('SUPERVIVENCIA-ANTIGUA'),survival=newState(survivalWorld);
  const old=JSON.parse(encode(survivalWorld,survival,DEFAULT_SETTINGS));
  old.version=5;delete old.rules;
  assert.deepEqual(decode(JSON.stringify(old)).state.rules,{damage:true,creatures:true});
  const legacyFreeWorld=new World('LIBRE-V5'),oldFree=JSON.parse(encode(legacyFreeWorld,newState(legacyFreeWorld,'free'),DEFAULT_SETTINGS));
  oldFree.version=5;delete oldFree.rules;
  const migrated=decode(JSON.stringify(oldFree)).state;
  assert.equal(migrated.mode,'free');
  assert.deepEqual(migrated.rules,{damage:false,creatures:false});
  old.version=SAVE_VERSION;old.rules={damage:false,creatures:false};
  assert.throws(()=>decode(JSON.stringify(old)),/inválidos/);
});

test('Dos expediciones adicionales tienen recompensas únicas y persistentes',async()=>{
  const {SITES,discover}=await import('../src/expeditions.js');
  for(const id of ['spire','orchard']) {
    const site=SITES.find(item=>item.id===id);
    const world=new World('SITIOS-08'),state=newState(world);
    assert.equal(discover(state,site,gain),true);
    assert.equal(discover(state,site,gain),false);
    assert.ok(decode(encode(world,state,DEFAULT_SETTINGS)).state.discoveries.includes(id));
  }
});
