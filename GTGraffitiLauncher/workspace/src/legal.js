export const CONTACT='breinking3@gatech.edu';
export function installLegalPages(root,{version,web}){
 const footer=document.createElement('footer');footer.className='workspace-footer';
 footer.innerHTML=`<span>GT Graffiti is an experimental research project. Feedback and inquiries: <a href="mailto:${CONTACT}">${CONTACT}</a>.</span><span><a href="${web?'/privacy/':'/legal/privacy.html'}" target="_blank" rel="noopener">Privacy Policy <span class="sr-only">(opens a new tab)</span></a> · <a href="${web?'/agreement/':'/legal/agreement.html'}" target="_blank" rel="noopener">User Agreement <span class="sr-only">(opens a new tab)</span></a> · v${version}${web?' · Web test release':' · Local workspace'}</span>`;
 root.append(footer);
}
