import {CHUNK, HEIGHT, HALF, BLOCKS, randomAt} from './world.js';

export const FACES = [
  {d:[1,0,0],v:[[1,0,1],[1,0,0],[1,1,1],[1,1,0]],light:.77},
  {d:[-1,0,0],v:[[0,0,0],[0,0,1],[0,1,0],[0,1,1]],light:.63},
  {d:[0,1,0],v:[[0,1,1],[1,1,1],[0,1,0],[1,1,0]],light:1},
  {d:[0,-1,0],v:[[0,0,0],[1,0,0],[0,0,1],[1,0,1]],light:.47},
  {d:[0,0,1],v:[[0,0,1],[1,0,1],[0,1,1],[1,1,1]],light:.87},
  {d:[0,0,-1],v:[[1,0,0],[0,0,0],[1,1,0],[0,1,0]],light:.68}
];
const TRIS=[0,1,2,2,1,3];

function localReader(world,cx,cz) {
  if(!world.chunkData) return world.get.bind(world);
  const buffers=[];
  for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++) {
    const x=cx+dx,z=cz+dz;
    const valid=(dx===0 || dz===0) && x>=-HALF/CHUNK && x<HALF/CHUNK && z>=-HALF/CHUNK && z<HALF/CHUNK;
    buffers.push(valid?world.chunkData(x,z):null);
  }
  const startX=cx*CHUNK,startZ=cz*CHUNK;
  return (x,y,z)=>{
    if(y<0 || y>=HEIGHT) return 0;
    const row=z<startZ?0:z>=startZ+CHUNK?2:1;
    const col=x<startX?0:x>=startX+CHUNK?2:1;
    return buffers[row*3+col]?.[((z & 15)*CHUNK+(x & 15))*HEIGHT+y]??0;
  };
}

export function meshChunk(world,cx,cz) {
  const get=localReader(world,cx,cz);
  const positions=[],uvs=[],colors=[];
  for(let z=cz*CHUNK; z<(cz+1)*CHUNK; z++) for(let x=cx*CHUNK; x<(cx+1)*CHUNK; x++)
    for(let y=1; y<HEIGHT; y++) {
      const id=get(x,y,z);
      if(!id) continue;
      let value;
      for(const {d,v,light} of FACES) {
        if(get(x+d[0],y+d[1],z+d[2])) continue;
        value??=.84+randomAt(world.number+y*29,x,z)*.16;
        const shade=id===8?.95+light*.2: value*light;
        for(const i of TRIS) {
          positions.push(x+v[i][0],y+v[i][1],z+v[i][2]);
          uvs.push((id-1+((i%2)? .985:.015))/9,i>=2?.985:.015);
          colors.push(shade,shade,shade);
        }
      }
    }
  return {positions,uvs,colors};
}

export function atlas() {
  const size=64, canvas=document.createElement('canvas');
  canvas.width=size*9;
  canvas.height=size;
  const ctx=canvas.getContext('2d');
  for(let id=1;id<BLOCKS.length;id++) {
    const x=(id-1)*size;
    const {color,light}=BLOCKS[id];
    ctx.save();
    ctx.beginPath(); ctx.rect(x,0,size,size); ctx.clip(); ctx.translate(x,0);
    ctx.fillStyle=color; ctx.fillRect(0,0,size,size);
    for(let i=0;i<530;i++) {
      const a=randomAt(id,i,8)*64, b=randomAt(id,i,9)*64;
      ctx.fillStyle=i%3===0?light:'#181e22';
      ctx.globalAlpha=.07+randomAt(id,i,3)*.28;
      const w=id===4?1:1+randomAt(id,i,4)*5;
      ctx.fillRect(Math.floor(a),Math.floor(b),w,id===4?4+i%9:1+i%3);
    }
    ctx.strokeStyle=light;
    ctx.globalAlpha=.33;
    for(let i=0;i<6;i++) {
      ctx.beginPath();
      const o=i*11+5;
      if(id===1 || id===7 || id===3 || id===9) {
        ctx.moveTo(0,o); ctx.lineTo(17,o-2); ctx.lineTo(39,o+2); ctx.lineTo(64,o-1);
      } else if(id===4) {
        ctx.moveTo(o,-2); ctx.bezierCurveTo(o+6,18,o-7,36,o+3,64);
      } else {
        ctx.ellipse(31,33,8+i*7,4+i*5,.4,0,Math.PI*2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha=.5;
    ctx.lineWidth=1.5;
    ctx.beginPath();
    if(id===1 || id===3) {
      for(let j=0;j<4;j++) {
        const left=9+j*15;
        ctx.moveTo(left,0);ctx.lineTo(left-4,20);ctx.lineTo(left+4,31);
        ctx.lineTo(left-1,52);ctx.lineTo(left-3,64);
      }
    } else if(id===5 || id===6) {
      for(let j=0;j<9;j++) {
        const a=randomAt(id,j,40)*64,b=randomAt(id,j,41)*64;
        ctx.moveTo(a-4,b);ctx.lineTo(a,b-6);ctx.lineTo(a+4,b);ctx.lineTo(a,b+6);ctx.closePath();
      }
    } else if(id===7) {
      for(let j=0;j<4;j++) ctx.rect(6+j*15,27+(j%2)*10,4,4);
    }
    ctx.stroke();
    if(id===8) {
      ctx.globalAlpha=.84; ctx.lineWidth=2;
      ctx.strokeRect(3,3,58,58);
      ctx.beginPath(); ctx.moveTo(32,12); ctx.lineTo(47,32);ctx.lineTo(32,52);ctx.lineTo(17,32);ctx.closePath();ctx.stroke();
    }
    ctx.restore();
  }
  return canvas;
}
