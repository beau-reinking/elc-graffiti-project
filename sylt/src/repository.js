import {APP,validRecord} from './domain.js';
export const RECORD_SCHEMA={type:'object',properties:{value:{type:'object',properties:{app:{const:APP}},required:['app']}},required:['value']};
/** Public writes omit allowed; null is an app-level public marker, not an SDK value.
 * The production data boundary. All private writes explicitly restrict both objects and media. */
export class GraffitiRepository {
 constructor(session,api){this.session=session;this.actor=session.actor;this.api=api}
 async list(){const result=[];let failure;for await(const item of this.api.discover([APP,`${APP}:${this.actor}`],RECORD_SCHEMA,this.session)){if(item.error){failure=item.error;continue}if(item.object&&!item.tombstone&&validRecord(item.object))result.push(item.object)}if(failure)throw new Error(`Some Graffiti sources are unavailable. ${failure.message}`);return result}
 async get(url){const o=await this.api.get(url,RECORD_SCHEMA,this.session);if(!validRecord(o))throw new Error('This recording uses an unsupported format.');return o}
 async post(type,value,allowed=[this.actor]){return this.api.post({value:{...value,app:APP,version:1,type,createdAt:value.createdAt||Date.now()},channels:[APP,`${APP}:${this.actor}`],...(allowed===null?{}:{allowed})},this.session)}
 async remove(url){return this.api.delete(url,this.session)}
 async upload(data,allowed=[this.actor]){return this.api.postMedia({data,...(allowed===null?{}:{allowed})},this.session)}
 async media(url){const media=await this.api.getMedia(url,{types:['audio/*','video/*'],maxBytes:100*1024*1024},this.session);return media.data}
 async removeMedia(url){return this.api.deleteMedia(url,this.session)}
}
