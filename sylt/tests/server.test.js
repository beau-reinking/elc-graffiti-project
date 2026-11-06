import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {createAppServer} from '../server.mjs';

test('self-hosted server serves the app without an auth gate and confines file access',async t=>{
 const root=await mkdtemp(join(tmpdir(),'encore-server-'));
 const publicDir=join(root,'dist');await mkdir(join(publicDir,'assets'),{recursive:true});
 await writeFile(join(publicDir,'index.html'),'<h1>Sylt</h1>');
 await writeFile(join(publicDir,'design.html'),'<h1>Design review</h1>');
 await writeFile(join(publicDir,'assets','main-abcdefgh.js'),'console.log("encore")');
 await writeFile(join(root,'secret.txt'),'private');
 await symlink(join(root,'secret.txt'),join(publicDir,'leak.txt'));
 const server=createAppServer({directory:publicDir});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const send=(path,method='GET')=>new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.address().port,path,method},res=>{let body='';res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}))});req.on('error',reject);req.end()});
 const home=await send('/?post=graffiti%3Aexample');assert.equal(home.status,200);assert.equal(home.headers.location,undefined);assert.equal(home.body,'<h1>Sylt</h1>');assert.match(home.headers['content-type'],/text\/html/);assert.equal(home.headers['cache-control'],'no-cache');
 assert.equal((await send('/design.html')).status,200);
 const js=await send('/assets/main-abcdefgh.js');assert.match(js.headers['content-type'],/javascript/);assert.match(js.headers['cache-control'],/immutable/);
 const head=await send('/','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');assert.equal(Number(head.headers['content-length']),Buffer.byteLength(home.body));
 for(const path of ['/missing.js','/.openai/hosting.json','/../secret.txt','/%2e%2e/secret.txt','/%2e%2e%2fsecret.txt','/leak.txt','/assets/'])assert.equal((await send(path)).status,404,path);
 assert.equal((await send('/%ZZ')).status,400);
 const post=await send('/','POST');assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');
});
