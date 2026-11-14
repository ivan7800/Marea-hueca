import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {World,surface} from '../src/world.js';
import {newState,encode,DEFAULT_SETTINGS,SAVE_KEY} from '../src/systems.js';
const world=new World('MAREA-17'),state=newState(world);
state.player.x=5.5;state.player.z=-35.5;state.player.y=surface(world,5,-35)+.02;
const fixture=encode(world,state,DEFAULT_SETTINGS);
const browser=await chromium.launch({executablePath:process.env.MAREA_CHROMIUM||undefined,
 args:process.env.MAREA_SOFTWARE==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--single-process','--no-zygote']:[]});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(([key,raw])=>localStorage.getItem(key) ?? localStorage.setItem(key,raw),[SAVE_KEY+':qa',fixture]);
 await page.goto((process.env.MAREA_URL??'http://127.0.0.1:4273/LA-MAREA-HUECA/')+'?qa=1');
 await page.getByRole('button',{name:'Continuar'}).click();
 await page.getByRole('button',{name:'Capturar cursor'}).click();
 await page.waitForFunction(()=>window.mareaQA.state().mode==='play');
 await page.keyboard.down('w');
 const hops=setInterval(()=>page.keyboard.press('Space').catch(()=>{}),650);
 try {
   await page.waitForFunction(()=>document.getElementById('prompt').textContent.includes('Fosa del Testigo'),null,{timeout:12000});
 } catch(error) {
   clearInterval(hops);
   console.log('Posición al acercarse',await page.evaluate(()=>window.mareaQA.state().player));
   await page.screenshot({path:'/tmp/marea-070-witness-failed.png'});
   throw error;
 }
 clearInterval(hops);
 await page.keyboard.up('w');
 await page.screenshot({path:'/tmp/marea-070-witness.png'});
 await page.keyboard.press('f');
 await page.waitForFunction(()=>window.mareaQA.state().discoveries.includes('witness'));
 const count=(await page.evaluate(()=>window.mareaQA.state().bag['6']))??0;
 await page.keyboard.press('f');
 assert.equal((await page.evaluate(()=>window.mareaQA.state().bag['6']))??0,count);
 await page.keyboard.press('p');
 await page.getByRole('button',{name:'Guardar'}).click();
 await page.reload();
 await page.getByRole('button',{name:'Continuar'}).click();
 await page.getByRole('button',{name:'Capturar cursor'}).click();
 await page.waitForFunction(()=>window.mareaQA.state().mode==='play');
 assert.ok((await page.evaluate(()=>window.mareaQA.state().discoveries)).includes('witness'));
 assert.deepEqual(errors,[]);
 console.log('Fosa: acceso a pie, hallazgo único y recarga correctos.');
} finally {await browser.close();}
