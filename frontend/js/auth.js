/** WealthDesk cloud authentication client: PBKDF2 via WebCrypto and GAS sessions.
 * The derived proof is a password-equivalent credential; it must only traverse HTTPS.
 * Raw passwords, APP_SECRET and tokens are never stored in Google Sheets by this client.
 */
(() => {
 'use strict';
 const ITERATIONS=310000;
 const el=id=>document.getElementById(id);
 const enc=new TextEncoder();
 const emailOf=v=>String(v||'').trim().toLowerCase();
 const validatePass=v=>{if(v.length<8||v.length>128||!/[A-Za-z]/.test(v)||!/[0-9]/.test(v))throw new Error('密碼需 8–128 字，並同時包含英文字母及數字');};
 const urlB64=arr=>btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const toBytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
 const randomSalt=()=>{const out=new Uint8Array(16);crypto.getRandomValues(out);return urlB64(out);};
 async function makeProof(password,salt,iterations=ITERATIONS){
   const source=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
   const raw=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:toBytes(salt),iterations},source,256));
   return Array.from(raw,b=>b.toString(16).padStart(2,'0')).join('');
 }
 let onAuthenticated=null,tab='login',initialized=false;
 let signedIn=null,revision=0;
 const eMsg=msg=>{el('auth-error').textContent=msg||'';};
 function setTab(next){
   tab=next;const register=next==='register';
   el('auth-form').hidden=!['login','register'].includes(next);
   el('verify-panel').hidden=next!=='verify';
   el('reset-panel').hidden=next!=='reset';
   document.querySelectorAll('[data-auth-tab]').forEach(button=>{
     const active=button.dataset.authTab===next;
     button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
   });
   document.querySelectorAll('.register-only').forEach(x=>x.hidden=!register);
   el('auth-name').required=register;el('auth-confirm').required=register;
   el('auth-submit').textContent=register?'建立我的帳號':'登入資產中心';
   el('auth-card-title').textContent={login:'歡迎回來',register:'建立專屬財務空間',verify:'驗證 Email',reset:'重設登入密碼'}[next];
   el('auth-card-desc').textContent={login:'登入後查看儲存在 Google Sheets 的專屬資產。',register:'建立自己的雲端資產帳號，並以 Email 完成驗證。',verify:'請輸入已寄到信箱的八位數驗證碼。',reset:'先寄送驗證碼，再設定新密碼。'}[next];
   eMsg('');
 }
 function showLogin(){
   el('app-shell').hidden=true;el('auth-screen').hidden=false;
   el('auth-form').reset();el('auth-password').type='password';el('auth-confirm').type='password';
   document.querySelector('[data-auth-toggle]').textContent='顯示';
   document.body.classList.remove('mobile-open','privacy-on');
   setTab('login');
 }
 async function enter(result){
   if(!result||!result.user||!result.portfolio)throw new Error('登入回應缺少帳號或資產資料');
   if(result.token) WealthAPI.setToken(result.token);
   signedIn=result.user;revision=Number(result.revision)||0;
   await onAuthenticated({user:result.user,data:result.portfolio,key:'GAS-SESSION',sharePrivateKey:null});
   el('auth-password').value='';el('auth-confirm').value='';
 }
 async function handleSubmit(e){
   e.preventDefault();const button=el('auth-submit');if(button.disabled)return;
   button.disabled=true;eMsg('');
   try{
     const fd=new FormData(e.target),email=emailOf(fd.get('email')),password=String(fd.get('password')||'');
     validatePass(password);
     if(tab==='register'){
       const name=String(fd.get('name')||'').trim();
       if(name.length<2||name.length>36)throw new Error('名稱需 2–36 字');
       if(password!==String(fd.get('confirm')||''))throw new Error('兩次密碼不一致');
       const salt=randomSalt(),proof=await makeProof(password,salt);
       await WealthAPI.call('auth.register',{email,name,salt,proof});
       el('verify-email').value=email;setTab('verify');
     }else{
       const info=await WealthAPI.call('auth.salt',{email});
       const proof=await makeProof(password,info.salt,info.iterations);
       try{await enter(await WealthAPI.call('auth.login',{email,proof}));}
       catch(err){if(err.code==='VERIFY_REQUIRED'){el('verify-email').value=email;setTab('verify');}throw err;}
     }
   }catch(err){eMsg(err.message||'帳號操作失敗');}
   finally{button.disabled=false;button.textContent=tab==='register'?'建立我的帳號':'登入資產中心';}
 }
 async function handleVerify(e){e.preventDefault();const button=el('verify-submit');if(button.disabled)return;button.disabled=true;eMsg('');
   try{await enter(await WealthAPI.call('auth.verify',{email:emailOf(el('verify-email').value),code:el('verify-code').value.trim()}));}
   catch(err){eMsg(err.message||'驗證失敗');}
   finally{button.disabled=false;}
 }
 async function resend(){eMsg('');try{await WealthAPI.call('auth.resend',{email:emailOf(el('verify-email').value)});eMsg('如果帳號仍待驗證，系統已重新寄送驗證碼。');}catch(err){eMsg(err.message);}}
 async function resetRequest(){eMsg('');try{const email=emailOf(el('reset-email').value);await WealthAPI.call('auth.reset.request',{email});eMsg('若此 Email 已註冊，驗證碼已寄送。請查看信箱。');}catch(err){eMsg(err.message);}}
 async function handleReset(e){e.preventDefault();const button=el('reset-submit');if(button.disabled)return;button.disabled=true;eMsg('');
   try{const email=emailOf(el('reset-email').value),password=el('reset-password').value;
     validatePass(password);if(password!==el('reset-confirm').value)throw new Error('兩次密碼不一致');
     const salt=randomSalt(),proof=await makeProof(password,salt);
     await WealthAPI.call('auth.reset.complete',{email,code:el('reset-code').value.trim(),salt,proof});
     setTab('login');el('auth-email').value=email;eMsg('密碼已更新，請使用新密碼登入。');
   }catch(err){eMsg(err.message||'無法重設密碼');}finally{button.disabled=false;}
 }
 async function savePortfolio(id,_key,data){
   if(!signedIn||id!==signedIn.id)throw new Error('尚未登入，或資料使用者不相符');
   const result=await WealthAPI.call('portfolio.save',{revision,data});
   revision=Number(result.revision);return result;
 }
 async function changePassword(id,oldPassword,newPassword){
   if(!signedIn||id!==signedIn.id)throw new Error('尚未登入');
   validatePass(newPassword);if(oldPassword===newPassword)throw new Error('新密碼不可與舊密碼相同');
   const email=signedIn.email,info=await WealthAPI.call('auth.salt',{email});
   const currentProof=await makeProof(oldPassword,info.salt,info.iterations),newSalt=randomSalt(),newProof=await makeProof(newPassword,newSalt);
   const done=await WealthAPI.call('auth.password',{currentProof,newSalt,newProof});
   WealthAPI.clearToken();signedIn=null;revision=0;return done;
 }
 async function logout(){
   try{if(WealthAPI.getToken())await WealthAPI.call('auth.logout');}
   finally{signedIn=null;revision=0;WealthAPI.clearToken();}
 }
 function setup(handler){
   if(initialized)return;initialized=true;onAuthenticated=handler;showLogin();
   if(!crypto?.subtle){eMsg('本環境無法使用安全加密 API，請透過 HTTPS 開啟網站。');el('auth-submit').disabled=true;return;}
   if(!WealthAPI.configured()){
     eMsg('尚未設定 GAS API 網址。請先修改 frontend/js/config.js 中的 apiUrl，再重新載入網頁。');
     el('auth-submit').disabled=true;return;
   }
   el('auth-form').addEventListener('submit',handleSubmit);
   el('verify-form').addEventListener('submit',handleVerify);
   el('reset-form').addEventListener('submit',handleReset);
   document.addEventListener('click',e=>{
     const tabButton=e.target.closest('[data-auth-tab]');if(tabButton){setTab(tabButton.dataset.authTab);return;}
     if(e.target.closest('[data-auth-toggle]')){const input=el('auth-password');input.type=input.type==='password'?'text':'password';e.target.textContent=input.type==='password'?'顯示':'隱藏';return;}
     if(e.target.closest('[data-auth-forgot]')){setTab('reset');el('reset-email').value=el('auth-email').value;return;}
     if(e.target.closest('[data-auth-resend]')){resend();return;}
     if(e.target.closest('[data-auth-reset-request]')){resetRequest();return;}
     if(e.target.closest('[data-auth-back]')){setTab('login');return;}
   });
   if(WealthAPI.getToken()){
     WealthAPI.call('auth.me').then(enter).catch(e=>{
       WealthAPI.clearToken();eMsg('尚未恢復登入：'+e.message+'，請重新登入。');
     });
   }
 }
 window.WealthAuth={setup,showLogin,savePortfolio,changePassword,logout,directory:()=>signedIn?[signedIn]:[],storageKey:WealthAPI.sessionKey};
})();
