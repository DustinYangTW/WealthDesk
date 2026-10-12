/** WealthDesk direct GAS ContentService adapter; no intermediate API server. */
(() => {
  'use strict';
  const KEY='wealthdesk-gas-session-v1';
  const cfg=()=>window.WEALTHDESK_CONFIG||{};
  const apiUrl=()=>String(cfg().apiUrl||'').trim();
  let token='';
  try {token=sessionStorage.getItem(KEY)||'';}catch (_){}
  const configured=()=>/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(apiUrl());
  function setToken(value){token=String(value||'');try{if(token)sessionStorage.setItem(KEY,token);else sessionStorage.removeItem(KEY);}catch(_){/* current-tab memory fallback */}}
  function clearToken(){setToken('');}
  async function call(action,fields={}){
    if(!configured())throw new Error('尚未設定 GAS API 網址，請先修改 frontend/js/config.js 的 apiUrl。');
    const ctrl=new AbortController(),timeout=Number(cfg().timeoutMs)||30000;
    const timer=setTimeout(()=>ctrl.abort(),timeout);
    try{
      const response=await fetch(apiUrl(),{
        method:'POST',mode:'cors',redirect:'follow',cache:'no-store',
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({action,...fields,token}),signal:ctrl.signal,credentials:'omit'
      });
      if(!response.ok)throw new Error(`GAS API HTTP ${response.status}`);
      let payload;
      try{payload=await response.json();}catch(_){throw new Error('無法解析 GAS 的 JSON 回應；請檢查部署權限與跨網域設定。');}
      if(!payload||typeof payload.ok!=='boolean')throw new Error('GAS 回應格式不正確');
      if(!payload.ok){
        const err=new Error(payload.error?.message||'GAS API 操作失敗');
        err.code=payload.error?.code||'UNKNOWN';
        if(err.code==='UNAUTHORIZED'){
          clearToken();window.dispatchEvent(new CustomEvent('wealthdesk:session-expired'));
        }
        throw err;
      }
      return payload.data;
    }catch(e){
      if(e.name==='AbortError')throw new Error('GAS API 逾時，請確認網路和服務狀態。');
      if(e instanceof TypeError)throw new Error('無法連線到 GAS。請確認 Web App URL、存取權，以及瀏覽器是否阻擋跨網域請求。');
      throw e;
    }finally{clearTimeout(timer);}
  }
  window.WealthAPI={call,setToken,clearToken,getToken:()=>token,configured,sessionKey:KEY};
})();
