import{mkdir,cp,writeFile}from'node:fs/promises';import path from'node:path';
/** Real shell documents avoid Pages' HTML normalization interacting with proxies. */
export async function writeWorkspaceRoutes(out){
 const redirects=[];
 for(const name of ['yudo','sylt','ourscene']){await mkdir(path.join(out,name),{recursive:true});await cp(path.join(out,'index.html'),path.join(out,name,'index.html'));redirects.push(`/${name} /${name}/ 301`);}
 for(const [old,next]of Object.entries({soundcheck:'yudo',encore:'sylt','music-venues':'ourscene',soundboard:'ourscene'}))redirects.push(`/${old} /${next}/ 302`,`/${old}/ /${next}/ 302`,`/${old}/* /${next}/:splat 302`);
 await writeFile(path.join(out,'_redirects'),redirects.join('\n')+'\n');
}
