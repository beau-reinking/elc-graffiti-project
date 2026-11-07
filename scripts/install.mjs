import {spawnSync} from 'node:child_process';
for(const cwd of ['GTGraffitiLauncher/workspace','yudo','sylt','ourscene']){
 const r=spawnSync('npm',['ci'],{cwd,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
