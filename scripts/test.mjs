import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const [dir,args]of [['GTGraffitiLauncher/workspace',['test']],['yudo',['test']],['sylt',['test']],['ourscene',['test']],['ourscene',['run','check']]]){const r=spawnSync('npm',args,{cwd:path.join(root,dir),stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
const result=spawnSync(process.execPath,['--test','tests/*.test.mjs'],{cwd:root,stdio:'inherit'});process.exit(result.status||0);
