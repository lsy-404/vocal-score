const {createReadStream} = require('node:fs');
const {createServer} = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routes = new Map([
  ['/',['test/staff-layout.browser.html','text/html; charset=utf-8']],
  ['/src/lib/converter.js',['src/lib/converter.js','text/javascript; charset=utf-8']],
  ['/src/lib/importers/model.js',['src/lib/importers/model.js','text/javascript; charset=utf-8']],
  ['/src/lib/modulation.js',['src/lib/modulation.js','text/javascript; charset=utf-8']],
  ['/src/lib/page-layout.js',['src/lib/page-layout.js','text/javascript; charset=utf-8']],
  ['/src/lib/pdf.js',['src/lib/pdf.js','text/javascript; charset=utf-8']],
  ['/src/lib/staff.js',['src/lib/staff.js','text/javascript; charset=utf-8']],
  ['/src/lib/playback.js',['src/lib/playback.js','text/javascript; charset=utf-8']],
  ['/vendor/opensheetmusicdisplay.min.js',['public/vendor/opensheetmusicdisplay.min.js','text/javascript; charset=utf-8']],
]);

const server=createServer((request,response)=>{
  if(request.url==='/favicon.ico'){response.writeHead(204).end();return;}
  const route=routes.get(request.url);
  if(!route){response.writeHead(404).end();return;}
  response.setHeader('Content-Type',route[1]);
  createReadStream(path.join(root,route[0])).pipe(response);
});
server.listen(0,'127.0.0.1',()=>process.stdout.write(`${server.address().port}\n`));
