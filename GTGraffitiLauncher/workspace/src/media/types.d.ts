export interface ProcessingProgress {stage:string;fraction?:number;bytes?:number;total?:number}
export interface PreparedClip {blob:Blob;duration:number;size:number;mediaType:string;exportRevision:string}
export interface ClipProcessor {prepare(source:Blob,options:{start:number;end:number;signal:AbortSignal;onProgress:(update:ProcessingProgress)=>void}):Promise<PreparedClip>;dispose():void}
