export const WEB=typeof __GT_WEB__!=='undefined'&&__GT_WEB__;
export const VERSION='1.1.0';
export async function createClipProcessor(options){
 if(WEB){const {BrowserClipProcessor}=await import('./media/browser.js');return new BrowserClipProcessor(options);}
 const {NativeClipProcessor}=await import('./media/native.js');return new NativeClipProcessor(options);
}
