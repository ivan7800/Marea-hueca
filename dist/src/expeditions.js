import {surface} from './world.js';

export const SITES = [
  {id:'net', title:'La red petrificada', x:9,z:10,color:'#edc38a',reward:{4:3,2:2},
    line:'Las redes siguen tendidas hacia el cielo. En el nudo central queda limo húmedo.'},
  {id:'rib', title:'El peine de las nueve costillas', x:-36,z:0,color:'#abc4f6',reward:{6:2,3:3},
    line:'Las costillas señalan un cauce que ya no existe. Queda nácar entre los dientes.'},
  {id:'witness',title:'La Fosa del Testigo',x:5,z:-40,color:'#d6cdbb',reward:{6:3,8:2},
    line:'Bajo la costra hay una forma que no cabe en el mapa. La fosa responde con una vibración; tus bloques permanecen intactos.'},
  {id:'spire',title:'El órgano de la deriva',x:-42,z:27,color:'#b8c7ee',reward:{3:5,6:2},
    line:'Las láminas de basalto silban cuando el viento cruza sus ranuras. El cauce señalado cae hacia el centro.'},
  {id:'orchard',title:'El jardín de las conchas',x:40,z:-37,color:'#efb7cd',reward:{4:3,7:3},
    line:'Las conchas nacen cerradas en el suelo salino. Una conserva una semilla mineral para el camino.'},
  {id:'pool',title:'El cuenco de sal',x:37,z:20,color:'#eea6c7',reward:{7:3,5:2},
    line:'La concha retiene una huella que parece cambiar de tamaño al rodearla.'}
];

export function sitePosition(world,site) {
  const {x,z}=site;
  // El hito se apoya en el terreno de la semilla; el jugador puede excavar debajo.
  const y=surface({get:(a,b,c)=>world.base(a,b,c)},x,z);
  return [x+.5,y,z+.5];
}

export function nearbySite(world,p) {
  return SITES.find(s=>{
    if(Math.hypot(p.x-s.x-.5,p.z-s.z-.5)>3.1) return false;
    return Math.abs(p.y-sitePosition(world,s)[1])<2.2;
  });
}

export function discover(state,site,gain) {
  if(state.discoveries.includes(site.id)) return false;
  if(state.mode!=='free' && Object.entries(site.reward).some(([id,n])=>(state.bag[id]??0)+n>999)) return false;
  for(const [id,n] of Object.entries(site.reward)) gain(state,id,n);
  state.discoveries.push(site.id);
  return true;
}

export function nearbyLanterns(world,p,radius=6,max=4) {
  const range=Math.ceil(radius/16);
  const cx=Math.floor(p.x/16), cz=Math.floor(p.z/16);
  const found=[];
  for(let z=cz-range; z<=cz+range; z++) for(let x=cx-range; x<=cx+range; x++) {
    for(const key of world.lanternChunks.get(x+','+z)??[]) {
      const [a,b,c]=key.split(',').map(Number);
      const distance=Math.hypot(p.x-a-.5,p.y+.8-b-.5,p.z-c-.5);
      if(distance<=radius) found.push({x:a+.5,y:b+.5,z:c+.5,distance});
    }
  }
  return found.sort((a,b)=>a.distance-b.distance).slice(0,max);
}
