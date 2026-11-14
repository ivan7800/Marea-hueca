export const PAD={accept:0,back:1,use:2,bag:3,previous:4,next:5,place:6,mine:7,
  journal:8,pause:9,sprint:10,up:12,down:13,left:14,right:15};

export function stick(x,y,deadzone) {
  x=Number.isFinite(x)?x:0;
  y=Number.isFinite(y)?y:0;
  const length=Math.hypot(x,y);
  if(length<=deadzone) return [0,0];
  const scale=(Math.min(1,length)-deadzone)/(1-deadzone)/length;
  return [x*scale,y*scale];
}

export class GamepadInput {
  index=null;
  held=[];
  direction=0;
  repeatAt=0;

  poll(pads,deadzone,now) {
    const standard=Array.from(pads).filter(pad=>pad?.connected && pad.mapping==='standard');
    const pad=standard.find(pad=>pad.index===this.index) ?? standard[0];
    if(!pad) {
      this.index=null;
      this.held=[];
      this.direction=0;
      return null;
    }
    const held=Array.from(pad.buttons,button=>Boolean(button.pressed || button.value>.55));
    const changed=pad.index!==this.index;
    const edges=held.map((down,index)=>!changed && down && !this.held[index]);
    this.index=pad.index;
    this.held=held;
    const move=stick(pad.axes[0],pad.axes[1],deadzone);
    const look=stick(pad.axes[2],pad.axes[3],deadzone);
    const axis=Math.abs(move[1])>=Math.abs(move[0])?(move[1]<0?PAD.up:PAD.down):(move[0]<0?PAD.left:PAD.right);
    const direction=[PAD.up,PAD.down,PAD.left,PAD.right].find(index=>held[index]) ??
      (Math.max(Math.abs(move[0]),Math.abs(move[1]))>.48?axis:0);
    let navigation=0;
    if(changed || direction!==this.direction) {
      if(!changed) navigation=direction;
      this.repeatAt=now+330;
    } else if(direction && now>=this.repeatAt) {
      navigation=direction;
      this.repeatAt=now+130;
    }
    this.direction=direction;
    return {held,pressed:index=>Boolean(edges[index]),move,look,navigation,
      active:edges.some(Boolean) || [...move,...look].some(value=>Math.abs(value)>.08)};
  }
}
