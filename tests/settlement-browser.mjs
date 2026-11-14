import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {World,surface} from '../src/world.js';
import {newState,encode,DEFAULT_SETTINGS,SAVE_KEY} from '../src/systems.js';
import {chromium} from 'playwright-core';

const origin=process.env.MAREA_URL??'http://127.0.0.1:4273/LA-MAREA-HUECA/';
const screenshots=resolve(process.env.MAREA_CAPTURES??'qa-captures');
await mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({
  executablePath:process.env.MAREA_CHROMIUM||undefined,
  args:process.env.MAREA_SOFTWARE==='1'
    ?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--single-process','--no-zygote']:[]
});
const page=await browser.newPage({viewport:{width:800,height:500},acceptDownloads:true});
page.setDefaultTimeout(9500);
const errors=[], requests=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
page.on('request',request=>requests.push(request.url()));
page.on('response',response=>{if(response.status()>=400) errors.push(response.status()+' '+response.url());});
const button=name=>page.getByRole('button',{name,exact:true});
const snap=async name=>page.screenshot({path:resolve(screenshots,name+'.png'),timeout:12000});
const read=()=>page.evaluate(()=>window.mareaQA.state());
const until=(f,a)=>page.waitForFunction(f,a,{timeout:20_000});
const wait=ms=>page.waitForTimeout(ms);
const key=async(code,ms)=>{await page.keyboard.down(code);try{await wait(ms);}finally{await page.keyboard.up(code);}};
const pause=async()=>{await page.keyboard.press('p');await button('Reanudar').waitFor();};
const resume=async(name='Reanudar')=>{
  await button(name).click();
  await until(()=>window.mareaQA.state().mode==='play');
  await wait(290);
};
const turn=async(radians,pitch=0)=>{
  const target=(p,a)=>Math.atan2(Math.sin(a-p),Math.cos(a-p));
  for(let i=0;i<9;i++) {
    const p=(await read()).player, d=target(p.yaw,radians),v=pitch-p.pitch;
    if(Math.abs(d)<.095 && Math.abs(v)<.095) return;
    if(Math.abs(d)>=.095) await key(d>0?'j':'l',Math.min(600,Math.max(44,Math.abs(d)*620)));
    if(Math.abs(v)>=.095) await key(v>0?'i':'k',Math.min(600,Math.max(44,Math.abs(v)*780)));
  }
  const p=(await read()).player;
  assert.ok(Math.abs(target(p.yaw,radians))<.19 && Math.abs(pitch-p.pitch)<.19,JSON.stringify(p));
};
async function moveUntil(key,goal) {
  await page.keyboard.down(key);
  try {await until(goal);} finally {await page.keyboard.up(key);}
}
async function measure(name,ms=4350) {
  await page.evaluate(()=>window.mareaQA.clearFrames());
  await wait(ms);
  const data=(await page.evaluate(()=>window.mareaQA.frames())).sort((a,b)=>a-b);
  assert.ok(data.length>0);
  const mean=data.reduce((a,b)=>a+b,0)/data.length;
  const state=await read();
  assert.equal(state.glError,0);
  console.log(name,JSON.stringify({frames:data.length,meanMs:+mean.toFixed(1),
    fps:+(1000/mean).toFixed(1),p95Ms:+data[Math.floor(data.length*.95)].toFixed(1),
    calls:state.calls,triangles:state.triangles,chunks:state.chunks}));
}
const world=new World('MAREA-17');
const settings={...DEFAULT_SETTINGS,view:2,resolution:'low',reduced:true};
async function load(x,z,y=surface(world,Math.floor(x),Math.floor(z))+.02,items={}) {
  const state=newState(world);
  Object.assign(state.player,{x,y,z});
  Object.assign(state.bag,items);
  await page.evaluate(([key,raw])=>localStorage.setItem(key,raw),[SAVE_KEY+':qa',encode(world,state,settings)]);
  await page.reload();
  await button('Continuar').click();
  await resume('Capturar cursor');
}
async function equipItem(id) {
  await page.keyboard.press('e');
  await page.locator('[data-equip='+id+']').click();
  await resume();
  assert.equal((await read()).activeItem,id);
}

try {
  console.log('Chromium',browser.version());
  await page.goto(origin+'?qa=1');
  for(const site of world.settlements) {
    const village=site.id==='boyas';
    const x=site.x+(village?2.5:5.5), edge=site.z+site.depth;
    // Empieza en el terreno de aproximación y cruza la entrada con el teclado.
    await load(x,edge+2.0);
    await turn(0);
    await snap(site.id+'-exterior');
    await measure(site.id+'-exterior');
    await page.keyboard.down('w');
    try {await until(goal=>window.mareaQA.state().player.z<goal,site.z+(village?5.75:4.7));}
    finally {await page.keyboard.up('w');}
    await until(()=>document.getElementById('prompt').textContent.includes('Abrir suministros'));

    await page.mouse.move(402,249);
    await snap(site.id+'-interior');
    await page.keyboard.press('f');
    await until(id=>window.mareaQA.state().discoveries.includes(id),site.id);
    const first=(await read()).bag;
    await page.keyboard.press('f');
    assert.deepEqual((await read()).bag,first);
    console.log(site.id,'entrada y suministros',first);
    if(village) {
      await equipItem('needle');
      await turn(0);
      await moveUntil('s',()=>!document.getElementById('prompt').textContent.includes('Abrir suministros'));
      await page.keyboard.press('f');
      await until(()=>document.getElementById('notice').textContent.startsWith('Aguja ·'));
      await page.keyboard.press('f');
      await until(()=>document.getElementById('notice').textContent.includes('recuperando la señal'));
    } else {
      await page.keyboard.press('e');
      await page.locator('[data-recipe="2"]').click();
      await page.locator('[data-recipe="5"]').click();
      assert.equal((await read()).bag.ward,2);
      await resume();
      await equipItem('ward');
      await turn(0);
      await moveUntil('s',()=>!document.getElementById('prompt').textContent.includes('Abrir suministros'));
      await until(()=>window.mareaQA.state().player.ground);
      await page.keyboard.press('f');
      await until(()=>!!window.mareaQA.state().ward);
      assert.equal((await read()).bag.ward,1);
      await snap('umbral');
    }
    await pause();
    await button('Guardar').click();
    await page.getByText('Partida guardada en este navegador.').waitFor();
    await page.reload();
    await button('Continuar').click();
    await resume('Capturar cursor');
    assert.ok((await read()).discoveries.includes(site.id));
    assert.ok((await read()).bag[village?'needle':'saltlance']);
    if(!village) assert.ok((await read()).ward);
  }
  // La posición de esta partida de prueba permite aislar el encuentro de la ruta.
  await load(-23.5,.5,undefined,{saltlance:1,5:3});
  await equipItem('saltlance');
  await turn(.55);
  for(let i=0;i<12;i++) {
    const {player:p,creatures}=await read();
    const rasp=creatures.filter(m=>m.kind==='rasp').sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0];
    await turn(Math.atan2(p.x-rasp.x,p.z-rasp.z));
    await page.keyboard.press('f');
    if((await read()).bag[5]===2) break;
    await key('w',380);
  }
  assert.equal((await read()).bag[5],2);
  assert.ok((await read()).creatures.some(m=>m.kind==='rasp' && m.flee>0));
  await load(-23.5,.5,undefined,{ward:1});
  await equipItem('ward');
  await until(()=>window.mareaQA.state().player.ground);
  await page.keyboard.press('f');
  await until(()=>!!window.mareaQA.state().ward);
  const health=(await read()).player.health;
  await wait(2000);
  assert.equal((await read()).player.health,health);
  assert.equal((await read()).glError,0);
  assert.deepEqual(errors,[]);
  console.log('Aguja, lanza, fabricación, protección y recarga verificadas.');
} catch(error) {
  console.error(await read().catch(()=>null));
  await snap('settlement-fallo').catch(()=>{});
  throw error;
} finally {await browser.close();}
