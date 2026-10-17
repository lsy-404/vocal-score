import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm'};
const port = Number(process.env.PORT) || 4190;

createServer(async (req,res)=>{
  try {
    const requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const filename=path.resolve(root,'.'+requestPath);
    const relative=path.relative(root,filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {res.writeHead(403);res.end();return;}
    const resolved=(await stat(filename)).isDirectory()?path.join(filename,'index.html'):filename;
    const data=await readFile(resolved);
    res.writeHead(200,{'Content-Type':types[path.extname(resolved)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>process.stdout.write(`Local: http://127.0.0.1:${port}/\n`));
