import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const from=path=>new URL('../'+path,import.meta.url);
const out=process.argv[2];
if(!out) throw new Error('Indica un archivo HTML de salida.');
const result=await build({entryPoints:[from('src/main.js').pathname],bundle:true,format:'iife',write:false,
  minify:true,legalComments:'none',target:['es2022']});
const [html,css,icon,license]=await Promise.all(['index.html','style.css','tide.svg','vendor/THREE-LICENSE.txt'].map(f=>readFile(from(f),'utf8')));
await writeFile(out,html
  .replace('<link rel="icon" href="./tide.svg" type="image/svg+xml">',()=>`<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}">`)
  .replace('<link rel="stylesheet" href="./style.css">',()=>`<style>\n${css}\n</style>`)
  .replace('<script type="module" src="./src/main.js"></script>',()=>`<!-- Three.js r180\n${license}\n-->\n<script>${result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script>`));
