import test from 'node:test';
import assert from 'node:assert/strict';
import {GamepadInput, PAD, stick} from '../src/gamepad.js';
import {World} from '../src/world.js';
import {encode, decode, newState, safeSettings} from '../src/systems.js';

test('La zona muerta elimina deriva y conserva velocidad analógica',()=>{
  assert.deepEqual(stick(.11,.11,.2),[0,0]);
  assert.deepEqual(stick(.6,0,.2).map(n=>Math.round(n*10)),[5,0]);
  assert.ok(Math.abs(Math.hypot(...stick(1,1,.2))-1)<1e-12);
});

test('El mando estándar distingue pulsaciones, gatillos, repetición y reconexión',()=>{
  const controller=new GamepadInput();
  const pad={connected:true,index:2,mapping:'standard',axes:[0,0,0,0],
    buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  const poll=now=>controller.poll([null,null,pad],.2,now);
  pad.buttons[PAD.accept].pressed=true;
  assert.equal(poll(0).pressed(PAD.accept),false);
  pad.buttons[PAD.accept].pressed=false;
  poll(16);
  pad.buttons[PAD.mine].value=.7;
  pad.buttons[PAD.down].pressed=true;
  const frame=poll(32);
  assert.equal(frame.pressed(PAD.mine),true);
  assert.equal(frame.navigation,PAD.down);
  assert.equal(poll(48).pressed(PAD.mine),false);
  assert.equal(poll(400).navigation,PAD.down);
  pad.connected=false;
  assert.equal(poll(416),null);
  pad.connected=true;
  assert.equal(poll(432).pressed(PAD.mine),false);
  pad.mapping='';
  assert.equal(poll(448),null);
});

test('Los ajustes de mando se validan y sobreviven al guardado',()=>{
  const world=new World('MANDO');
  const state=newState(world);
  const settings=safeSettings({deadzone:99,padSensitivity:38});
  assert.equal(settings.deadzone,40);
  assert.deepEqual(decode(encode(world,state,settings)).settings,settings);
  assert.equal(safeSettings({}).deadzone,20);
});
