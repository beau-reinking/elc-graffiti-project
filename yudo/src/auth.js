/** Register synchronously after client construction, before showing account-dependent UI. */
export function bindSessions(api,{onLogin,onLogout,onInitialized,onError}){
 const login=event=>{const detail=event.detail;if(detail?.error){onError(detail.error);return}if(detail?.session?.actor)onLogin(detail.session);else onError(Error('Graffiti did not return a valid session.'));};
 const logout=event=>{if(event.detail?.error)onError(event.detail.error);else onLogout(event.detail?.actor)};
 const initialized=event=>onInitialized(event.detail?.error);
 api.sessionEvents.addEventListener('login',login);api.sessionEvents.addEventListener('logout',logout);api.sessionEvents.addEventListener('initialized',initialized);
 return ()=>{api.sessionEvents.removeEventListener('login',login);api.sessionEvents.removeEventListener('logout',logout);api.sessionEvents.removeEventListener('initialized',initialized)};
}
