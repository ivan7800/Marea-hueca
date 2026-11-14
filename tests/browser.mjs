import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium,devices} from 'playwright-core';

const origin=process.env.MAREA_URL??'http://127.0.0.1:4273/LA-MAREA-HUECA/';
const screenshots=resolve(process.env.MAREA_CAPTURES??'qa-captures');
await mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({
  executablePath:process.env.MAREA_CHROMIUM||undefined,
  args:process.env.MAREA_SOFTWARE==='1'
    ?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--single-process','--no-zygote']:[]
});
const page=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
page.setDefaultTimeout(9500);
const errors=[], requests=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
page.on('request',request=>requests.push(request.url()));
page.on('response',response=>{if(response.status()>=400) errors.push(response.status()+' '+response.url());});
const button=name=>page.getByRole('button',{name,exact:true});
const snap=async name=>page.screenshot({path:resolve(screenshots,name+'.png'),timeout:12000});
const read=()=>page.evaluate(()=>window.mareaQA.state());
const until=(f,a)=>page.waitForFunction(f,a,{timeout:12_000});
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
async function walk(x,z,{noJump=false}={}) {
  for(let i=0;i<22;i++) {
    const p=(await read()).player, dx=x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz);
    if((await read()).mode==='defeat') assert.fail('Derrota durante el recorrido de ecos.');
    if(dist<1.3) return;
    const yaw=Math.atan2(-dx,-dz);
    await turn(yaw);
    await page.keyboard.down('w');
    try {
      const ms=Math.min(920,Math.max(140,dist*225));
      if(!noJump && dist>2) {await page.keyboard.press('Space');await wait(ms);}
      else await wait(ms);
    } finally {await page.keyboard.up('w');}
    await wait(130);
    const q=(await read()).player;
    if(i===21) assert.fail(`No llegó a ${x},${z}: ${q.x.toFixed(2)},${q.y.toFixed(2)},${q.z.toFixed(2)}`);
  }
}
async function measure(name,ms=4350) {
  await page.evaluate(()=>window.mareaQA.clearFrames());
  await wait(ms);
  const data=(await page.evaluate(()=>window.mareaQA.frames())).sort((a,b)=>a-b);
  assert.ok(data.length>10);
  const mean=data.reduce((a,b)=>a+b,0)/data.length;
  const state=await read();
  assert.equal(state.glError,0);
  console.log(name,JSON.stringify({frames:data.length,meanMs:+mean.toFixed(1),
    fps:+(1000/mean).toFixed(1),p95Ms:+data[Math.floor(data.length*.95)].toFixed(1),
    calls:state.calls,triangles:state.triangles,chunks:state.chunks}));
}
try {
  console.log('Chromium',browser.version());
  await page.goto(origin+'?qa=1');
  await button('Nueva partida').waitFor();
  assert.equal(await button('Continuar').isEnabled(),false);
  await snap('01-menu');
  await button('Ajustes').click();
  await page.getByLabel('Reducir movimiento y efectos').check();
  await page.getByLabel('Resolución 3D').selectOption('low');
  await page.getByLabel('Distancia de visión').selectOption('2');
  await button('Volver').click();
  await button('Nueva partida').click();
  await page.getByLabel('Semilla del mundo').fill('MAREA-17');
  await button('Entrar en la cuenca').click();
  await resume('Capturar cursor');
  assert.match((await read()).renderer,/^WebGL 2/);
  await turn(0,-.035);
  await until(()=>window.mareaQA.state().todo===0);
  await snap('02-inicio-costra');
  await measure('Costra, vista fija y resolución baja');
  const before=(await read()).player;
  await key('w',460);await wait(140);
  assert.ok((await read()).player.z<before.z-.8);
  await page.keyboard.press('Space');
  await until(()=>window.mareaQA.state().player.y>15.4);
  await until(()=>window.mareaQA.state().player.ground);
  await turn(0,-.66);
  await until(()=>window.mareaQA.state().target?.block > 0);
  const mined=(await read()).target;
  const bag=(await read()).bag[mined.block]??0;
  await page.keyboard.down('m');
  await until(()=>!document.getElementById('mining').hidden || window.mareaQA.state().revision===1);
  await snap('03-mineria');
  await until(()=>window.mareaQA.state().revision===1);
  await page.keyboard.up('m');
  assert.equal((await read()).bag[mined.block],bag+1);
  assert.equal((await read()).revision,1);
  await page.keyboard.press(mined.block===2?'3':'1');
  await page.keyboard.press('n');
  assert.equal((await read()).revision,2);
  await turn(.25,-.53);
  await page.keyboard.press('1');await page.keyboard.press('n');
  assert.equal((await read()).revision,3);
  await snap('04-construccion');
  await page.keyboard.press('e');
  await button('Fabricar').first().waitFor();
  await button('Fabricar').first().click();
  assert.equal((await read()).bag.chisel,1);
  await snap('05-mochila');
  await page.locator('dialog [data-action=pause]').click();
  await snap('06-pausa');
  await button('Guardar').click();
  await page.getByText('Partida guardada en este navegador.').waitFor();
  const progress=await read();
  const [file]=await Promise.all([page.waitForEvent('download'),button('Exportar partida').click()]);
  const exported=resolve(screenshots,'qa-marea.json');
  await file.saveAs(exported);
  await page.reload();
  await button('Continuar').click();
  await resume('Capturar cursor');
  assert.deepEqual((await read()).edits,progress.edits);
  assert.equal((await read()).bag.chisel,1);
  await snap('07-recargada');
  await pause();
  assert.equal((await read()).locked,null);
  await resume();
  // Headless no siempre entrega Escape al documento bajo Pointer Lock.
  await page.keyboard.press('Escape');
  await wait(420);
  if((await read()).mode==='play') await pause();
  else await button('Reanudar').waitFor();
  assert.equal((await read()).locked,null);
  await resume();
  await page.keyboard.press('c');
  await page.getByText('0/3 hallazgos.',{exact:false}).waitFor();
  await snap('14-cuaderno');
  await resume();
  await walk(.5,.5);
  await walk(-19,.5);
  assert.equal((await read()).biome,1);
  await walk(-25,.5);
  await walk(-27,-2.4);
  await walk(-27,-3.7);
  await snap('08-espinazo-raspadura');
  await page.keyboard.press('f');
  assert.deepEqual((await read()).echoes,['spine']);
  console.log('Eco del Espinazo recuperado.');
  await walk(-20,.5);
  await walk(.5,.5);
  await walk(25,.5);
  assert.equal((await read()).biome,2);
  await walk(27.2,1.2);
  await turn(-Math.PI/2);
  await snap('09-salina');
  await measure('Salina, vista fija y resolución baja');
  await page.keyboard.press('f');
  assert.deepEqual((await read()).echoes,['spine','salt']);
  await walk(.5,.5);
  await walk(.5,-7.5,{noJump:true});
  await walk(.5,-22.7,{noJump:true});
  assert.equal((await read()).biome,3);
  await turn(0,-.10);
  await snap('10-camara');
  await page.keyboard.press('f');
  assert.equal((await read()).finished,true);
  await snap('11-eco-devuelto');
  await pause();
  await button('Volver al menú').click();
  await button('Créditos').click();
  const input=page.locator('#import-file');
  await input.setInputFiles({name:'corrupto.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await page.getByText('La partida no contiene JSON válido.').waitFor();
  page.once('dialog',dialog=>dialog.accept());
  await input.setInputFiles(exported);
  await page.getByText('Partida importada. Usa Continuar para abrirla.').waitFor();
  await button('Volver').click();
  await button('Continuar').click();
  await resume('Capturar cursor');
  assert.deepEqual((await read()).edits,progress.edits);
  assert.equal((await read()).finished,false);
  const wide=await page.evaluate(()=>({w:innerWidth,h:innerHeight,ua:navigator.userAgent}));
  console.log('Escritorio',JSON.stringify(wide));
  assert.equal(requests.filter(url=>!url.startsWith(origin)&&!url.startsWith('blob:')).length,0);
  assert.deepEqual(errors,[]);
  console.log('Recorrido completo, cero errores de aplicación y WebGL.');

  const mobile=await browser.newPage({...devices['iPhone 13']});
  await mobile.goto(origin);
  assert.equal(await mobile.getByRole('button',{name:'Nueva partida'}).isEnabled(),false);
  await mobile.getByText('Para jugar, usa un equipo con teclado y ratón.').waitFor();
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.screenshot({path:resolve(screenshots,'12-menu-movil.png')});
  await mobile.getByRole('button',{name:'Ajustes'}).click();
  await mobile.getByLabel('Música').waitFor();
  await mobile.screenshot({path:resolve(screenshots,'13-ajustes-movil.png')});
  console.log('Menú y ajustes, emulación táctil iPhone 13 en Chromium.');

  const offline=await browser.newPage({viewport:{width:1280,height:720}});
  await offline.context().setOffline(true);
  await offline.goto(pathToFileURL(resolve('La-Marea-Hueca.html')).href+'?qa=1');
  await offline.getByRole('button',{name:'Nueva partida'}).click();
  await offline.getByRole('button',{name:'Entrar en la cuenca'}).click();
  await offline.getByRole('button',{name:'Capturar cursor'}).click();
  await offline.waitForFunction(()=>window.mareaQA.state().mode==='play');
  assert.ok(await offline.evaluate(()=>window.mareaQA.state().saved));
  console.log('HTML autónomo iniciado desde file:// con red desactivada y guardado accesible.');
} catch(error) {
  console.error('Estado al fallar',await read().catch(()=>null));
  await snap('fallo').catch(()=>{});
  throw error;
} finally {await browser.close();}
