import {spawnSync} from 'node:child_process';
import {mkdir,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),outputs=path.resolve(root,'../..');
function run(cwd,args){const r=spawnSync(process.execPath,args,{cwd,stdio:'inherit'});if(r.status!==0)throw Error(`Build failed: ${cwd}`)}
run(root,['node_modules/vite/bin/vite.js','build','--base=/']);
for(const app of ['yudo','sylt']){const dir=path.join(outputs,app);run(dir,['node_modules/vite/bin/vite.js','build',`--base=/apps/${app}/`]);await cp(path.join(dir,'dist'),path.join(root,'dist/apps',app),{recursive:true});}
const scene=path.join(outputs,'ourscene');run(scene,['scripts/run.mjs','build-all']);await cp(path.join(scene,'dist'),path.join(root,'dist/apps/ourscene'),{recursive:true});
await mkdir(path.join(root,'dist'),{recursive:true});
console.log('Built local GT Graffiti workspace.');
