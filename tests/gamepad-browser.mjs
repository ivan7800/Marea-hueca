import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {PAD} from '../src/gamepad.js';

const browser=await chromium.launch({
  executablePath:process.env.MAREA_CHROMIUM||undefined,
  args:process.env.MAREA_SOFTWARE==='1'
    ?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--single-process','--no-zygote']:[],
});
try {
  const page=await browser.newPage({viewport:{width:1000,height:650}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const pad={connected:false,index:0,mapping:'standard',axes:[0,0,0,0],
      buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>pad.connected?[pad]:[]});
    window.testPad=pad;
  });
  await page.goto((process.env.MAREA_URL??'http://127.0.0.1:4273/LA-MAREA-HUECA/')+'?qa=1');
  const sample=()=>page.evaluate(async ()=>{
    // Wait for the application's animation loop to sample each input.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  const connect=async connected=>{
    await page.evaluate(value=>{window.testPad.connected=value;},connected);
    await sample();
  };
  const button=async (index,pressed)=>{
    await page.evaluate(([index,pressed])=>{
      window.testPad.buttons[index]={pressed,value:Number(pressed)};
    },[index,pressed]);
    await sample();
  };
  const tap=async index=>{await button(index,true);await button(index,false);};
  const axes=async values=>{
    await page.evaluate(values=>{window.testPad.axes=values;},values);
    await sample();
  };
  const state=()=>page.evaluate(()=>window.mareaQA.state());
  await connect(true);
  assert.equal(await page.locator('html').evaluate(node=>node.classList.contains('using-pad')),false);
  assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BODY');
  await tap(PAD.down);
  await tap(PAD.accept);
  await page.getByLabel('Semilla del mundo').waitFor();
  await tap(PAD.accept);
  await page.getByRole('button',{name:'Capturar cursor'}).waitFor();
  await tap(PAD.pause);
  await page.waitForFunction(()=>window.mareaQA.state().mode==='play');
  assert.equal((await state()).locked,null);
  assert.match((await state()).renderer,/^WebGL 2/);
  const initial=(await state()).player;
  await axes([.07,.05,.11,-.05]);
  assert.equal((await state()).player.yaw,initial.yaw);
  await axes([0,-.8,0,0]);
  await page.waitForFunction(p=>Math.hypot(window.mareaQA.state().player.x-p.x,window.mareaQA.state().player.z-p.z)>.25,initial);
  await axes([0,0,0,0]);
  await tap(PAD.accept);
  await page.waitForFunction(p=>window.mareaQA.state().player.y>p+.25,initial.y);
  await page.waitForFunction(()=>window.mareaQA.state().player.ground);
  await axes([0,0,0,.7]);
  await page.waitForFunction(()=>window.mareaQA.state().player.pitch<-.58);
  await axes([0,0,0,0]);
  await page.waitForFunction(()=>Boolean(window.mareaQA.state().target));
  await button(PAD.mine,true);
  await page.waitForFunction(()=>window.mareaQA.state().revision===1);
  await button(PAD.mine,false);
  await tap(PAD.place);
  assert.equal((await state()).revision,2);
  await tap(PAD.use);
  await axes([0,0,.65,0]);
  await page.waitForFunction(yaw=>window.mareaQA.state().player.yaw!==yaw,initial.yaw);
  await axes([0,0,0,0]);
  await tap(PAD.next);
  assert.equal((await state()).selected,1);
  await tap(PAD.journal);
  await page.getByText('Cuaderno de campo',{exact:true}).waitFor();
  await tap(PAD.back);
  await tap(PAD.pause);
  await tap(PAD.bag);
  await page.getByText('Fabricación',{exact:true}).waitFor();
  await tap(PAD.back);
  await page.getByRole('button',{name:'Reanudar'}).waitFor();
  await tap(PAD.pause);
  assert.equal((await state()).mode,'play');
  await page.evaluate(()=>dispatchEvent(new Event('blur')));
  await page.getByText('La ventana perdió el foco.').waitFor();
  assert.equal((await page.evaluate(()=>window.mareaQA.audio())).music,0);
  await tap(PAD.pause);
  await connect(false);
  await page.getByText(/El mando se ha desconectado/).waitFor();
  await page.getByRole('button',{name:'Reanudar'}).click();
  await page.waitForFunction(()=>window.mareaQA.state().mode==="play" && Boolean(window.mareaQA.state().locked));
  await page.keyboard.press('p');
  await page.getByRole('button',{name:'Guardar'}).waitFor();
  assert.equal((await state()).glError,0);
  assert.deepEqual(errors,[]);
  console.log('Mando emulado: portada, inicio, deriva, movimiento, salto, cámara, minería, colocación, barra, mochila, cuaderno, pausa y pérdida de foco, desconexión y regreso al ratón.');
} finally {await browser.close();}
