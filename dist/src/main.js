import {GamepadInput, PAD} from './gamepad.js';
import {cachePosition, nearestSignal} from './settlements.js';
import {SITES, nearbySite, discover} from './expeditions.js';
import {World, BLOCKS, BIOMES, DEFAULT_SEED, LANDMARKS, HALF, affectedChunks, chunkKey, clamp} from './world.js';
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
const gamepad=new GamepadInput();
let input='keyboard',padSession=false,padMining=false;
const keyboardHelp=$('quick-help').innerHTML;
function inputMethod(method) {
  if(input===method) return;
  input=method;
  $('quick-help').innerHTML=method==='pad'
    ?'<span><kbd>Stick izq.</kbd> Mover</span><span><kbd>Stick der.</kbd> Mirar</span><span><kbd>A</kbd> Saltar</span><span><kbd>RT</kbd> Minar</span><span><kbd>LT</kbd> Colocar</span><span><kbd>X</kbd> Usar</span><span><kbd>Y</kbd> Mochila</span><span><kbd>Menú</kbd> Pausa</span>'
    :keyboardHelp;
  document.documentElement.classList.toggle('using-pad',method==='pad');
}
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
  journal:['EXPEDICIONES','Cuaderno de campo'],
  credits:['LA MAREA HUECA','Créditos'],
  guide:['MANUAL DE CAMPO','Antes de entrar'],
  defeat:['REGRESO A LA COSTRA','El eco te ha encontrado'],
  resume:['PARTIDA LISTA','Vuelve a la cuenca']
};
function body(title,html) { const [eyebrow,heading]=contents[title]; return `<div class="panel-inner"><div class="panel-header"><div><small>${eyebrow}</small><h2 id="panel-title">${heading}</h2></div><button data-action="back" aria-label="Cerrar">×</button></div>${html}</div>`; }
function buttons(...values) {return '<div class="panel-actions">'+values.map(([action,label,primary])=>`<button data-action="${action}"${primary?' class="primary"':''}>${label}</button>`).join('')+'</div>';}
function disk() {try{return storage?.getItem(slot)??null;}catch{return null;}}
function notify(message,seconds=3.7,kind='info') {
  $('notice').dataset.kind=kind;
  $('notice').textContent=message;
  lastToast=performance.now()+seconds*1000;
}
function syncMotion() { document.documentElement.classList.toggle('reduced-motion',settings.reduced); }
syncMotion();
function storeSettings() {
  syncMotion();try{storage.setItem(settingsSlot,JSON.stringify(settings));}catch{} }
function refreshMenu() {
  const saved=!!disk(), playable=controls();
  $('continue').disabled=!saved || !playable; $('new').disabled=!playable;
  $('continue').title=!playable?'Se necesita teclado y ratón':saved?'Abrir la partida local':'Todavía no hay una partida guardada';
  $('save-status').textContent=!playable?'La cuenca se juega con teclado y ratón. Puedes consultar ajustes y controles.':saved?'◆ Partida local disponible · Continuar abre tu último mundo':'◇ Sin partida local · Crea un mundo para comenzar';
}
function stop() {
  keys.clear(); padMining=false;mining=false;mined=0;jump=false;mineKey='';physics=0;
  if(state) state.player.vx=state.player.vz=0;
}
function inventorySelection() {
  for(const button of panel.querySelectorAll('[data-equip]')) {
    button.setAttribute('aria-pressed',String(button.dataset.equip===activeItem()));
  }
}

function show(name) {
  if(name==='new') seenAtCreation=disk();
  panelName=name;
  if(mode==='play') {mode='pause';stop();sound.update(settings,false);document.exitPointerLock?.();}
  panel.setAttribute('aria-labelledby','panel-title');
  const templates={
    new:()=> `<form class="form-grid" id="seed-form"><label for="seed">Semilla del mundo</label><input type="text" id="seed" maxlength="64" required value="${DEFAULT_SEED}" spellcheck="false" autocomplete="off"><p>La misma semilla reconstruye el mismo terreno. ${disk()?'Ya hay una partida en esta ranura. Puedes descargarla antes de sustituirla.':'Empiezas en La Costra, frente al observatorio.'}</p>${disk()?'<label class="check"><input id="replace-save" type="checkbox" required> Sustituir la partida local</label>':''}<div class="panel-actions"><button type="submit" class="primary">Entrar en la cuenca</button><button data-action="random" type="button">Otra semilla</button>${disk()?'<button data-action="export" type="button">Exportar partida actual</button>':''}</div></form><p class="message"></p>`,
    pause:()=> `<p>${pausedMessage || 'La cuenca se detiene mientras estás en pausa.'}</p><p class="panel-hint">El regreso al menú guarda el mundo. Exporta una copia si quieres trasladarlo.</p>${buttons(['resume','Reanudar',true],['save','Guardar'],['inventory','Mochila'],['journal','Cuaderno'],['settings','Ajustes'],['guide','Controles'],['export','Exportar partida'],['menu','Volver al menú'])}<p class="message" aria-live="polite"></p>`,
    resume:()=> `<p>Usa el ratón o I J K L para mirar. Puedes minar con M y colocar con N. Escape libera el cursor. Con mando, pulsa Menú para entrar sin capturarlo.</p>${buttons(['resume','Capturar cursor',true],['menu','Volver al menú'])}<p class="message" aria-live="polite"></p>`,
    defeat:()=> `<p>Regresarás junto al observatorio con la mochila y tus construcciones. El mundo conserva tu recorrido.</p>${buttons(['recover','Regresar a La Costra',true])}`,
    journal:()=> {
      const settlements=world.settlements.map(site=>{
        const found=state.discoveries.includes(site.id);
        return `<section class="journal-entry"><strong>${site.title}</strong><small>${site.biome} · X ${site.x+site.entrance} · Z ${site.z+site.depth-1}</small><p>${found?site.note:'Busca los suministros bajo el marcador y usa F o X.'}</p></section>`;
      }).join('');
      const landmarks=SITES.map(site=>{
        const found=state.discoveries.includes(site.id);
        return `<section class="journal-entry"><strong>${found?site.title:'Baliza por examinar'}</strong><small>X ${site.x} · Z ${site.z}</small>${found?`<p>${site.line}</p>`:''}</section>`;
      }).join('');
      const count=SITES.filter(site=>state.discoveries.includes(site.id)).length;
      return `<p>${count}/${SITES.length} hallazgos. Examina las balizas con F o X.</p><div class="rows">${landmarks}</div><h3>Asentamientos</h3><div class="rows">${settlements || '<p>La cuenca conserva tus construcciones en los emplazamientos candidatos.</p>'}</div>${buttons(['resume','Reanudar',true],['pause','Pausa'])}`;
    },
    settings:()=> `<div class="form-grid"><h3>Escucha y mirada</h3>${[['music','Música'],['effects','Efectos'],['sensitivity','Sensibilidad del ratón'],['padSensitivity','Sensibilidad del mando'],['deadzone','Zona muerta del mando (%)']].map(([k,n])=>`<label class="setting">${n}<input data-setting="${k}" type="range" min="${k==='deadzone'?10:0}" max="${k==='deadzone'?40:100}" value="${settings[k]}"></label>`).join('')}<h3>Imagen y comodidad</h3><label class="setting">Distancia de visión<select data-setting="view">${[[2,'Corta'],[3,'Normal'],[4,'Larga']].map(([n,w])=>`<option value="${n}"${settings.view===n?' selected':''}>${w}</option>`).join('')}</select></label><label class="setting">Resolución 3D<select data-setting="resolution">${[['low','Baja'],['auto','Normal'],['high','Alta']].map(([n,w])=>`<option value="${n}"${settings.resolution===n?' selected':''}>${w}</option>`).join('')}</select></label><label class="check"><input data-setting="mute" type="checkbox"${settings.mute?' checked':''}> Silencio total</label><label class="check"><input data-setting="reduced" type="checkbox"${settings.reduced?' checked':''}> Reducir movimiento y efectos</label></div>${buttons(['back','Volver',true])}`,
    guide:()=> `<p>Construye a tu ritmo. Los ecos y los asentamientos son descubrimientos opcionales.</p><div class="control-grid"><div><kbd>W A S D</kbd><span>Moverse</span></div><div><kbd>ESPACIO</kbd><span>Saltar</span></div><div><kbd>RATÓN / I J K L</kbd><span>Mirar</span></div><div><kbd>IZQ / M</kbd><span>Extraer</span></div><div><kbd>DER / N</kbd><span>Colocar</span></div><div><kbd>F</kbd><span>Usar o escuchar</span></div><div><kbd>1–8 / RUEDA</kbd><span>Elegir casilla</span></div><div><kbd>E / C</kbd><span>Mochila / cuaderno</span></div><div><kbd>ESC / P</kbd><span>Pausa y cursor</span></div></div><p class="panel-hint">Música, efectos, sensibilidad y movimiento reducido se ajustan en Ajustes.</p><h3>Mando con mapa estándar</h3><p>Palanca izquierda: mover. Derecha: mirar. A: saltar. RT: extraer. LT: colocar. X: usar. Y: mochila. LB/RB: barra rápida. Pulsar palanca izquierda: correr. Vista: cuaderno. Menú: pausa.</p><p>En los menús, usa la cruceta o la palanca izquierda para recorrer los controles, A para aceptar y B para volver. Usa teclado para escribir una semilla.</p>${buttons(['back','Volver',true])}`,
    inventory:()=> `<p>Pulsa un objeto para ponerlo en la casilla rápida ${state.selected+1}. Selecciona casilla con 1–8 o la rueda durante la partida.</p><div class="inventory">${Object.entries(state.bag).map(([id,n])=>`<button data-equip="${id}">${chip(id)}<span>${ITEMS[id].name} · ${n}${ITEMS[id].note?`<small>${ITEMS[id].note}</small>`:''}</span></button>`).join('') || '<span>Mochila vacía.</span>'}</div><h3>Fabricación</h3><div class="recipes">${RECIPES.map((r,i)=>`<div class="recipe"><div><strong>${ITEMS[r.id].name}${r.count>1?` × ${r.count}`:''}</strong><small>${r.note}<br>${Object.entries(r.costs).map(([id,n])=>`${ITEMS[id].name} ${state.bag[id]??0}/${n}`).join(' · ')}</small></div><button data-recipe="${i}"${canCraft(state,r)?'':' disabled'}>Fabricar</button></div>`).join('')}</div>${buttons(['resume','Reanudar',true],['pause','Pausa'])}<p class="message" aria-live="polite"></p>`,
    credits:()=> `<p>Mundo, código, texturas, ilustración y sonido originales de <em>La Marea Hueca</em>. La música se sintetiza mientras juegas.</p><p>Three.js r180 · © Three.js Authors · licencia MIT incluida.</p><p><strong>Partidas locales</strong><br>Importa una copia JSON para trasladar tu mundo a otro navegador.</p><div class="panel-actions"><button data-action="import">Importar partida</button>${disk()?'<button data-action="export">Exportar partida</button>':''}<button data-action="back">Volver</button></div><input id="import-file" type="file" accept=".json,application/json" hidden><p class="message" aria-live="polite"></p>`
  };
  panel.innerHTML=body(name,templates[name]());
  if(!panel.open) panel.showModal();
  panel.scrollTop=0;
  if(name==='inventory') inventorySelection();
  panel.querySelector('[data-action=back]').focus({preventScroll:true});
  if(name==='new') (input==='pad'?panel.querySelector('[type=submit]'):$('seed')).focus();
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
    $('save-state').textContent='Guardado local';
    return true;
  } catch(error) {
    writeFault=true;
    $('save-state').textContent='Guardado fallido';
    if(panel.open) message(error.name==='QuotaExceededError'?'No queda espacio. Exporta la partida para conservarla.':error.message);
    else notify('No se pudo guardar. Puedes exportar desde la pausa.');
    return false;
  }
}
function save() {
  if(!state) return false;
  $('save-state').textContent='Guardando…';
  return cleanSave(encode(world,state,settings));
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
  mode='front';session++;stop();sound.resetScore();closePanel();
  document.exitPointerLock?.();
  $('front').hidden=false;$('hud').hidden=true;$('loading').hidden=true;$('fatal').hidden=true;
  state=null;world=null;currentRaw=null;needClick=false;
  cover(canvas);refreshMenu();
}
function pause(text='') {
  if(!state || !['play','pause'].includes(mode)) return;
  pausedMessage=text;
  mode='pause';stop();sound.update(settings,false);
  if(document.pointerLockElement) document.exitPointerLock();
  show('pause');
}
function resume(withPad=false) {
  if(!state || mode==='defeat') return;
  if(withPad) {
    needClick=false;padSession=true;stop();closePanel();mode='play';pausedMessage='';
    return;
  }
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
    sound.resetScore();
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
    syncMotion();
    $('save-state').textContent=raw?'Guardado local':'Sin guardar';
    currentRaw=raw;revision=0;writeFault=false;lastSave=state.elapsed;lastBiome=-1;lastLow=false;damagePulse=0;
    $('damage-layer').style.opacity='0';$('notice').textContent='';
    mode='load';closePanel();$('front').hidden=true;$('hud').hidden=true;$('loading').hidden=false;
    view.resize(settings);view.start(world);
    view.updateWard(state.ward,state.elapsed);
    view.stream(state.player,settings.view);chunk=chunkKey(state.player.x,state.player.z);
    const total=view.queue.length;
    for(let i=0;i<Math.min(total,9);i++) {
      await new Promise(requestAnimationFrame);
      if(ticket!==session) return;
      view.process();$('load-progress').value=i+1;
    }
    $('loading').hidden=true;$('hud').hidden=false;
    mode='pause';
    if(entrance) notify('Orientación inicial · El observatorio está al norte. Puedes construir desde aquí.',6);
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
  const icon={chisel:'◇',hook:'•',moss:'+',needle:'↟',saltlance:'↑',ward:'✧'}[id]??'';
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
  const cache=nearbyCache(p), nearbyDiscovery=nearbySite(world,p);
  $('prompt').textContent=(cache?`F · Abrir suministros: ${cache.title}`:landmark?`F · Escuchar ${landmark.title}`:nearbyDiscovery?`F · Examinar ${nearbyDiscovery.title}`:({hook:'F · Ahuyentar con el gancho',moss:'F · Usar musgo vivo',needle:'F · Buscar una señal',
      saltlance:'F · Ahuyentar con sal violeta',ward:'F · Activar protección'})[activeItem()]??'').replace(/^F ·/,input==='pad'?'X ·':'F ·');
}
function damage(amount,text) {
  if(mode!=='play') return;
  const p=state.player;
  p.health=Math.max(0,p.health-amount);damagePulse=settings.reduced?.23:.78;
  sound.event('hurt');notify(text,3.7,'danger');
  if(p.health===0) {
    mode='defeat';stop();sound.update(settings,false);state.deaths++;
    document.exitPointerLock?.();show('defeat');
  }
}
function recoverPlayer() { recover(world,state);mode='pause';save();drawHUD(null); }
function changeBlock(cell,event,id) {
  view.change(affectedChunks(cell[0],cell[2]));
  view.updatePlants(cell[0],cell[2]);
  view.burst(cell,settings.reduced,event==='place',id);
  sound.event(event,BLOCKS[id].tone);
  if(!$('notice').textContent || $('notice').dataset.kind==='edit') {
    notify(`${event==='place'?'Colocado':'Recogido'} · ${BLOCKS[id].name}`,1.4,'edit');
  }
  revision++;drawBar();
}
function nearbyCache(p) {
  return world.settlements.find(site=>{
    const target=cachePosition(site);
    const origin=[p.x,p.y+EYE,p.z];
    const delta=target.map((coord,i)=>coord-origin[i]);
    const distance=Math.hypot(...delta);
    if(distance>=2.75) return false;
    const hit=trace(world,origin,delta.map(d=>d/(distance||1)),distance);
    return !hit || hit.cell.every((coord,i)=>coord===Math.floor(target[i]));
  });
}

function useSpecial(id,p) {
  if(id==='needle') {
    if(state.needleReady>state.elapsed) {notify('La aguja aún está recuperando la señal.');return;}
    const signal=nearestSignal(world,state,LANDMARKS);
    if(!signal) {notify('La aguja no detecta ecos ni suministros pendientes.');return;}
    state.needleReady=state.elapsed+8;
    sound.event('echo');
    notify(`Aguja · ${signal.heading}, ${signal.distance} bloques · ${signal.title}`,6);
  } else if(id==='saltlance') {
    if(!state.bag[5]) {notify('Necesitas una unidad de sal violeta.');return;}
    if(!view.scared(p,direction(p),5,'rasp')) {notify('Apunta a una raspadura visible a menos de 5 bloques.');return;}
    use(state,'5');
    sound.event('creature');
    notify('Lanza de sal · La raspadura se retira.');
    drawBar();
  } else if(id==='ward') {
    if(state.ward?.until>state.elapsed) {notify('Ya hay un umbral activo.');return;}
    if(!p.ground) {notify('Pisa suelo firme para activar el umbral.');return;}
    use(state,'ward');
    state.ward={x:p.x,y:p.y,z:p.z,until:state.elapsed+14};
    view.updateWard(state.ward,state.elapsed);
    sound.event('ward');
    notify('Umbral activo · Radio de 4,5 bloques durante 14 s.');
    drawBar();
  }
}

function useAction() {
  const p=state.player,e=view.nearLandmark(p),id=activeItem();
  const cache=nearbyCache(p);
  if(cache) {
    if(state.discoveries.includes(cache.id)) {notify(cache.note,7);return;}
    if(!discover(state,cache,gain)) {notify('Libera espacio en la mochila para recoger los suministros.');return;}
    sound.event('supply');
    sound.discovery();
    notify(`Suministros recogidos · ${cache.title}. Consulta el cuaderno.`,6,'find');
    drawBar();
    return;
  }
  if(e) {
    const previous=state.echoes.length, finished=state.finished;
    const text=advanceEcho(state,e.id);
    if(state.echoes.length!==previous || state.finished!==finished) sound.discovery();
    sound.event('echo');notify(text??e.line,6);drawBar();return;
  }
  const site=nearbySite(world,p);
  if(site) {
    const found=state.discoveries.includes(site.id);
    if(found || discover(state,site,gain)) {
      notify(site.line,7);
      if(!found) {sound.event('echo');sound.discovery();drawBar();}
    } else notify('Libera espacio en la mochila para recoger el hallazgo.');
    return;
  }
  if(id==='moss' && p.health<100 && use(state,'moss')) {
    const heal=Math.min(24,100-p.health);p.health+=heal;notify('Musgo vivo · +'+Math.floor(heal)+' de salud.');sound.event('craft');drawBar();
  } else if(id==='hook' && view.scared(p,direction(p))) {
    sound.event('creature');notify('El gancho ahuyentó a la criatura.');
  } else useSpecial(id,p);
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
function handlePad(now) {
  let devices=[];
  try { devices=navigator.getGamepads?.() ?? []; } catch {}
  const oldIndex=gamepad.index;
  const pad=gamepad.poll(devices,settings.deadzone/100,now);
  if(oldIndex!==gamepad.index && oldIndex!==null) {
    if(padMining) {mining=false;padMining=false;}
    if(mode==='play' && padSession) pause('El mando se ha desconectado. Reconéctalo o reanuda con teclado y ratón.');
  }
  if(!pad) {
    if(input==='pad') inputMethod('keyboard');
    return null;
  }
  if(pad.active) inputMethod('pad');
  if(mode==='play') {
    if(pad.pressed(PAD.pause)) pause();
    else if(pad.pressed(PAD.bag)) show('inventory');
    else if(pad.pressed(PAD.journal)) show('journal');
    if(mode!=='play') return null;
    if(pad.pressed(PAD.accept)) jump=true;
    if(pad.pressed(PAD.use)) useAction();
    if(pad.pressed(PAD.place)) placeAction();
    if(pad.pressed(PAD.mine)) {padMining=true;mining=true;mined=0;mineKey='';}
    if(padMining && !pad.held[PAD.mine]) {padMining=false;mining=false;}
    const step=Number(pad.pressed(PAD.next))-Number(pad.pressed(PAD.previous));
    if(step) {select(state,state.selected+step);drawBar();}
    return pad;
  }
  if(mode==='load') return null;
  if(pad.pressed(PAD.pause) && mode==='pause' && ['pause','resume'].includes(panelName)) {
    resume(true);
    return null;
  }
  if(pad.pressed(PAD.back) && panel.open) {
    back(true);
    return null;
  }
  const scope=panel.open?panel:$('front');
  const focusable=Array.from(scope.querySelectorAll('button:not(:disabled),input:not([hidden]):not(:disabled),select:not(:disabled)'));
  const focused=document.activeElement;
  const index=focusable.indexOf(focused);
  const nav=pad.navigation;
  if(nav && focusable.length) {
    const step=nav===PAD.up || nav===PAD.left?-1:1;
    if(index>=0 && (nav===PAD.left || nav===PAD.right) && (focused.type==='range' || focused.tagName==='SELECT')) {
      if(focused.type==='range') focused.stepUp(step*(focused.dataset.setting==='deadzone'?1:5));
      else focused.selectedIndex=clamp(focused.selectedIndex+step,0,focused.options.length-1);
      settingsChange(focused);
    } else {
      const next=index<0?0:(index+step+focusable.length)%focusable.length;
      focusable[next].focus();
    }
  }
  if(pad.pressed(PAD.accept)) {
    const target=focusable.includes(document.activeElement)?document.activeElement:focusable[0];
    if(target?.dataset.action==='resume' || (target?.dataset.action==='back' && ['pause','resume'].includes(panelName))) resume(true);
    else if(target?.matches('button,input[type=checkbox]')) target.click();
    else target?.focus();
  }
  return null;
}
function tick(now) {
  requestAnimationFrame(tick);
  const dt=clamp((now-last)/1000,0,.1);
  last=now;
  const wasPlaying=mode==='play';
  const pad=!document.hidden && document.hasFocus()?handlePad(now):null;
  if(!wasPlaying && mode==='play') return;
  if(!state || mode==='front' || mode==='load') {lastFrame=0;sound.update(settings,false);return;}
  const p=state.player;
  if(mode!=='play') {lastFrame=0;sound.update(settings,false);return;}
  physics+=dt;
  const moving=Boolean(pad?.move.some(Boolean)) || keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD')||
    keys.has('ArrowUp')||keys.has('ArrowDown')||keys.has('ArrowLeft')||keys.has('ArrowRight');
  const held=(a,b)=>keys.has(a)||keys.has(b);
  const pan=Number(keys.has('KeyJ'))-Number(keys.has('KeyL'));
  const tilt=Number(keys.has('KeyI'))-Number(keys.has('KeyK'));
  const padLook=.45+settings.padSensitivity*.032;
  p.yaw=(p.yaw+dt*(pan*1.6-(pad?.look[0]??0)*padLook))%(Math.PI*2);
  p.pitch=clamp(p.pitch+dt*(tilt*1.25-(pad?.look[1]??0)*padLook*.78),-1.54,1.54);
  const sprint=held('ShiftLeft','ShiftRight') || Boolean(pad?.held[PAD.sprint]);
  while(physics>=1/120) {
    const move={x:+held('KeyD','ArrowRight')-held('KeyA','ArrowLeft')+(pad?.move[0]??0),z:+held('KeyW','ArrowUp')-held('KeyS','ArrowDown')-(pad?.move[1]??0),jump,sprint};
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
  if(state.ward && state.ward.until<=state.elapsed) state.ward=null;
  view.updateWard(state.ward,state.elapsed);
  const b=currentBiome(p), tide=forecast(state.elapsed);
  if(lastBiome>=0 && b!==lastBiome) notify(BIOMES[b].name);
  if(!lastLow && tide.low) notify('Bajamar. Las raspaduras salen más lejos.');
  lastBiome=b;lastLow=tide.low;
  danger=view.creatures(dt,p,state.elapsed,tide.low,damage,charging=>{
    sound.event(charging?'charge':'creature');
    notify(charging?'La raspadura va a embestir.':'Hay una raspadura cerca.',3.7,'danger');
  },settings.reduced);
  if(mode!=='play') return;
  stepClock+=dt;
  if(moving && p.ground && stepClock>(sprint?.29:.42)) {
    stepClock=0;
    const floor=world.get(Math.floor(p.x),Math.floor(p.y-.04),Math.floor(p.z));
    sound.event('step',BLOCKS[floor]?.tone??110);
  }
  const beneathObservatory=p.y<17 && Math.abs(p.x)<10 && p.z<-9 && p.z>-34;
  sound.update(settings,true,beneathObservatory?3:b,danger,tide.low);
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
  const value=el.type==='checkbox'?el.checked:['view','music','effects','sensitivity','padSensitivity','deadzone'].includes(key)?Number(el.value):el.value;
  settings=safeSettings({...settings,[key]:value});
  storeSettings();
  if(state && view) {
    if(key==='resolution') view.resize(settings);
    if(key==='view') {
      view.stream(state.player,settings.view);
      if(view.queue.length) view.process();
    }
  }
  sound.update(settings,false);
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
function back(withPad=false) {
  if(mode==='defeat') return;
  if(mode==='front') {closePanel();return;}
  if(panelName==='settings' || panelName==='guide') {if(previousPanel==='front') closePanel(); else show(previousPanel);return;}
  if(['inventory','journal'].includes(panelName)) {show('pause');return;}
  resume(withPad);
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
  if(action==='journal') show('journal');
  if(action==='settings' || action==='guide') {previousPanel=panelName;show(action);}
  if(action==='export') download();
  if(action==='import') $('import-file').click();
  if(action==='recover') {recoverPlayer();show('resume');}
  if(target.dataset.equip && equip(state,target.dataset.equip)) {
    drawBar();inventorySelection();message(`${ITEMS[target.dataset.equip].name} en la casilla ${state.selected+1}.`);
  }
  if(target.dataset.recipe!==undefined) {
    const r=RECIPES[Number(target.dataset.recipe)];
    if(craft(state,r)) {
      const scroll=panel.scrollTop;
      sound.event('craft');drawBar();show('inventory');
      panel.scrollTop=scroll;
      const recipe=panel.querySelector(`[data-recipe="${target.dataset.recipe}"]`);
      (recipe.disabled?panel.querySelector('[data-equip="'+r.id+'"]'):recipe)?.focus({preventScroll:true});
      message('Fabricado: '+ITEMS[r.id].name+'.');
    }
  }
});
panel.addEventListener('change',async event=>{
  if(event.target.id!=='import-file') return;
  const file=event.target.files?.[0];
  if(!file) return;
  try {
    message('Validando la copia…');
    if(file.size>2_100_000) throw new Error('El archivo excede el tamaño permitido.');
    const raw=await file.text(), loaded=decode(raw), previous=disk();
    if(previous && !window.confirm('¿Sustituir la partida local por la copia importada?')) {message('Importación cancelada.');return;}
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
    needClick=false;padSession=false;closePanel();mode='play';lockTime=performance.now();stop();pausedMessage='';return;
  }
  if(mode==='play' && !padSession && !document.pointerLockElement) pause();
  if(mode!=='play' && document.pointerLockElement && !needClick) document.exitPointerLock();
});
document.addEventListener('pointerlockerror',lockFailed);
window.addEventListener('blur',()=>{
  gamepad.index=null;
  if(mode==='play') pause('La ventana perdió el foco.');
});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden) return;
  gamepad.index=null;
  if(mode==='play') pause('Has cambiado de pestaña.');
});
window.addEventListener('pagehide',()=>{if(state && mode!=='load') save();});
window.addEventListener('storage',event=>{
  if(event.key===slot && mode==='front') refreshMenu();
});
window.addEventListener('resize',()=>{
  if(mode==='front') cover(canvas);
  if(view) view.resize(settings);
});
document.addEventListener('keydown',event=>{
  inputMethod('keyboard');
  if(event.isTrusted && mode!=='load') sound.start();
  if(mode!=='play') return;
  const code=event.code;
  if(code==='Tab') {event.preventDefault();return;}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code)) event.preventDefault();
  keys.add(code);
  if(event.repeat) return;
  if(code==='Space') jump=true;
  if(code==='Escape' || code==='KeyP') pause();
  if(code==='KeyE') show('inventory');
  if(code==='KeyC') show('journal');
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
  if(event.movementX || event.movementY) inputMethod('keyboard');
  const p=state.player,s=.00048+settings.sensitivity*.000037;
  p.yaw=(p.yaw-event.movementX*s)%(Math.PI*2);
  p.pitch=clamp(p.pitch-event.movementY*s,-1.54,1.54);
});
document.addEventListener('pointerdown',event=>{
  inputMethod('keyboard');
  if(event.isTrusted && mode!=='load') sound.start();
  if(mode==='play' && padSession && event.target===view.renderer.domElement && event.button===0) {
    pause();
    resume();
    return;
  }
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
      edits:[...world.edits],discoveries:[...state.discoveries],echoes:[...state.echoes],finished:state.finished,biome:currentBiome(state.player),
      activeItem:activeItem(),ward:state.ward,needleReady:state.needleReady,elapsed:state.elapsed,deaths:state.deaths,selected:state.selected,
      chunks:view.meshes.size,todo:view.queue.length,locked:document.pointerLockElement?.id??null,
      target:blockHit(),saved:!!disk(),renderer:view.renderer.getContext().getParameter(view.renderer.getContext().VERSION),
      glError:view.renderer.getContext().getError(), calls:view.renderer.info.render.calls,
      triangles:view.renderer.info.render.triangles,
      creatures:view.mobs.map(({kind,x,y,z,flee})=>({kind,x,y,z,flee}))}:{mode},
    audio:()=>({context:sound.ctx?.state??null,scene:sound.scene,voices:sound.voices.size,
      music:sound.musicLevel,effects:sound.effectsLevel}),
    frames:()=>measurements.slice(),
    clearFrames:()=>{measurements.length=0;lastFrame=0;}
  });
}
cover(canvas);refreshMenu();
requestAnimationFrame(tick);
