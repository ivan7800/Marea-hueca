export const SETTLEMENTS = [
  {id:'boyas', title:'Poblado de las Boyas', biome:'La Costra', width:11, depth:9, entrance:2, height:8,
    anchors:[[4,-16],[4,16],[4,29]], cache:[2,4], reward:{needle:1,1:6,4:3},
    note:'Las casas enviaban señales al muelle. Tras la retirada del mar, las boyas respondían desde debajo del suelo.'},
  {id:'costillas', title:'Estación de las Costillas', biome:'El Espinazo', width:11, depth:9, entrance:5, height:10,
    anchors:[[-29,5],[-43,15],[-27,28]], cache:[5,2], reward:{saltlance:1,ward:1,3:6,5:3,6:2,7:3},
    note:'En el archivo hay un plano del fondo marino. Las costillas de basalto coinciden con el contorno de algo demasiado grande para caber en la cuenca.'},
  {id:'aljibe', title:'Aljibe de las Agujas', biome:'La Salina Ciega', width:11, depth:9, entrance:5, height:8,
    anchors:[[25,14],[31,-19],[17,-27]], cache:[5,2], reward:{5:4,7:4,8:1},
    note:'Los medidores del aljibe siguen marcando niveles distintos. El más alto está grabado en el lado seco del muro.'}
];

function building(x,z,y,minX,maxX,minZ,maxZ,door,wall,roof) {
  if(x<minX || x>maxX || z<minZ || z>maxZ) return 0;
  if(y===4) return roof;
  if(z===maxZ && x===door && y<=2) return 0;
  if(y===2 && z===minZ && x===door) return 0;
  return x===minX || x===maxX || z===minZ || z===maxZ ? wall : 0;
}

export function fittingLayout(edits=[],position=null) {
  // La migración evita toda huella donde el jugador haya excavado o construido.
  const positions=edits.map(([key])=>key.split(',').map(Number));
  if(position) positions.push(position);
  return SETTLEMENTS.map(site=>site.anchors.findIndex(([ax,az])=>
    !positions.some(([x,,z])=>(
      x>=ax-1 && x<ax+site.width+1 && z>=az-1 && z<az+site.depth+1
    ) || (
      Math.abs(x-ax-site.entrance)<=2 && z>=az+site.depth && z<az+site.depth+5
    ))));
}

export function sitesFor(world) {
  return SETTLEMENTS.flatMap((site,i)=>{
    const anchor=site.anchors[world.layout[i]];
    if(!anchor) return [];
    const [x,z]=anchor;
    return [{...site,x,z,y:world.settlementFloors[i]}];
  });
}

export function settlementVoxel(site,x,y,z) {
  x-=site.x;z-=site.z;y-=site.y;
  if(y<0 || y>site.height) return null;
  const village=site.id==='boyas';
  if(site.id==='aljibe') {
    if(y===0) return 7;
    if(z===7 && (x===2 || x===8)) {
      const tip=x===2?7:5;
      return y===tip?6:y<tip?7:0;
    }
    if(z===7 && y===4 && x>2 && x<8) return 7;
    if(x===5 && z===2 && y===1) return 7;
    if(z===1 && x>=2 && x<=8 && y<=3) return (x+2*y)%5===0?6:5;
    if((x===2 || x===8) && z>=2 && z<=6 && y<=1+(z<4)) return 7;
    return 0;
  }
  if(y===0) return village ? (x===5 || z>=6?7:1) : (x===5 || z>=7?7:3);
  if(village) {
    if(x===5 && z===1) {
      if(y<=6) return 4;
      if(y===7) return 6;
    }
    if(y>4) return 0;
    if(x===2 && z===4 && y===1) return 7;
    return building(x,z,y,0,4,2,5,2,1,4) || building(x,z,y,6,10,2,5,8,4,7);
  }
  if(x===5 && z===0 && y>=4) return y===9?6:y<=8?3:0;
  if((x===2 || x===8) && z===7 && y<=5) return y===5?6:3;
  if(z===7 && y===5 && x>2 && x<8) return 7;
  if(y>4) return 0;
  if(x===5 && z===2 && y===1) return 7;
  return building(x,z,y,1,9,0,5,5,3,7);
}

export function cachePosition(site) {
  return [site.x+site.cache[0]+.5,site.y+1.5,site.z+site.cache[1]+.5];
}

export function nearestSignal(world,state,landmarks) {
  const {x,z}=state.player;
  const targets=[
    ...world.settlements.filter(site=>!state.discoveries.includes(site.id)),
    ...landmarks.filter(mark=>mark.id!=='vault' && !state.echoes.includes(mark.id)),
    ...(state.echoes.length===2 && !state.finished ? landmarks.filter(mark=>mark.id==='vault') : [])
  ];
  return targets.map(target=>{
    const dx=target.x+.5-x,dz=target.z+.5-z;
    const headings=['N','NE','E','SE','S','SO','O','NO'];
    const angle=Math.atan2(dx,-dz);
    const heading=headings[(Math.round(angle*4/Math.PI)+8)%8];
    return {title:target.title,heading,distance:Math.round(Math.hypot(dx,dz))};
  }).sort((a,b)=>a.distance-b.distance)[0];
}

export function wardCovers(ward,elapsed,creature) {
  return !!ward && elapsed<ward.until && Math.hypot(ward.x-creature.x,ward.y-creature.y,ward.z-creature.z)<4.5;
}
