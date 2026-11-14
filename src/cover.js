import {randomAt} from './world.js';

function path(ctx,points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  points.slice(1).forEach(p=>ctx.lineTo(...p));
}

export function cover(canvas) {
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!w || !h) return;
  canvas.width=w;canvas.height=h;
  const c=canvas.getContext('2d');
  const horizon=h*.55, cx=w*.727, cy=h*.34, r=Math.min(w,h)*.187;
  const sky=c.createLinearGradient(0,0,0,h);
  sky.addColorStop(0,'#101c23');sky.addColorStop(.46,'#354842');sky.addColorStop(1,'#122527');
  c.fillStyle=sky;c.fillRect(0,0,w,h);
  const fog=c.createRadialGradient(cx,cy,r*.12,cx,cy,r*2.9);
  fog.addColorStop(0,'#91b39e68');fog.addColorStop(.42,'#6a94806b');fog.addColorStop(1,'#55745c00');
  c.fillStyle=fog;c.fillRect(0,0,w,h);
  for(let i=0;i<700;i++) {
    const x=randomAt(3,i,3)*w, y=randomAt(3,i,4)*h*.7;
    c.fillStyle=i%5?'#b7d4b51e':'#dbe4c554';c.fillRect(x,y,i%17===0?2:1,1);
  }
  c.save();
  c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.clip();
  const light=c.createLinearGradient(cx,cy-r,cx,cy+r);
  light.addColorStop(0,'#dce3bd');light.addColorStop(.52,'#9db9a2');light.addColorStop(1,'#56776d');
  c.fillStyle=light;c.fillRect(cx-r,cy-r,r*2,r*2);
  for(let i=0;i<620;i++) {
    const x=cx-r+randomAt(18,i,0)*2*r,y=cy-r+randomAt(18,i,1)*2*r;
    c.strokeStyle=i%4?'#415a5344':'#e8edc76b';c.beginPath();c.moveTo(x,y);c.lineTo(x+4+i%18,y+.4);c.stroke();
  }
  c.restore();
  for(let i=0;i<3;i++) {
    c.strokeStyle=['#b6d3ad91','#d8d8ad4d','#80a99960'][i];
    c.beginPath();c.ellipse(cx,cy,r*(1.45+i*.12),r*(.28+i*.19),-.201,0,Math.PI*2);c.stroke();
  }
  const bounds=['#58766d','#45605a','#354e4a','#293f3d','#203535','#192d30','#132427'];
  for(let layer=0;layer<bounds.length;layer++) {
    const points=[];
    for(let i=0;i<79;i++) {
      const x=i*w/78,a=i/78;
      const valley=Math.max(0,1-Math.abs(a-.73)*4);
      const crest=Math.pow(Math.sin(i*.76+layer*.92),6)*(.025+layer*.003)*h;
      const top=horizon+(layer*layer*.0094+valley*(.039+layer*.006))*h+slope(i,layer)*h-crest;
      points.push([x,top],[x+w/83,top]);
    }
    path(c,points);c.lineTo(w,h);c.lineTo(0,h);c.closePath();c.fillStyle=bounds[layer];c.fill();
    path(c,points);c.strokeStyle=layer<4?'#a5be9f3d':'#7fa49430';c.stroke();
    for(let i=0;i<93;i++) {
      const step=Math.floor(randomAt(layer,i,90)*79)*2;
      const [x,y]=points[step], off=randomAt(layer,i,21)*h*.086;
      if(x>w*.36){c.fillStyle=i%4?'#9aafa322':'#b8be9232';c.fillRect(x,y+off,3+i%20,1);}
    }
  }
  const gx=w*.735,gy=h*.72,s=Math.max(17,Math.min(w,h)*.088);
  const pillar=(x,y,a,bright=false)=>{
    c.save();c.translate(x,y);c.rotate(a);
    c.fillStyle=bright?'#61887b':'#1b292c';c.fillRect(-s*.11,-s*.34,s*.22,s*.68);
    c.fillStyle='#879b8670';c.fillRect(-s*.11,-s*.34,2,s*.68);c.restore();
  };
  for(let i=0;i<9;i++) {
    const a=i*Math.PI/8;
    pillar(gx+Math.cos(a)*s,gy-Math.sin(a)*s,a-Math.PI/2);
  }
  pillar(gx-s,gy+s*.39,0);pillar(gx+s,gy+s*.39,0);
  c.strokeStyle='#a4e5c4';c.lineWidth=1.25;c.beginPath();c.arc(gx,gy-s*.3,s*.39,0,Math.PI*2);c.stroke();
  path(c,[[gx,gy-s*.52],[gx+s*.13,gy-s*.31],[gx,gy-s*.12],[gx-s*.13,gy-s*.31],[gx,gy-s*.52]]);
  c.fillStyle='#cbebbb';c.fill();
  for(let i=0;i<34;i++) {
    const x=w*(.37+randomAt(4,i,44)*.57), y=h*(.83+randomAt(4,i,45)*.19);
    const l=4+randomAt(4,i,46)*h*.031;
    c.strokeStyle=i%3?'#6b988d45':'#a8bd9971';c.beginPath();c.moveTo(x,y);c.lineTo(x+4,y-l);c.stroke();
  }
}
const slope=(i,layer)=>Math.sin(i*.19+layer*.66)*.037+Math.sin(i*.43+layer)*.017;
