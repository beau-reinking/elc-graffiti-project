const stages=new Set(['startup','login','discovery','profile','recording','upload','clip-preparation','publication','community']);
export function diagnosticSummary({version,web,stage='startup',code='none',userAgent=navigator.userAgent}){
 const browser=/Firefox\/(\d+)/.exec(userAgent)||/(?:Chrome|CriOS)\/(\d+)/.exec(userAgent);
 const family=/Firefox\//.test(userAgent)?'Firefox':/(?:Chrome|CriOS)\//.test(userAgent)?'Chrome':'Other';
 const os=/Windows/.test(userAgent)?'Windows':/Macintosh/.test(userAgent)?'macOS':/Android|iPhone|iPad/.test(userAgent)?'Mobile':'Other';
 return JSON.stringify({app:'GT Graffiti',version,mode:web?'web':'native',browser:family,browserVersion:browser?.[1]||'unknown',os,stage:stages.has(stage)?stage:'startup',code:/^[A-Z0-9_-]{1,40}$/.test(code)?code:'none'},null,2);
}
export function installDiagnostics(root,{version,web}){
 const footer=root.querySelector('.workspace-footer'),button=document.createElement('button');button.className='diagnostics-button';button.textContent='Copy diagnostics';
 button.onclick=async()=>{const text=diagnosticSummary({version,web,stage:document.querySelector('#clip-status')?'clip-preparation':root.dataset.diagnosticStage||'startup',code:root.dataset.diagnosticCode||'NONE'});try{await navigator.clipboard.writeText(text);button.textContent='Diagnostics copied';setTimeout(()=>button.textContent='Copy diagnostics',2000)}catch{const dialog=document.createElement('dialog');dialog.innerHTML='<h2>Diagnostic summary</h2><p>No account identifiers, private URLs, or content are included.</p><textarea readonly aria-label="Diagnostic summary"></textarea><button>Close</button>';dialog.querySelector('textarea').value=text;dialog.querySelector('button').onclick=()=>dialog.remove();root.append(dialog);dialog.showModal();dialog.querySelector('textarea').select();}};
 footer.append(button);
 if(web&&(!/(Chrome|Firefox)\//.test(navigator.userAgent)||/Android|iPhone|iPad/.test(navigator.userAgent))){const notice=document.createElement('p');notice.className='browser-support';notice.textContent='Experimental browser: this release is supported on current desktop Chrome and Firefox for Windows and macOS. You can continue, but recording and clip preparation may not work here.';root.querySelector('#workspace-notice').after(notice);}
}
