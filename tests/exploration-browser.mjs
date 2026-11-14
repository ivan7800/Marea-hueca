import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {SITES} from '../src/expeditions.js';
import {World,surface} from '../src/world.js';
import {newState,encode,DEFAULT_SETTINGS,SAVE_KEY} from '../src/systems.js';

const browser=await chromium.launch({executablePath:process.env.MAREA_CHROMIUM||undefined,
  args:process.env.MAREA_SOFTWARE==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--single-process','--no-zygote']:[]});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.setDefaultTimeout(12000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const origin=process.env.MAREA_URL??'http://127.0.0.1:4273/LA-MAREA-HUECA/';
const fixture=(site)=>{
  const world=new World('MAREA-17'),state=newState(world);
  state.player.x=site.x+.5;state.player.z=site.z+4.2;
  state.player.y=surface(world,Math.floor(state.player.x),Math.floor(state.player.z))+.02;
  return encode(world,state,{...DEFAULT_SETTINGS,view:2,resolution:'low'});
};
try {
  for(const id of ['spire','orchard']) {
    const site=SITES.find(item=>item.id===id);
    const raw=fixture(site);
    await page.goto(origin+'?qa=1');
    await page.evaluate(([key,data])=>localStorage.setItem(key,data),[SAVE_KEY+':qa',raw]);
    await page.reload();
    await page.getByRole('button',{name:'Continuar'}).click();
    await page.getByRole('button',{name:'Capturar cursor'}).click();
    await page.waitForFunction(()=>window.mareaQA.state().mode==='play');
    await page.waitForFunction(()=>window.mareaQA.state().todo===0);
    await page.evaluate(()=>window.mareaQA.clearFrames());
    await page.waitForTimeout(4350);
    const frames=(await page.evaluate(()=>window.mareaQA.frames())).sort((a,b)=>a-b);
    const sample=await page.evaluate(()=>window.mareaQA.state());
    console.log(site.title,JSON.stringify({frames:frames.length,fps:+(1000/(frames.reduce((a,b)=>a+b,0)/frames.length)).toFixed(1),p95ms:+frames[Math.floor(frames.length*.95)].toFixed(1),calls:sample.calls,triangles:sample.triangles,chunks:sample.chunks}));
    await page.keyboard.down('w');
    await page.waitForTimeout(900);
    await page.keyboard.up('w');
    await page.waitForFunction(title=>document.getElementById('prompt').textContent.includes(title),site.title);
    await page.screenshot({path:`/tmp/marea-080-${id}.png`});
    await page.keyboard.press('f');
    await page.waitForFunction(siteId=>window.mareaQA.state().discoveries.includes(siteId),id);
    const reward=site.reward;
    const bag=await page.evaluate(()=>window.mareaQA.state().bag);
    for(const [item,count] of Object.entries(reward)) assert.ok(bag[item]>=count);
    await page.keyboard.press('p');
    await page.getByRole('button',{name:'Guardar'}).click();
    await page.reload();
    await page.getByRole('button',{name:'Continuar'}).click();
    await page.getByRole('button',{name:'Capturar cursor'}).click();
    assert.ok((await page.evaluate(()=>window.mareaQA.state().discoveries)).includes(id));
  }
  assert.deepEqual(errors,[]);
  console.log('Expediciones nuevas: visita, hallazgo, recompensa y persistencia correctos.');
} finally {await browser.close();}
