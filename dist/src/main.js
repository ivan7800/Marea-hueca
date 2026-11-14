import {World, BLOCKS, BIOMES, DEFAULT_SEED, HALF, affectedChunks, chunkKey, clamp} from './world.js';
import {DEFAULT_SETTINGS, SAVE_KEY, SET_KEY, EYE, ITEMS, RECIPES, canCraft, craft, gain, use, select, equip,
  newState, stepPlayer, trace, mine, place, miningTime, encode, decode, safeSettings,
  advanceEcho, currentBiome, forecast, recover} from './systems.js';
import {View} from './render.js';
import {Sound} from './audio.js';
import {cover} from './cover.js';

const $=id=>document.getElementById(id);
const panel=$('panel'), canvas=$('art');
let storage;
try {storage=window.localStorage;} catch {}
const sound=new Sound();
const keys=new Set();
const qa=new URLSearchParams(location.search).get('qa')==='1';
const slot=qa?SAVE_KEY+':qa':SAVE_KEY, settingsSlot=qa?SET_KEY+':qa':SET_KEY;
const controlQuery=matchMedia('(any-pointer: fine)');
const controls=()=>!matchMedia('(pointer: coarse)').matches || controlQuery.matches;
let settings={...DEFAULT_SETTINGS,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
try {
  const raw=storage.getItem(settingsSlot);
  if(raw) settings=safeSettings(JSON.parse(raw));
} catch {}
let world,state,view,mode='front',panelName='',previousPanel='front',needClick=false;
let mining=false,mined=0,mineKey='',jump=false,chunk='',last=0,physics=0,uiClock=0,stepClock=0;
let lastSave=0,lastToast=0,damagePulse=0,pausedMessage='',session=0,revision=0,lockTime=0;
let currentRaw=null,seenAtCreation=null,writeFault=false,lastBiome=-1,lastLow=false,danger=0;

const contents={
  new:['NUEVA PARTIDA','Abre un atlas'],
  pause:['CAMPO EN PAUSA','Haz una pausa'],
  settings:['PREFERENCIAS','Ajustes'],
  inventory:['EQUIPO DE CAMPO','Mochila y fabricación'],
  credits:['LA MAREA HUECA','Créditos'],
  defeat:['REGRESO A LA COSTRA','El eco te ha encontrado'],
  resume:['PARTIDA LISTA','Vuelve a la cuenca']
};
function body(title,html) { const [eyebrow,heading]=contents[title]; return `<div class="panel-inner"><div class="panel-header"><div><small>${eyebrow}</small><h2 id="panel-title">${heading}</h2></div><button data-action="back" aria-label="Cerrar">×</button></div>${html}</div>`; }
function buttons(...values) {return '<div class="panel-actions">'+values.map(([action,label,primary])=>`<button data-action="${action}"${primary?' class="primary"':''}>${label}</button>`).join('')+'</div>';}
function disk() {try{return storage?.getItem(slot)??null;}catch{return null;}}
function notify(message,seconds=3.7) {
  $('notice').textContent=message;
  lastToast=performance.now()+seconds*1000;
}
function storeSettings() {try{storage.setItem(settingsSlot,JSON.stringify(settings));}catch{} }
function refreshMenu() { $('continue').disabled=!disk() || !controls(); $('new').disabled=!controls(); }
function stop() {
  keys.clear(); mining=false;mined=0;jump=false;mineKey='';physics=0;
  if(state) state.player.vx=state.player.vz=0;
}
function show(name) {
  if(name==='new') seenAtCreation=disk();
  panelName=name;
  if(mode==='play') {mode='pause';stop();document.exitPointerLock?.();}
  panel.setAttribute('aria-labelledby','panel-title');
  const templates={
    new:()=> `<form class="form-grid" id="seed-form"><label for="seed">Semilla del mundo</label><input type="text" id="seed" maxlength="64" required value="${DEFAULT_SEED}" spellcheck="false" autocomplete="off"><p>La misma semilla reconstruye el mismo terreno. ${disk()?'Ya hay una partida en esta ranura. Puedes descargarla antes de sustituirla.':'Empiezas en La Costra, frente al observatorio.'}</p>${disk()?'<label class="check"><input id="replace-save" type="checkbox" required> Sustituir la partida local</label>':''}<div class="panel-actions"><button type="submit" class="primary">Entrar en la cuenca</button><button data-action="random" type="button">Otra semilla</button>${disk()?'<button data-action="export" type="button">Exportar partida actual</button>':''}</div></form><p class="message"></p>`,
    pause:()=> `<p>${pausedMessage || 'La cuenca se detiene mientras estás en pausa.'}</p>${buttons(['resume','Reanudar',true],['save','Guardar'],['inventory','Mochila'],['settings','Ajustes'],['export','Exportar partida'],['menu','Volver al menú'])}<p class="message" aria-live="polite"></p>`,
    resume:()=> `<p>Usa el ratón o I J K L para mirar. Puedes minar con M y colocar con N. Escape libera el cursor.</p>${buttons(['resume','Capturar cursor',true],['menu','Volver al menú'])}<p class="message" aria-live="polite"></p>`,
    defeat:()=> `<p>Regresarás junto al observatorio con la mochila y tus construcciones. El mundo conserva tu recorrido.</p>${buttons(['recover','Regresar a La Costra',true])}`,
    settings:()=> `<div class="form-grid">${[['music','Música'],['effects','Efectos'],['sensitivity','Sensibilidad']].map(([k,n])=>`<label class="setting">${n}<input data-setting="${k}" type="range" min="0" max="100" value="${settings[k]}"></label>`).join('')}<label class="setting">Distancia de visión<select data-setting="view">${[[2,'Corta'],[3,'Normal'],[4,'Larga']].map(([n,w])=>`<option value="${n}"${settings.view===n?' selected':''}>${w}</option>`).join('')}</select></label><label class="setting">Resolución 3D<select data-setting="resolution">${[['low','Baja'],['auto','Normal'],['high','Alta']].map(([n,w])=>`<option value="${n}"${settings.resolution===n?' selected':''}>${w}</option>`).join('')}</select></label><label class="check"><input data-setting="mute" type="checkbox"${settings.mute?' checked':''}> Silencio total</label><label class="check"><input data-setting="reduced" type="checkbox"${settings.reduced?' checked':''}> Reducir movimiento y efectos</label></div>${buttons(['back','Volver',true])}`,
    inventory:()=> `<p>Pulsa un objeto para ponerlo en la casilla rápida ${state.selected+1}. Selecciona casilla con 1–8 o la rueda durante la partida.</p><div class="inventory">${Object.entries(state.bag).map(([id,n])=>`<button data-equip="${id}">${chip(id)}<span>${ITEMS[id].name} · ${n}</span></button>`).join('') || '<span>Mochila vacía.</span>'}</div><h3>Fabricación</h3><div class="recipes">${RECIPES.map((r,i)=>`<div class="recipe"><div><strong>${ITEMS[r.id].name}${r.count>1?` × ${r.count}`:''}</strong><small>${r.note}<br>${Object.entries(r.costs).map(([id,n])=>`${n} ${ITEMS[id].name}`).join(' · ')}</small></div><button data-recipe="${i}"${canCraft(state,r)?'':' disabled'}>Fabricar</button></div>`).join('')}</div>${buttons(['resume','Reanudar',true],['pause','Pausa'])}<p class="message" aria-live="polite"></p>`,
    credits:()=> `<p>Mundo, código, texturas, ilustración y sonido originales de <em>La Marea Hueca</em>. La música se sintetiza mientras juegas.</p><p>Three.js r180 · © Three.js Authors · licencia MIT incluida.</p><p><strong>Partidas locales</strong><br>Importa una copia JSON para trasladar tu mundo a otro navegador.</p><div class="panel-actions"><button data-action="import">Importar partida</button>${disk()?'<button data-action="export">Exportar partida</button>':''}<button data-action="back">Volver</button></div><input id="import-file" type="file" accept=".json,application/json" hidden><p class="message" aria-live="polite"></p>`
  };
  panel.innerHTML=body(name,templates[name]());
  if(!panel.open) panel.showModal();
  if(name==='new') $('seed').focus();
  if(name==='defeat') panel.querySelector('[data-action=recover]').focus();
}
function message(content) {
  const target=panel.querySelector('.message');
  if(target) target.textContent=content;
}
function closePanel() {
  panel.close();panelName='';
}
function cleanSave(raw) {
  try {
    if(!storage) throw new Error('El navegador bloqueó el guardado local. Exporta la partida desde Pausa.');
    if(storage.getItem(slot)!==currentRaw) throw new Error('Otra pestaña cambió la partida. Exporta esta sesión para conservarla.');
    storage.setItem(slot,raw);currentRaw=raw;
    lastSave=state.elapsed;writeFault=false;
    return true;
  } catch(error) {
    writeFault=true;
    if(panel.open) message(error.name==='QuotaExceededError'?'No queda espacio. Exporta la partida para conservarla.':error.message);
    else notify('No se pudo guardar. Puedes exportar desde la pausa.');
    return false;
  }
}
function save() {
  return state && cleanSave(encode(world,state,settings));
}
function download() {
  const raw=mode!=='front' && state?encode(world,state,settings):disk();
  if(!raw) {message('No hay una partida que exportar.');return;}
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
  const a=document.createElement('a');
  a.href=url;a.download='la-marea-hueca.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2500);
  message('Copia preparada para descargar.');
}
function menu() {
  if(mode==='defeat') recoverPlayer();
  if(state && mode!=='front' && !save() &&
      !window.confirm('La sesión no se pudo guardar. ¿Volver al menú con la última copia local?')) return;
  mode='front';session++;stop();closePanel();
  document.exitPointerLock?.();
  $('front').hidden=false;$('hud').hidden=true;$('loading').hidden=true;$('fatal').hidden=true;
  state=null;world=null;currentRaw=null;needClick=false;
  cover(canvas);refreshMenu();
}
function pause(text='') {
  if(!state || !['play','pause'].includes(mode)) return;
  pausedMessage=text;
  mode='pause';stop();
  if(document.pointerLockElement) document.exitPointerLock();
  show('pause');
}
function resume() {
  if(!state || mode==='defeat') return;
  sound.start();
  if(!view.renderer.domElement.requestPointerLock) {
    message('Este navegador no puede capturar el cursor.');
    return;
  }
  needClick=true;
  try {
    view.renderer.domElement.requestPointerLock()?.catch(()=>lockFailed());
  } catch {lockFailed();}
}
function lockFailed() {
  needClick=false;if(mode==='pause') message('El navegador no capturó el cursor. Pulsa de nuevo para reanudar.');
}
async function start(loaded,raw,entrance) {
  const ticket=++session;
  try {
    sound.start();
    if(!view) {
      view=new View($('stage'));
      view.renderer.domElement.addEventListener('webglcontextlost',event=>{
        event.preventDefault();
        if(mode==='play') pause('Se ha perdido la conexión gráfica.');
        notify('Contexto WebGL perdido. Espera a que se recupere o vuelve a abrir el juego.');
      });
    }
    ({world,state}=loaded);
    settings=loaded.settings;
    currentRaw=raw;revision=0;writeFault=false;lastSave=state.elapsed;lastBiome=-1;lastLow=false;damagePulse=0;
    $('damage-layer').style.opacity='0';$('notice').textContent='';
    mode='load';closePanel();$('front').hidden=true;$('hud').hidden=true;$('loading').hidden=false;
    view.resize(settings);view.start(world);
    view.stream(state.player,settings.view);chunk=chunkKey(state.player.x,state.player.z);
    const total=view.queue.length;
    for(let i=0;i<Math.min(total,9);i++) {
      await new Promise(requestAnimationFrame);
      if(ticket!==session) return;
      view.process();$('load-progress').value=i+1;
    }
    $('loading').hidden=true;$('hud').hidden=false;
    mode='pause';
    if(entrance) notify('Mantén el botón izquierdo para extraer. Usa E para abrir la mochila.',6);
    drawBar();
    drawHUD(null);
    const b=currentBiome(state.player), tide=forecast(state.elapsed);
    view.frame(state.player,null,1,state.elapsed,b,tide.low,settings,false);
    show('resume');
    if(entrance) save();
  } catch(error) {
    console.error(error);
    mode='front';closePanel();$('loading').hidden=true;$('hud').hidden=true;$('front').hidden=false;
    $('fatal').hidden=false;
    $('fatal').textContent=error.message==='WebGL 2 no está disponible.'
      ?'Este navegador no ofrece WebGL 2. Abre el juego en un navegador de escritorio con aceleración gráfica.'
      :'No se pudo abrir el mundo. Vuelve a cargar e inténtalo de nuevo.';
  }
}

function chip(id) {
  const icon={chisel:'◇',hook:'•',moss:'+'}[id]??'';
  return `<span class="chip" style="--item:${ITEMS[id].color}" aria-hidden="true">${icon}</span>`;
}
function drawBar() {
  if(!state) return;
  $('bar').innerHTML=state.bar.map((id,i)=>{
    const filled=id && state.bag[id], label=filled?ITEMS[id].name:'Vacío';
    return `<button class="slot${i===state.selected?' active':''}" data-slot="${i}" aria-label="${i+1}. ${label}" aria-pressed="${i===state.selected}" title="${label}"><span class="num">${i+1}</span>${filled?chip(id):''}<span class="qty">${filled && ITEMS[id].kind!=='tool'?state.bag[id]:''}</span></button>`;
  }).join('');
  const id=activeItem();
  $('tool-name').textContent=id?ITEMS[id].name:'Manos libres';
}
function activeItem() {
  const id=state.bar[state.selected];
  return id && state.bag[id]?id:null;
}
function direction(p) {
  return [-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)];
}
function angle(p) {
  const degrees=((Math.round(-p.yaw*180/Math.PI)%360)+360)%360;
  return ['N','NE','E','SE','S','SO','O','NO'][Math.round(degrees/45)%8]+' · '+String(degrees).padStart(3,'0')+'°';
}
function drawHUD(hit) {
  const p=state.player, b=BIOMES[currentBiome(p)], landmark=view.nearLandmark(p);
  $('biome').textContent=b.name;$('biome-material').textContent=b.note;
  $('coords').textContent=`X ${Math.floor(p.x)}  ·  Z ${Math.floor(p.z)}  ·  Y ${Math.floor(p.y)}`;
  $('bearing').textContent=angle(p);$('tide').textContent=forecast(state.elapsed).low?'BAJAMAR':'MAREA QUIETA';
  $('health').textContent=Math.ceil(p.health);$('healthbar').value=p.health;
  $('target').textContent=hit?BLOCKS[hit.block].name:'';
  $('mining').hidden=!mining || !hit || mined<=0;
  if(hit) $('mining').value=Math.min(1,mined/miningTime(hit.block,activeItem()));
  const missing=[!state.echoes.includes('spine')?'Oeste (−28, −5)':null,!state.echoes.includes('salt')?'Este (28, 1)':null].filter(Boolean);
  $('objective-title').textContent=state.finished?'El eco devuelto':'El eco bajo la piedra';
  $('objective-detail').textContent=state.finished?'Las aguas se retiraron. Tú eliges qué levantar ahora.':missing.length?`${state.echoes.length}/2 ecos · ${missing.join(' · ')}`:'Norte (0, −24) · Baja por el observatorio.';
  $('prompt').textContent=landmark?`F · Escuchar ${landmark.title}`:(activeItem()==='moss'?'F · Usar musgo vivo':'');
}
function damage(amount,text) {
  if(mode!=='play') return;
  const p=state.player;
  p.health=Math.max(0,p.health-amount);damagePulse=settings.reduced?.23:.78;
  sound.event('hurt');notify(text);
  if(p.health===0) {
    mode='defeat';stop();state.deaths++;
    document.exitPointerLock?.();show('defeat');
  }
}
function recoverPlayer() { recover(world,state);mode='pause';save();drawHUD(null); }
function changeBlock(cell,event,id) {
  view.change(affectedChunks(cell[0],cell[2]));
  view.burst(cell,settings.reduced);sound.event(event,BLOCKS[id].tone);
  revision++;drawBar();
}
function useAction() {
  const p=state.player,e=view.nearLandmark(p),id=activeItem();
  if(e) {
    const text=advanceEcho(state,e.id);
    sound.event('echo');notify(text??e.line,6);drawBar();return;
  }
  if(id==='moss' && p.health<100 && use(state,'moss')) {
    const heal=Math.min(24,100-p.health);p.health+=heal;notify('Musgo vivo · +'+Math.floor(heal)+' de salud.');sound.event('craft');drawBar();
  } else if(id==='hook' && view.scared(p,direction(p))) {
    sound.event('creature');notify('El gancho ahuyentó a la criatura.');
  }
}
function blockHit() {
  const p=state.player;
  return trace(world,[p.x,p.y+EYE,p.z],direction(p));
}
function placeAction() {
  const id=activeItem();
  const cell=place(world,state,blockHit(),id,(...p)=>view.mobOnBlock(...p));
  if(cell) changeBlock(cell,'place',Number(id));
}
function tick(now) {
  requestAnimationFrame(tick);
  const dt=clamp((now-last)/1000,0,.1);
  last=now;
  if(!state || mode==='front' || mode==='load') {lastFrame=0;sound.update(settings,55,0,false);return;}
  const p=state.player;
  if(mode!=='play') {lastFrame=0;sound.update(settings,BIOMES[currentBiome(p)].pitch,0,false);return;}
  physics+=dt;
  const moving=keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD')||
    keys.has('ArrowUp')||keys.has('ArrowDown')||keys.has('ArrowLeft')||keys.has('ArrowRight');
  const held=(a,b)=>keys.has(a)||keys.has(b);
  const pan=Number(keys.has('KeyJ'))-Number(keys.has('KeyL'));
  const tilt=Number(keys.has('KeyI'))-Number(keys.has('KeyK'));
  p.yaw=(p.yaw+pan*dt*1.6)%(Math.PI*2);
  p.pitch=clamp(p.pitch+tilt*dt*1.25,-1.54,1.54);
  while(physics>=1/120) {
    const move={x:+held('KeyD','ArrowRight')-held('KeyA','ArrowLeft'),z:+held('KeyW','ArrowUp')-held('KeyS','ArrowDown'),jump,sprint:held('ShiftLeft','ShiftRight')};
    const impacts=stepPlayer(world,p,move,1/120);
    jump=false;physics-=1/120;
    if(impacts) damage(impacts,'La caída te ha hecho daño.');
    if(mode!=='play') return;
  }
  const current=chunkKey(p.x,p.z);
  if(chunk!==current) {chunk=current;view.stream(p,settings.view);}
  view.process();
  const hit=blockHit(), id=activeItem();
  if(mining && hit) {
    const k=String(hit.cell);
    if(k!==mineKey) {mineKey=k;mined=0;}
    mined+=dt;
    if(mined>=miningTime(hit.block,id)) {
      if(mine(world,state,hit)) changeBlock(hit.cell,'mine',hit.block);
      else notify('No se puede extraer: mochila llena o límite de cambios.');
      mined=0;mining=false;
    }
  } else {mined=0;mineKey='';}
  state.elapsed+=dt;
  const b=currentBiome(p), tide=forecast(state.elapsed);
  if(lastBiome>=0 && b!==lastBiome) notify(BIOMES[b].name);
  if(!lastLow && tide.low) notify('Bajamar. Las raspaduras salen más lejos.');
  lastBiome=b;lastLow=tide.low;
  danger=view.creatures(dt,p,state.elapsed,tide.low,damage,()=>{
    sound.event('creature');notify('Oyes una raspadura cerca.');
  },settings.reduced);
  if(mode!=='play') return;
  stepClock+=dt;
  if(moving && p.ground && stepClock>(held('ShiftLeft','ShiftRight')?.29:.42)) {
    stepClock=0;
    const floor=world.get(Math.floor(p.x),Math.floor(p.y-.04),Math.floor(p.z));
    sound.event('step',BLOCKS[floor]?.tone??110);
  }
  sound.update(settings,BIOMES[b].pitch,Math.max(danger,tide.low?.22:0),true);
  if(damagePulse>0) {damagePulse=Math.max(0,damagePulse-dt*1.8);$('damage-layer').style.opacity=damagePulse.toFixed(2);}
  if(now>lastToast && $('notice').textContent) $('notice').textContent='';
  if(now-uiClock>67) {uiClock=now;drawHUD(hit);}
  if(state.elapsed-lastSave>18 && !writeFault) save();
  view.frame(p,hit,dt,state.elapsed,b,tide.low,settings,moving);
  if(qa) recordFrame(now,dt);
}
function settingsChange(el) {
  const key=el.dataset.setting;
  if(!key) return;
  const value=el.type==='checkbox'?el.checked:['view','music','effects','sensitivity'].includes(key)?Number(el.value):el.value;
  settings=safeSettings({...settings,[key]:value});
  storeSettings();
  if(state && view) {
    if(key==='resolution') view.resize(settings);
    if(key==='view') {
      view.stream(state.player,settings.view);
      if(view.queue.length) view.process();
    }
  }
  sound.update(settings,55,0,false);
}

$('new').addEventListener('click',()=>show('new'));
$('continue').addEventListener('click',()=>{
  try {
    const raw=disk();
    if(raw) start(decode(raw),raw,false);
  } catch(error) {
    show('credits');message(error.message+' La copia local se puede exportar.');
  }
});
$('front').addEventListener('click',event=>{
  const name=event.target.closest('[data-open]')?.dataset.open;
  if(name) {previousPanel='front';show(name);}
});
panel.addEventListener('cancel',event=>{event.preventDefault();back();});
panel.addEventListener('input',event=>settingsChange(event.target));
function back() {
  if(mode==='defeat') return;
  if(mode==='front') {closePanel();return;}
  if(panelName==='settings') {show(previousPanel==='front'?'pause':previousPanel);return;}
  if(panelName==='inventory') {show('pause');return;}
  resume();
}
panel.addEventListener('submit',event=>{
  if(event.target.id!=='seed-form') return;
  event.preventDefault();
  const seed=$('seed').value.trim();
  if(!seed) {message('Escribe una semilla con al menos un carácter.');return;}
  if(disk()!==seenAtCreation) {
    show('new');$('seed').value=seed;
    message('Otra pestaña cambió la partida. Revisa la ranura antes de sustituirla.');
    return;
  }
  const newWorld=new World(seed);
  start({world:newWorld,state:newState(newWorld),settings},seenAtCreation,true);
});
panel.addEventListener('click',event=>{
  const target=event.target.closest('button');
  if(!target) return;
  const action=target.dataset.action;
  if(action==='random') $('seed').value='MAREA-'+crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
  if(action==='back') back();
  if(action==='resume') resume();
  if(action==='pause') show('pause');
  if(action==='menu') menu();
  if(action==='save' && save()) message('Partida guardada en este navegador.');
  if(action==='inventory') show('inventory');
  if(action==='settings') {previousPanel=panelName;show('settings');}
  if(action==='export') download();
  if(action==='import') $('import-file').click();
  if(action==='recover') {recoverPlayer();show('resume');}
  if(target.dataset.equip && equip(state,target.dataset.equip)) {
    drawBar();message(`${ITEMS[target.dataset.equip].name} en la casilla ${state.selected+1}.`);
  }
  if(target.dataset.recipe!==undefined) {
    const r=RECIPES[Number(target.dataset.recipe)];
    if(craft(state,r)) {sound.event('craft');drawBar();show('inventory');message('Fabricado: '+ITEMS[r.id].name+'.');}
  }
});
panel.addEventListener('change',async event=>{
  if(event.target.id!=='import-file') return;
  const file=event.target.files?.[0];
  if(!file) return;
  try {
    if(file.size>2_100_000) throw new Error('El archivo excede el tamaño permitido.');
    const raw=await file.text(), loaded=decode(raw), previous=disk();
    if(previous && !window.confirm('¿Sustituir la partida local por la copia importada?')) return;
    if(disk()!==previous) throw new Error('La partida local cambió en otra pestaña.');
    const validated=encode(loaded.world,loaded.state,loaded.settings);
    storage.setItem(slot,validated);
    refreshMenu();message('Partida importada. Usa Continuar para abrirla.');
  } catch(error) {message(error.message);}
  finally {event.target.value='';}
});
$('pause').addEventListener('click',()=>pause());
$('bar').addEventListener('click',event=>{
  const value=event.target.closest('[data-slot]')?.dataset.slot;
  if(value!==undefined && state && mode==='play') {select(state,Number(value));drawBar();}
});
document.addEventListener('pointerlockchange',()=>{
  if(view && document.pointerLockElement===view.renderer.domElement && state && mode==='pause' && needClick) {
    needClick=false;closePanel();mode='play';lockTime=performance.now();stop();pausedMessage='';return;
  }
  if(mode==='play' && !document.pointerLockElement) pause();
  if(mode!=='play' && document.pointerLockElement && !needClick) document.exitPointerLock();
});
document.addEventListener('pointerlockerror',lockFailed);
window.addEventListener('blur',()=>{if(mode==='play') pause('La ventana perdió el foco.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden && mode==='play') pause('Has cambiado de pestaña.');});
window.addEventListener('pagehide',()=>{if(state && mode!=='load') save();});
window.addEventListener('storage',event=>{
  if(event.key===slot && mode==='front') refreshMenu();
});
window.addEventListener('resize',()=>{
  if(mode==='front') cover(canvas);
  if(view) view.resize(settings);
});
document.addEventListener('keydown',event=>{
  if(mode!=='play') return;
  const code=event.code;
  if(code==='Tab') {event.preventDefault();return;}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code)) event.preventDefault();
  keys.add(code);
  if(event.repeat) return;
  if(code==='Space') jump=true;
  if(code==='Escape' || code==='KeyP') pause();
  if(code==='KeyE') show('inventory');
  if(code==='KeyF') useAction();
  if(code==='KeyM') {mining=true;mined=0;mineKey='';}
  if(code==='KeyN') placeAction();
  if(/^Digit[1-8]$/.test(code)) {select(state,Number(code.at(-1))-1);drawBar();}
});
document.addEventListener('keyup',event=>{
  keys.delete(event.code);
  if(event.code==='KeyM') mining=false;
});
document.addEventListener('mousemove',event=>{
  if(mode!=='play' || document.pointerLockElement!==view.renderer.domElement || performance.now()-lockTime<200) return;
  const p=state.player,s=.00048+settings.sensitivity*.000037;
  p.yaw=(p.yaw-event.movementX*s)%(Math.PI*2);
  p.pitch=clamp(p.pitch-event.movementY*s,-1.54,1.54);
});
document.addEventListener('pointerdown',event=>{
  if(mode!=='play' || document.pointerLockElement!==view.renderer.domElement) return;
  if(event.button===0) {mining=true;mined=0;mineKey='';}
  if(event.button===2) placeAction();
});
document.addEventListener('pointerup',event=>{if(event.button===0) mining=false;});
document.addEventListener('contextmenu',event=>{if(mode==='play') event.preventDefault();});
document.addEventListener('wheel',event=>{
  if(mode!=='play' || !event.deltaY) return;
  event.preventDefault();select(state,state.selected+Math.sign(event.deltaY));drawBar();
},{passive:false});

const measurements=[];
let lastFrame=0;
function recordFrame(now,dt) {
  if(lastFrame && dt>0) {
    measurements.push(now-lastFrame);
    if(measurements.length>1600) measurements.shift();
  }
  lastFrame=now;
}
if(qa) {
  // Observación de QA. Las pruebas cambian el juego con sus controles normales.
  window.mareaQA=Object.freeze({
    state:()=>state?{mode,player:{...state.player},seed:world.seed,bag:{...state.bag},revision,
      edits:[...world.edits],echoes:[...state.echoes],finished:state.finished,biome:currentBiome(state.player),
      elapsed:state.elapsed,deaths:state.deaths,selected:state.selected,
      chunks:view.meshes.size,todo:view.queue.length,locked:document.pointerLockElement?.id??null,
      target:blockHit(),saved:!!disk(),renderer:view.renderer.getContext().getParameter(view.renderer.getContext().VERSION),
      glError:view.renderer.getContext().getError(), calls:view.renderer.info.render.calls,
      triangles:view.renderer.info.render.triangles,
      creatures:view.mobs.map(({kind,x,y,z})=>({kind,x,y,z}))}:{mode},
    frames:()=>measurements.slice(),
    clearFrames:()=>{measurements.length=0;lastFrame=0;}
  });
}
cover(canvas);refreshMenu();
requestAnimationFrame(tick);
