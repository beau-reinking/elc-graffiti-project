export const INPUT_LIMIT=100*1024*1024, OUTPUT_LIMIT=50*1024*1024, MAX_SOURCE_SECONDS=300, MAX_CLIP_SECONDS=60, TIMEOUT_MS=10*60*1000;
export function validateSource(source,start,end){
 if(!source||!Number.isFinite(source.size)||source.size<=0||source.size>INPUT_LIMIT)throw Error('Choose a nonempty recording of 100 MiB or less.');
 if(![start,end].every(Number.isFinite)||start<0||end<=start||end-start>MAX_CLIP_SECONDS)throw Error('Choose a nonempty interval of at most 60 seconds.');
}
export function validateProbe(probe,start,end){
 const duration=Number(probe.format?.duration);
 if(!Number.isFinite(duration)||duration<=0)throw Error('Cannot establish this recording’s duration. Try another recording format.');
 if(duration>MAX_SOURCE_SECONDS+.25)throw Error('Choose a recording of five minutes or less.');
 if(end>duration+.001)throw Error('The selection extends beyond this recording.');
 if(!probe.streams?.some(s=>['audio','video'].includes(s.codec_type)))throw Error('No supported audio or video was found.');
 return duration;
}
export function exportArguments({start,end,video,height=720,output='output.mp4'}){
 const args=['-y','-nostdin','-v','error','-ss',String(start),'-i','input','-t',String(end-start),'-map_metadata','-1','-map_chapters','-1'];
 if(video)args.push('-map','0:v:0','-map','0:a:0?','-vf',`scale=w='min(iw,${height===720?1280:854})':h='min(ih,${height})':force_original_aspect_ratio=decrease:force_divisible_by=2,fps='min(source_fps,30)'`,'-c:v','libx264','-preset','ultrafast','-crf',height===720?'25':'29','-pix_fmt','yuv420p','-maxrate',height===720?'4M':'1500k','-bufsize','8M');
 else args.push('-map','0:a:0','-vn');
 return [...args,'-c:a','aac','-b:a','160k','-avoid_negative_ts','disabled','-movflags','+faststart',output];
}
export function validateOutput({duration,size,mediaType}){
 if(!Number.isFinite(duration)||duration<=0||duration>60||!Number.isFinite(size)||size<=0||size>OUTPUT_LIMIT||!['audio/mp4','video/mp4'].includes(mediaType))throw Error('This export does not meet Yudo’s 60-second and 50 MiB limits. Choose a shorter selection.');
}
export const abortError=()=>new DOMException('Clip preparation cancelled.','AbortError');
