import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const dst=new URL('../dist/',import.meta.url);
await rm(dst,{recursive:true,force:true});
await mkdir(dst);
for(const path of ['index.html','style.css','tide.svg','src','vendor']) {
  await cp(new URL(path,root),new URL(path,dst),{recursive:true});
}
await writeFile(new URL('.nojekyll',dst),'');
console.log(fileURLToPath(dst));
