import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const options=process.argv.slice(2);
const flag=(name,fallback)=>options.includes(name)?options[options.indexOf(name)+1]:fallback;
const root=resolve(flag('--root',fileURLToPath(new URL('..',import.meta.url))));
const port=Number(flag('--port',process.env.PORT||4173));
const host=flag('--host','127.0.0.1');
const base='/'+flag('--base','').replace(/^\/+|\/+$/g,'');
const prefix=base==='/'?'':base;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(prefix && path===prefix) {res.writeHead(302,{Location:prefix+'/'}).end();return;}
    if(!path.startsWith(prefix+'/')) {res.writeHead(404).end();return;}
    const part=path.slice(prefix.length);
    const file=resolve(root,'.'+(part.endsWith('/')?part+'index.html':part));
    if(!file.startsWith(root+sep) || !Object.hasOwn(mime,extname(file)) || path.split('/').some(p=>p.startsWith('.'))) {
      res.writeHead(404).end();return;
    }
    if(!(await stat(file)).isFile()) {res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-cache'});
    if(req.method==='HEAD') res.end();
    else createReadStream(file).pipe(res);
  } catch {res.writeHead(404).end();}
});
server.listen(port,host,()=>console.log(`http://${host}:${server.address().port}${prefix}/`));
