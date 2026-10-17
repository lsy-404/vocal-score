import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const routes=new Map([
  ['/',['test/storage.browser.html','text/html; charset=utf-8']],
  ['/src/lib/storage.js',['src/lib/storage.js','text/javascript; charset=utf-8']]
]);
const server=createServer(async (request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(pathname==='/favicon.ico'){response.writeHead(204).end();return;}
  const route=routes.get(pathname);
  if(!route){response.writeHead(404).end();return;}
  response.setHeader('Content-Type',route[1]);
  response.end(await readFile(path.join(root,route[0])));
});
server.listen(0,'127.0.0.1',()=>process.stdout.write(`${server.address().port}\n`));
