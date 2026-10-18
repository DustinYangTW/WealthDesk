/* WealthDesk v6 - multiuser portfolio comparison, authorized read-only shared snapshots. */
(() => {
  'use strict';
  const LEGACY_KEY = 'wealthdesk-analytics-demo-v2';
  const seed = JSON.parse(document.getElementById('initial-json').textContent);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const icons = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
    wallet:'<path d="M20 7V5a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h14V7H6a3 3 0 0 1 0-6"/><path d="M21 12h-5a2 2 0 0 0 0 4h5"/><path d="M16.5 14h.01"/>',
    trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    pie:'<path d="M21.2 15.9A9 9 0 1 1 8.1 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    download:'<path d="M12 3v12M7 10l5 5 5-5M4 18v3h16v-3"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff:'<path d="M3 3l18 18M10.7 5.1c.42-.07.85-.1 1.3-.1 6.5 0 10 7 10 7a18 18 0 0 1-4 4.7M6.4 6.4A18.4 18.4 0 0 0 2 12s3.5 7 10 7c1.3 0 2.5-.3 3.6-.7"/><path d="M10.5 10.5a2.1 2.1 0 0 0 3 3"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    arrow:'<path d="M7 17 17 7M7 7h10v10"/>',
    swap:'<path d="M3 8h18M16 3l5 5-5 5M21 16H3m5-5-5 5 5 5"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    circle:'<circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14.6-4.3L3 9m0-5v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.3L21 15m0 5v-5h-5"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    credit:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    arrowdown:'<path d="M12 3v18m0 0 7-7m-7 7-7-7"/>',
    arrowup:'<path d="M12 21V3m0 0 7 7m-7-7-7 7"/>',
    minus:'<path d="M5 12h14"/>',
    users:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M14 15a5 5 0 0 1 8 4v1"/>'
  };
  const ic = (name, size=17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.circle}</svg>`;
  const types = {tw_stock:'台股',us_stock:'美股',fund:'基金'};
  const categoryColors = {cash:'#6476e9',tw_stock:'#2fbaa2',us_stock:'#f1b86a',fund:'#9f8aeb'};
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtNum = (n,d=0) => new Intl.NumberFormat('zh-TW',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(n)||0);
  const money = (v,c='TWD',decimals=null) => `${c==='TWD'?'NT$':c==='USD'?'US$':c+' '}${fmtNum(v,decimals==null?(c==='TWD'?0:2):decimals)}`;
  const twd = (v) => money(v,'TWD');
  const short = (v) => Math.abs(v)>=10000 ? `${fmtNum(v/10000,1)} 萬` : fmtNum(v);
  const pct = (v) => `${v>=0?'+':''}${fmtNum(v,2)}%`;
  const signMoney = (v) => `${v>=0?'+':'−'}${twd(Math.abs(v))}`;
  const dateZh = (date) => String(date||'').replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1/$2/$3');
  // Portfolio data is not initialized or rendered until authentication succeeds.
  const state = { data:null, user:null,cryptoKey:null,page:'overview',period:'6',stressPrice:0,stressFx:0,filter:'all',sort:'value',search:'',privacy:false,edit:null,sharePrivateKey:null,sharedView:null,familyRows:null,compareView:null,compareTarget:null,comparePeriod:'6',compareMode:'index',compareNeedsRefresh:false,bankHistoryMonth:null,holdingsHistoryMonth:null,historyImportPlan:null,toastTimeout:null };
  const $ = (s,from=document) => from.querySelector(s);
  const byId = (id) => document.getElementById(id);
  let persistQueue=Promise.resolve(),saveError=null,pendingSaves=0;
  function persist() {
    if(!state.user||!state.cryptoKey||!state.data)return Promise.reject(new Error('尚未登入'));
    const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
    if(state.data.meta.asOf<today)state.data.meta.asOf=today;
    const snapshot=clone(state.data),id=state.user.id,key=state.cryptoKey;
    pendingSaves++;
    // GAS versions must advance in order. Other devices cannot silently overwrite.
    persistQueue=persistQueue.catch(()=>{}).then(async()=>{
      try{await WealthAuth.savePortfolio(id,key,snapshot);saveError=null;}
      catch(e){saveError=e;throw e;}
    }).finally(()=>{pendingSaves--;});
    persistQueue.catch(e=>toast('雲端儲存失敗：'+e.message+'。請勿關閉頁面，請先匯出 JSON 備份。'));
    return persistQueue;
  }
  window.addEventListener('beforeunload',e=>{if(saveError||pendingSaves>0){e.preventDefault();e.returnValue='';}});
  async function startSession({user,data,key,sharePrivateKey}) {
    await WealthShares.refresh();
    const upgraded=WealthPro.migrate(data);
    const currentDay=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
    if(upgraded.meta.asOf<currentDay)upgraded.meta.asOf=currentDay;
    const needsUpgrade=JSON.stringify(upgraded)!==JSON.stringify(data);
    state.user=user;state.cryptoKey=key;state.data=upgraded;state.sharePrivateKey=sharePrivateKey;state.sharedView=null;state.familyRows=null;state.compareView=null;state.compareTarget=null;state.comparePeriod='6';state.compareMode='index';state.compareNeedsRefresh=false;
    state.page='overview';state.period='6';state.stressPrice=0;state.stressFx=0;state.filter='all';state.sort='value';state.search='';state.privacy=false;state.edit=null;state.bankHistoryMonth=null;state.holdingsHistoryMonth=null;state.historyImportPlan=null;
    byId('user-display-name').textContent=user.name;
    byId('user-email').textContent=user.email;
    byId('user-avatar').textContent=user.name.slice(0,1);
    byId('breadcrumb-owner').textContent=`${user.name}的資產中心`;
    byId('topbar-user').textContent=user.name;
    byId('auth-screen').hidden=true;
    byId('app-shell').hidden=false;
    byId('toast').hidden=true;
    document.body.classList.remove('mobile-open','privacy-on');
    WealthProUI.reset();render();
    if(needsUpgrade)persist();
    window.scrollTo(0,0);
  }
  async function logout() {
    try{await persistQueue;}catch(_){toast('部分資料未成功儲存，請先匯出 JSON 備份');return;}
    if(saveError){toast('上次雲端儲存失敗，請先匯出 JSON 備份，避免資料遺失');return;}
    try{await WealthAuth.logout();}catch(_){/* Always allow local logout. */}
    WealthShares.reset();
    const dialog=byId('edit-dialog');if(dialog.open)dialog.close();
    const passDialog=byId('password-dialog');if(passDialog.open)passDialog.close();
    const grantDialog=byId('grant-config-dialog');if(grantDialog?.open)grantDialog.close();
    state.user=null;state.cryptoKey=null;state.sharePrivateKey=null;state.sharedView=null;state.familyRows=null;state.compareView=null;state.compareTarget=null;state.data=null;state.edit=null;
    byId('view-root').replaceChildren();
    byId('app-shell').hidden=true;
    WealthAuth.showLogin();
  }
  async function changePassword(event) {
    event.preventDefault();
    const form=event.currentTarget,fd=new FormData(form),oldPassword=String(fd.get('oldPassword')||''),newPassword=String(fd.get('newPassword')||'');
    const error=byId('password-error'),button=byId('password-save-btn');
    error.textContent='';
    if(newPassword!==fd.get('confirmPassword')){error.textContent='兩次新密碼不一致';return;}
    button.disabled=true;button.textContent='更新中…';
    try{
      await persistQueue;
      await WealthAuth.changePassword(state.user.id,oldPassword,newPassword);
      byId('password-dialog').close();form.reset();
      await logout();
      byId('auth-error').textContent='密碼已更新，所有舊 Session 都已撤銷，請重新登入。';
    }catch(e){error.textContent=e.message||'變更密碼失敗';}
    finally{button.disabled=false;button.textContent='更新密碼';}
  }
  async function importLegacy() {
    let raw=null;try{raw=localStorage.getItem(LEGACY_KEY);}catch(_){}
    if(!raw){toast('找不到 v2 本機資料');return;}
    if(!window.confirm('將舊版 v2 資產資料匯入目前帳號？會覆蓋此帳號的全部資產及分析資料。匯入成功後會清除舊版未加密的本機資料。'))return;
    try{
      const input=JSON.parse(raw);
      if(!Array.isArray(input.bankAccounts)||!Array.isArray(input.holdings)||!input.fxRates||typeof input.fxRates!=='object')throw new Error('舊資料格式不正確');
      const merged={...clone(seed),...input,meta:{...seed.meta,...input.meta},fxRates:{...seed.fxRates,...input.fxRates,TWD:1},history:Array.isArray(input.history)?input.history:[],activity:Array.isArray(input.activity)?input.activity:[]};
      state.data=WealthPro.migrate(merged);
      await persist();
      localStorage.removeItem(LEGACY_KEY);
      render();toast('v2 資產資料已匯入目前帳號，舊版明文資料已清除');
    }catch(e){toast(`舊版匯入失敗：${e.message}`);}
  }
  const rate = (c) => Number(state.data.fxRates[c])||1;
  const calcHolding = (h) => { const fx=rate(h.currency), cost=Number.isFinite(Number(h.costTwd))?Number(h.costTwd):Number(h.quantity)*Number(h.avgCost)*fx, value=Number(h.quantity)*Number(h.currentPrice)*fx; return {...h,costTwd:cost,valueTwd:value,pnlTwd:value-cost,pnlPct:cost?((value-cost)/cost*100):0}; };
  const summary = () => {
    const banks=state.data.bankAccounts.reduce((s,b)=>s+Number(b.balance)*rate(b.currency),0);
    const holdings=state.data.holdings.map(calcHolding),invest=holdings.reduce((s,p)=>s+p.valueTwd,0),cost=holdings.reduce((s,p)=>s+p.costTwd,0);
    const groups={cash:banks,tw_stock:0,us_stock:0,fund:0}; holdings.forEach(h=>groups[h.type]=(groups[h.type]||0)+h.valueTwd);
    return {banks,invest,total:banks+invest,pnl:invest-cost,roi:cost?(invest-cost)/cost*100:0,groups,holdings};
  };
  function bankLogo(b,index=0){const n=state.data.bankAccounts.findIndex(x=>x.id===b.id);const classN=n>=0?n%5:index%5;return `<span class="entity-mark ${classN?'is-bank'+(classN+1):''}">${esc(String(b.bank||'帳戶').slice(0,2))}</span>`;}
  function assetLogo(h){const text=h.type==='tw_stock'?h.symbol.slice(0,2):h.type==='us_stock'?h.symbol.slice(0,2):'基';return `<span class="asset-symbol ${h.type==='us_stock'?'us':h.type==='fund'?'fund':''}">${esc(text)}</span>`;}
  function heroHeader(title,desc,kicker='FINANCIAL OVERVIEW',action='') {return `<div class="page-heading"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div><div class="page-actions"><span class="demo-pill">${ic('circle',12)} CLOUD DATA</span>${action}</div></div>`;}
  function metric(title,value,foot,iconName,extra='',primary=false) {return `<section class="panel kpi-card ${primary?'total-card':''}"><div class="mini-label">${esc(title)}</div><span class="kpi-icon">${ic(iconName,17)}</span><div class="value num sensitive">${value}</div><div class="kpi-foot">${foot}</div>${extra}</section>`;}
  function drawTrend() {
    const items=analysis().history.slice(-6).map(x=>({...x}));
    if(items.length<2){const hasImportedHistory=(state.data.history||[]).length||(state.data.bankHistory||[]).length||(state.data.holdingsHistory||[]).length;return renderEmpty('歷史資料不足',hasImportedHistory?'已匯入的月度總覽、銀行餘額與歷史持倉都會納入資產趨勢；目前至少需要兩個不同月份才能看出變化。':'請匯入至少兩個不同月份的月度總覽、銀行餘額或歷史持倉資料，才能顯示資產趨勢。');}
    const raw=items.map(x=>Number(x.totalTwd)); const floor=Math.floor(Math.min(...raw)*.96/100000)*100000;const ceil=Math.ceil(Math.max(...raw)*1.035/100000)*100000;const lower=ceil===floor?floor-100000:floor;const upper=ceil===floor?ceil+100000:ceil;
    const left=72,right=720,top=28,bottom=206;
    const pts=raw.map((v,i)=>({x:left+(right-left)*i/(raw.length-1||1),y:bottom-(v-lower)/(upper-lower)*(bottom-top),v,month:items[i].month.slice(5)}));
    const line=pts.reduce((path,p,i)=>i===0?`M${p.x.toFixed(1)},${p.y.toFixed(1)}`:path+` L${p.x.toFixed(1)},${p.y.toFixed(1)}`,'');
    const area=`${line} L${pts[pts.length-1].x},${bottom} L${pts[0].x},${bottom} Z`;
    const grid=Array.from({length:4},(_,i)=>{const y=top+(bottom-top)/3*i;const v=upper-(upper-lower)/3*i;return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#e9edf6" stroke-dasharray="4 6"/><text x="${left-12}" y="${y+3}" text-anchor="end" fill="#a7b0c0" font-size="10">${fmtNum(v/10000,0)}萬</text>`;}).join('');
    return `<svg class="value-chart" viewBox="0 0 755 250" role="img" aria-label="依目前帳號紀錄的每月資產總值變化趨勢"><defs><linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#6a74e8" stop-opacity=".19"/><stop offset="100%" stop-color="#6a74e8" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#area-fill)"/><path d="${line}" fill="none" stroke="#6572e5" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${pts.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="${i===pts.length-1?5:3.5}" fill="#fff" stroke="#6674e7" stroke-width="${i===pts.length-1?3:2}"><title>${esc(items[i].month)}｜${twd(p.v)}</title></circle><text x="${p.x}" y="239" text-anchor="middle" fill="#929eb0" font-size="11">${p.month}月</text>`).join('')}</svg>`;
  }
  function renderAllocation(s){
    const cats=[['cash','銀行存款'],['tw_stock','台股'],['us_stock','美股'],['fund','基金']];let cursor=0;
    const slices=cats.map(([key])=>{const deg=s.total?(s.groups[key]/s.total*360):0;const v=`${categoryColors[key]} ${cursor}deg ${cursor+deg}deg`;cursor+=deg;return v;}).join(', ');
    const legend=cats.map(([key,label])=>`<div class="legend-item"><i style="background:${categoryColors[key]}"></i><span>${label}</span><strong class="num">${s.total?fmtNum(s.groups[key]/s.total*100,1):'0.0'}%</strong></div>`).join('');
    return `<section class="panel chart-panel"><div class="panel-inner"><div class="panel-heading"><div><h2>資產配置</h2><p>依資產類別 · 換算新台幣</p></div>${ic('pie',18)}</div><div class="allocation-body"><div class="donut" style="background:conic-gradient(${s.total?slices:'#e8edf7 0deg 360deg'})"><div class="donut-center"><span>總資產</span><strong class="num sensitive">${short(s.total)}</strong></div></div><div class="allocation-legend">${legend}</div></div></div></section>`;
  }
  function bankLines(limit=5){ const bs=state.data.bankAccounts.slice(0,limit);return bs.length?bs.map((b,i)=>`<div class="account-line">${bankLogo(b,i)}<div class="account-descr"><strong>${esc(b.bank)}</strong><span>${esc(b.accountName)}</span></div><div class="account-balance"><strong class="num sensitive">${money(b.balance,b.currency)}</strong><span class="sensitive">${b.currency!=='TWD'?'≈ '+twd(b.balance*rate(b.currency)):'TWD'}</span></div></div>`).join(''):renderEmpty('尚未新增銀行帳戶','按右上角「新增帳戶」開始建立'); }
  function activityLines(){if(!(state.data.activity||[]).length)return renderEmpty('目前尚無資金動態','此區將顯示你記錄的資金變動');return (state.data.activity||[]).slice(0,4).map(t=>`<div class="activity-line"><span class="activity-icon ${t.kind==='investment'?'out':''}">${ic(t.kind==='investment'?'arrowdown':'arrowup',16)}</span><div class="activity-text"><strong>${esc(t.title)}</strong><span>${esc(t.subtitle)}</span></div><div class="activity-amount num ${t.amount>=0?'up':''} sensitive">${t.amount>0?'+':t.amount<0?'−':''}${money(Math.abs(t.amount),t.currency)}<span class="activity-date">${dateZh(t.date)}</span></div></div>`).join('');}
  function renderEmpty(title,text){return `<div class="empty-state">${ic('search',28)}<strong>${esc(title)}</strong><small>${esc(text)}</small></div>`;}
  function filteredHoldings(limit=Infinity){
    let items=summary().holdings.filter(h=>state.filter==='all'||h.type===state.filter);
    if(state.search.trim()){const q=state.search.toLowerCase().trim();items=items.filter(h=>[h.symbol,h.name,h.broker,types[h.type]].join(' ').toLowerCase().includes(q));}
    items.sort((a,b)=>state.sort==='profit'?b.pnlTwd-a.pnlTwd:state.sort==='date'?b.entryDate.localeCompare(a.entryDate):b.valueTwd-a.valueTwd);
    return items.slice(0,limit);
  }
  function holdingsTable(items,canEdit=true){
    if(!items.length)return renderEmpty('找不到符合條件的投資部位','請切換分類或調整搜尋關鍵字');
    return `<div class="table-wrap"><table class="asset-table"><thead><tr><th>投資標的</th><th>類別</th><th>首次進場日期</th><th class="align-r">持有數量</th><th class="align-r">平均成本</th><th class="align-r">現價 / 淨值</th><th class="align-r">市值 (TWD)</th><th class="align-r">未實現損益</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${items.map(h=>`<tr><td class="name-cell"><div class="asset-name">${assetLogo(h)}<span class="asset-name-info"><b>${esc(h.symbol)}</b><span>${esc(h.name)}</span></span></div></td><td><span class="type-pill ${h.type}">${types[h.type]}</span></td><td class="num">${dateZh(h.entryDate)}</td><td class="align-r num">${fmtNum(h.quantity,h.quantity%1?2:0)}</td><td class="align-r num sensitive">${money(h.avgCost,h.currency,2)}</td><td class="align-r num sensitive">${money(h.currentPrice,h.currency,2)}</td><td class="align-r num strong sensitive">${twd(h.valueTwd)}</td><td class="align-r num"><span class="pnl-value sensitive ${h.pnlTwd>=0?'up':'down'}">${signMoney(h.pnlTwd)}<small>${pct(h.pnlPct)}</small></span></td>${canEdit?`<td><button type="button" class="table-action" data-action="edit-holding" data-id="${esc(h.id)}" aria-label="編輯 ${esc(h.symbol)}">編輯</button></td>`:''}</tr>`).join('')}</tbody></table></div>
    <div class="mobile-holdings">${items.map(h=>`<div class="holding-mobile"><div><div class="holding-mobile-title">${assetLogo(h)}<div class="asset-name-info"><b>${esc(h.symbol)} · ${esc(h.name)}</b><span>${esc(types[h.type])} · ${esc(h.broker)}</span></div></div><div class="mobile-meta"><span>進場 ${dateZh(h.entryDate)}</span><span>成本 <b class="sensitive">${money(h.avgCost,h.currency,2)}</b></span></div>${canEdit?`<button class="table-action" data-action="edit-holding" data-id="${esc(h.id)}">編輯部位 ${ic('chevron',12)}</button>`:''}</div><div class="holding-mobile-right"><strong class="num sensitive">${twd(h.valueTwd)}</strong><small class="num sensitive ${h.pnlTwd>=0?'up':'down'}">${signMoney(h.pnlTwd)} (${pct(h.pnlPct)})</small></div></div>`).join('')}</div>`;
  }
  function renderOverview(){const s=summary(),history=analysis().history,previous=Number(history.at(-2)?.totalTwd||s.total),diff=s.total-previous;return `<div class="content">
    ${heroHeader('每一筆資產，都清楚掌握。','彙整銀行存款、台股、美股與基金，一頁看懂你的財務全貌。','YOUR FINANCIAL OVERVIEW',`<button class="primary-btn" data-action="add-holding">${ic('plus',15)} 新增投資</button>`)}
    <div class="kpi-grid">
      ${metric('總金融資產',twd(s.total),`<strong>${diff>=0?'+':'−'}${twd(Math.abs(diff))}</strong><span>相較上月總值（含資金流動）</span>`,'trend','',true)}
      ${metric('銀行存款',twd(s.banks),`<strong>${state.data.bankAccounts.length} 個帳戶</strong><span>· ${fmtNum(s.total?s.banks/s.total*100:0,1)}% 配置</span>`,'wallet')}
      ${metric('投資部位市值',twd(s.invest),`<strong>${state.data.holdings.length} 個部位</strong><span>· 台美股／基金</span>`,'pie')}
      ${metric('未實現投資損益',signMoney(s.pnl),`<strong class="${s.pnl>=0?'up':'down'}">${pct(s.roi)}</strong><span>相對持有成本，不含稅費</span>`,'arrow')}
    </div>
    <div class="analytics-grid"><section class="panel chart-panel"><div class="panel-inner"><div class="panel-heading"><div><h2>總資產趨勢</h2><p>月度總覽、銀行餘額與歷史持倉快照</p></div><span class="panel-topline">近 6 個月</span></div>${drawTrend()}<div class="chart-caption"><span><i></i>台幣總值</span><span>總資產變化含存提款與外部資金流，並非單純投資報酬率</span></div></div></section>${renderAllocation(s)}</div>
    ${WealthProUI.overview(state.data)}
    <div class="analysis-teaser panel"><div class="teaser-intro"><span class="teaser-symbol">${ic('trend',22)}</span><div><span class="eyebrow">SMART FINANCIAL INSIGHTS</span><h2>不只記帳，更要看懂資產表現。</h2><p>目前外幣曝險、前三大持倉集中度、獲利部位與現金水位，都可以從 JSON 即時計算。</p></div></div><div class="teaser-metrics"><span><small>外幣曝險</small><b>${precise(analysis().currencyWeight)}</b></span><span><small>前三大持倉占比</small><b>${precise(analysis().top3Weight)}</b></span><span><small>獲利部位數</small><b>${analysis().profitable} / ${s.holdings.length}</b></span></div><button class="primary-btn" data-page="analytics">開啟深度分析 ${ic('chevron',15)}</button></div>
    <div class="second-grid"><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>銀行帳戶</h2><p>多家銀行與不同幣別的可用資金</p></div><button class="link-btn" data-page="banks">查看全部 ${ic('chevron',13)}</button></div><div class="account-list">${bankLines(5)}</div></div></section><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>近期資金動態</h2><p>你建立的資金紀錄 · 尚未直接連接銀行</p></div><span class="panel-topline">個人紀錄</span></div><div class="activity-list">${activityLines()}</div></div></section></div>
    <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>主要投資部位</h2><p>依市值排序 · 成本與損益換算台幣</p></div><button class="link-btn" data-page="investments">全部 ${state.data.holdings.length} 筆 ${ic('chevron',13)}</button></div>${holdingsTable([...s.holdings].sort((a,b)=>b.valueTwd-a.valueTwd).slice(0,6),false)}<div class="data-caption">資訊由目前帳號的紀錄計算；買進費用計入持有成本，已實現損益與股息請至交易流水頁查看。</div></div></section></div>`;}
  // All analytics widgets below are derived from editable JSON, never hard-coded totals.
  const analysis = () => WealthAnalytics.analyze(state.data);
  const precise = (v, n=1) => Number.isFinite(v) ? `${fmtNum(v,n)}%` : '—';
  const signedPercent = v => v===null || !Number.isFinite(v) ? '—' : pct(v);
  const displaySign = v => v===null || !Number.isFinite(v) ? '資料不足' : signMoney(v);
  const upDown = v => v>=0?'up':'down';
  const labelCurrency = {TWD:'新台幣 TWD',USD:'美元 USD',JPY:'日圓 JPY'};
  function analyticsMetric(title, value, subtext, glyph, color='') {
    return `<section class="panel analytics-metric"><div class="analytics-metric-header"><span>${esc(title)}</span><i>${ic(glyph,16)}</i></div><strong class="analytics-metric-value num sensitive ${color}">${value}</strong><small>${subtext}</small></section>`;
  }
  function barList(items,maxValue,labelFn,emptyText='尚無資料') {
    if(!items.length)return renderEmpty(emptyText,'新增帳戶或部位後即可自動分析');
    return `<div class="rank-list">${items.map((item,i)=>`<div class="rank-line"><div class="rank-heading"><span class="rank-name"><b>${fmtNum(i+1)}</b>${esc(labelFn(item))}</span><strong class="num sensitive">${twd(item.value??item.valueTwd)}</strong></div><div class="track"><div class="fill" style="width:${Math.max(0,Math.min(100,(item.value??item.valueTwd)/(maxValue||1)*100))}%;background:${i===0?'#666fe2':i===1?'#40bbaa':'#9ea8d9'}"></div></div><div class="rank-sub">占總金融資產 ${precise(item.weightPct)}</div></div>`).join('')}</div>`;
  }
  function chartHistoryMobile(source){
    const rows=source.slice(-7);
    if(rows.length<2)return '';
    const W=360,L=15,R=344,T=12,B=145;
    const yFor=(values,val)=>{const min=Math.min(...values),max=Math.max(...values);const gap=Math.max(max-min,1);return B-(val-min+gap*.13)/(gap*1.26)*(B-T);};
    const line=(fn,values)=>rows.map((r,i)=>`${i?'L':'M'}${(L+(R-L)*i/(rows.length-1)).toFixed(1)},${yFor(values,fn(r)).toFixed(1)}`).join(' ');
    const totals=rows.map(r=>r.totalTwd),cashOk=rows.every(r=>r.cashTwd!==null&&r.cashTwd!==undefined&&Number.isFinite(Number(r.cashTwd)));
    const cash=rows.map(r=>Number(r.cashTwd));
    const totalPath=line(r=>r.totalTwd,totals);
    const cashPath=cashOk?line(r=>Number(r.cashTwd),cash):'';
    const months=rows.map((r,i)=>i===0||i===rows.length-1||i===Math.round((rows.length-1)/2)?`<text x="${L+(R-L)*i/(rows.length-1)}" y="170" text-anchor="middle" font-size="11" fill="#8694ac">${esc(r.month.slice(5))}月</text>`:'').join('');
    return `<svg class="mobile-analysis-history-svg" viewBox="0 0 360 181" role="img" aria-label="近幾個月總資產與銀行存款相對趨勢；兩者使用不同刻度"><line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="#e4e8f3"/><line x1="${L}" x2="${R}" y1="75" y2="75" stroke="#edf0f7" stroke-dasharray="3 5"/><path d="${totalPath}" fill="none" stroke="#6572e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${cashOk?`<path d="${cashPath}" fill="none" stroke="#23b09d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`:''}${months}</svg><p class="mobile-chart-note">趨勢對照使用各自刻度，僅比較變化方向，不代表金額相等。</p>`;
  }
  function chartHistory(result, selected) {
    const rows=selected.list;
    if(rows.length<2){const hasImportedHistory=(state.data.history||[]).length||(state.data.bankHistory||[]).length||(state.data.holdingsHistory||[]).length,detail=hasImportedHistory?'已匯入的月度總覽、銀行餘額與歷史持倉都會納入資產趨勢；目前至少需要兩個不同月份才能看出變化。':'請匯入至少兩個不同月份的月度總覽、銀行餘額或歷史持倉資料。';return renderEmpty('歷史資料不足',detail);}
    const min=Math.min(...rows.map(r=>r.totalTwd));
    const max=Math.max(...rows.map(r=>r.totalTwd));
    const low=Math.max(0,Math.floor((min-(max-min)*.35)/200000)*200000);
    const high=Math.max(low+200000,Math.ceil((max+(max-min)*.20)/200000)*200000);
    const L=77,R=875,T=24,B=251;
    const pt=(v,i)=>({x:L+(R-L)*(i/(rows.length-1)),y:B-(v-low)/(high-low)*(B-T)});
    const line = fn => rows.map((r,i)=>{const p=pt(fn(r),i);return `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;}).join(' ');
    const totals=line(r=>r.totalTwd);
    const cashOk=rows.every(r=>Number.isFinite(Number(r.cashTwd))&&r.cashTwd!==null&&r.cashTwd!==undefined);
    const cashMin=cashOk?Math.min(...rows.map(r=>Number(r.cashTwd))):0;
    const cashMax=cashOk?Math.max(...rows.map(r=>Number(r.cashTwd))):0;
    const cashLower=cashMin-Math.max(20000,(cashMax-cashMin)*.3);
    const cashUpper=cashMax+Math.max(20000,(cashMax-cashMin)*.3);
    const cashLine=cashOk?rows.map((r,i)=>{const x=L+(R-L)*i/(rows.length-1),y=B-(Number(r.cashTwd)-cashLower)/(cashUpper-cashLower)*(B-T);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join(' '):'';
    const rightAxis=cashOk?[0,2,4].map(i=>{const v=cashLower+(cashUpper-cashLower)*i/4,y=B-(B-T)*i/4;return `<text x="${R+8}" y="${y+3}" font-size="10" fill="#38a797" text-anchor="start">${fmtNum(v/10000,0)}萬</text>`;}).join(''):'';
    const area=`${totals} L${R},${B} L${L},${B} Z`;
    const lines=[0,1,2,3,4].map(i=>{const v=low+(high-low)*i/4,y=B-(B-T)*i/4;return `<line x1="${L}" x2="${R}" y1="${y}" y2="${y}" stroke="#e7ebf4" stroke-dasharray="4 6"/><text x="${L-13}" y="${y+3}" font-size="11" fill="#96a4b8" text-anchor="end">${fmtNum(v/10000,0)}萬</text>`;}).join('');
    const points=rows.map((r,i)=>{const p=pt(r.totalTwd,i);return `<circle cx="${p.x}" cy="${p.y}" r="4" stroke="#626ddd" stroke-width="2" fill="#fff"><title>${esc(r.month)} 總金融資產：${twd(r.totalTwd)}</title></circle>`;}).join('');
    const tickStride=rows.length>9?2:1;
    const dates=rows.map((r,i)=>{if(i%tickStride!==0&&i!==rows.length-1)return '';const p=pt(r.totalTwd,i);return `<text x="${p.x}" y="282" font-size="11" fill="#90a0b5" text-anchor="middle">${esc(r.month.slice(5))}月</text>`;}).join('');
    return `<svg class="analysis-history-svg" viewBox="0 0 920 299" role="img" aria-label="所選期間總資產與銀行存款趨勢"><defs><linearGradient id="analysis-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#6574ee" stop-opacity="0.20"/><stop offset="100%" stop-color="#6574ee" stop-opacity="0"/></linearGradient></defs>${lines}${rightAxis}<path d="${area}" fill="url(#analysis-area)"/><path d="${totals}" fill="none" stroke="#6572e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${cashOk?`<path d="${cashLine}" fill="none" stroke="#21b29b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`:''}${points}${dates}</svg>${chartHistoryMobile(rows)}<div class="legend-inline"><span><i style="background:#6572e5"></i>總金融資產</span>${cashOk?'<span><i style="background:#21b29b"></i>銀行存款</span>':''}<span class="note-inline">左軸：總資產／右軸：銀行存款 · 新台幣</span></div>`;
  }
  function historyContribution(selected) {
    if(!selected.months.length)return renderEmpty('尚無月度變化','請提供至少兩個月份的資料');
    const max=Math.max(1,...selected.months.flatMap(m=>[Math.abs(m.netFlowTwd||0),Math.abs(m.valuationTwd||0)]));
    return `<div class="flow-bars">${selected.months.map(m=>{
      const known=m.netFlowTwd!==null&&m.valuationTwd!==null;
      return `<div class="flow-row"><span class="flow-month">${esc(m.month.slice(5))}月</span><div class="flow-lines"><div class="flow-bar" title="外部淨入金：${known?twd(m.netFlowTwd):'未知'}"><i class="flow-fill flow-cash" style="width:${known?Math.max(1,Math.abs(m.netFlowTwd)/max*100):0}%"></i></div><div class="flow-bar" title="估算評價變動：${known?twd(m.valuationTwd):'未知'}"><i class="flow-fill ${m.valuationTwd<0?'flow-negative':'flow-valuation'}" style="width:${known?Math.max(1,Math.abs(m.valuationTwd)/max*100):0}%"></i></div></div><strong class="num sensitive ${upDown(m.deltaTwd)}">${signMoney(m.deltaTwd)}</strong></div>`;}).join('')}</div><div class="legend-inline"><span><i style="background:#3ebdae"></i>外部淨入金</span><span><i style="background:#6876e6"></i>估算評價變動</span><span><i style="background:#e06e7b"></i>負向評價變動</span></div>`;
  }
  function analyticsSegmentRows(result){
    const investments=result.groups.filter(g=>g.key!=='cash');
    const max=Math.max(1,...investments.map(c=>Math.abs(c.pnlTwd)));
    return `<div class="segments-grid">${investments.map(c=>`<article class="segment-card"><div class="segment-head"><span class="segment-dot" style="background:${categoryColors[c.key]}"></span><strong>${esc(c.name)}</strong><span>${c.count} 筆</span></div><div class="segment-main"><span class="num sensitive">${twd(c.valueTwd)}</span><strong class="num sensitive ${upDown(c.pnlTwd)}">${signMoney(c.pnlTwd)}</strong></div><div class="segment-foot"><span>投入成本 <b class="num sensitive">${twd(c.costTwd)}</b></span><span class="${upDown(c.pnlTwd)}">${signedPercent(c.roiPct)}</span></div><div class="segment-track"><i style="width:${Math.max(2,Math.abs(c.pnlTwd)/max*100)}%;background:${c.pnlTwd>=0?'#19aa8f':'#e06e7b'}"></i></div></article>`).join('')}</div>`;
  }
  function roiRanking(items,losses=false) {
    const results=items.filter(x=>losses?x.pnlTwd<0:x.pnlTwd>0).slice(0,5);
    if(!results.length)return `<div class="empty-mini">目前沒有${losses?'虧損':'獲利'}部位</div>`;
    const max=Math.max(1,...results.map(x=>Math.abs(x.pnlTwd)));
    return `<div class="pnl-list">${results.map(h=>`<div class="pnl-row"><span>${assetLogo(h)}</span><div class="pnl-description"><b>${esc(h.symbol)}</b><small>${esc(h.name)}</small><div class="mini-track"><i style="width:${Math.abs(h.pnlTwd)/max*100}%;background:${losses?'#e67d86':'#2db99c'}"></i></div></div><div class="pnl-stat num sensitive ${upDown(h.pnlTwd)}"><b>${signMoney(h.pnlTwd)}</b><small>${signedPercent(h.roiPct)}</small></div></div>`).join('')}</div>`;
  }
  function exposureRows(items) {
    if(!items.length)return renderEmpty('尚無資料','新增銀行或投資部位即可檢視曝險');
    const palette=['#6674e4','#2db9a1','#edb56a','#a28aec','#7896b8','#94c8e2'];
    return `<div class="exposure-list">${items.map((item,i)=>`<div class="exposure-item"><div class="exposure-heading"><strong>${esc(item.key)}</strong><span class="num sensitive">${twd(item.value)} <b>${precise(item.weightPct)}</b></span></div><div class="track"><div class="fill" style="width:${Math.max(0,Math.min(100,item.weightPct))}%;background:${palette[i%palette.length]}"></div></div></div>`).join('')}</div>`;
  }
  function alertsBlock(result){
    return `<div class="risk-list">${result.risks.map(r=>`<div class="risk-row"><span class="risk-marker ${r.level}">${ic(r.level==='attention'?'circle':'check',17)}</span><div><strong>${esc(r.label)}</strong><p>${esc(r.detail)}</p></div><span class="risk-level ${r.level}">${r.level==='attention'?'值得關注':'一般'}</span></div>`).join('')}</div>`;
  }
  function agesBlock(a){const labels=[['under6','未滿 6 個月'],['under12','6–12 個月'],['under24','1–2 年'],['over24','超過 2 年']];return `<div class="age-grid">${labels.map(([k,label])=>`<div class="age-cell"><strong class="num">${a.ages[k]}</strong><span>${label}</span></div>`).join('')}</div><div class="tiny-help">平均持有 ${a.averageHoldDays===null?'—':fmtNum(a.averageHoldDays)+' 天'}（以首次進場日期估算）</div>`;}
  function monthlyTable(p) {
    return `<div class="table-wrap"><table class="analytics-table"><thead><tr><th>月份</th><th class="align-r">資產總額</th><th class="align-r">月度增減</th><th class="align-r">外部淨入金</th><th class="align-r">估算評價變動</th><th class="align-r">估算比率</th></tr></thead><tbody>${[...p.months].reverse().map(m=>`<tr><td>${esc(m.month)}</td><td class="align-r num sensitive">${twd(m.totalTwd)}</td><td class="align-r num sensitive ${upDown(m.deltaTwd)}">${signMoney(m.deltaTwd)}</td><td class="align-r num sensitive">${m.netFlowTwd===null?'—':signMoney(m.netFlowTwd)}</td><td class="align-r num sensitive ${m.valuationTwd!==null?upDown(m.valuationTwd):''}">${displaySign(m.valuationTwd)}</td><td class="align-r num ${m.valuationPct!==null?upDown(m.valuationPct):''}">${signedPercent(m.valuationPct)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function scenarioCalc(a,investmentChange,fxChange) {
    const foreignBanks=a.banks.filter(b=>b.currency!=='TWD').reduce((s,x)=>s+x.valueTwd,0);
    const domesticBanks=a.cash-foreignBanks;
    const foreignInvestments=a.holdings.filter(h=>h.currency!=='TWD').reduce((s,x)=>s+x.valueTwd,0);
    const domesticInvestments=a.invest-foreignInvestments;
    const investmentFactor=1+investmentChange/100, fxFactor=1+fxChange/100;
    const scenario=domesticBanks+foreignBanks*fxFactor+domesticInvestments*investmentFactor+foreignInvestments*investmentFactor*fxFactor;
    return {total:scenario,diff:scenario-a.total,impactPct:WealthAnalytics.percentage(scenario-a.total,a.total)};
  }
  function scenarioView(a){const out=scenarioCalc(a,state.stressPrice,state.stressFx);return `<section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>情境壓力測試</h2><p>自行調整投資部位價格與外幣匯率變動，觀察總資產敏感度</p></div><span class="panel-topline">假設情境 · 非預測</span></div><div class="scenario-layout"><div class="slider-stack"><div class="slider-row"><label for="stress-price">投資部位同幅漲跌 <strong class="num" id="stress-price-label">${signedPercent(state.stressPrice)}</strong></label><input id="stress-price" aria-label="投資部位同幅漲跌百分比" type="range" min="-25" max="25" step="1" value="${state.stressPrice}"/><div class="range-extremes"><span>−25%</span><span>0%</span><span>+25%</span></div></div><div class="slider-row"><label for="stress-fx">外幣兌台幣匯率變動 <strong class="num" id="stress-fx-label">${signedPercent(state.stressFx)}</strong></label><input id="stress-fx" aria-label="外幣匯率變動百分比" type="range" min="-15" max="15" step="1" value="${state.stressFx}"/><div class="range-extremes"><span>−15%</span><span>0%</span><span>+15%</span></div></div><button class="text-action" type="button" data-action="scenario-reset">${ic('refresh',14)} 重設情境</button></div><div class="scenario-result"><span>模擬情境總資產</span><strong id="stress-total" class="num sensitive">${twd(out.total)}</strong><div id="stress-diff" class="scenario-change num sensitive ${upDown(out.diff)}">${signMoney(out.diff)} (${signedPercent(out.impactPct)})</div><div class="scenario-foot">目前基準 ${twd(a.total)} · 依原幣市值和展示匯率試算</div></div></div><p class="method-note">假設銀行台幣存款不變；所有投資標的同步變動相同比例；外幣資產同時受到匯率影響。未納入價格相關性、負債、利息與交易成本。</p></div></section>`;}
  function refreshScenario() {
    const a=analysis(),r=scenarioCalc(a,state.stressPrice,state.stressFx);
    const set=(id,textValue)=>{const el=byId(id);if(el)el.textContent=textValue;};
    set('stress-price-label',signedPercent(state.stressPrice));set('stress-fx-label',signedPercent(state.stressFx));set('stress-total',twd(r.total));set('stress-diff',`${signMoney(r.diff)} (${signedPercent(r.impactPct)})`);
    const diff=byId('stress-diff');if(diff){diff.classList.toggle('up',r.diff>=0);diff.classList.toggle('down',r.diff<0);}
  }
  function renderAnalytics() {
    const a=analysis(),p=WealthAnalytics.periodStats(a,state.period);
    const monthsText=p.monthCount?`涵蓋 ${p.monthCount} 個完整月度區間`:'缺少歷史快照';
    const currencyItems=a.currencies.map(c=>({...c,key:labelCurrency[c.key]||c.key}));
    const top=a.positionsByValue[0];
    return `<div class="content analytics-view">
      ${heroHeader('把資產數字，變成決策依據。','從資產成長、資金投入、投資績效到集中度與幣別曝險，完整檢視你的財務配置。','WEALTH INTELLIGENCE',`<button class="outline-btn" data-action="export-analysis">${ic('download',15)} 匯出持倉 CSV</button><button class="outline-btn" data-action="export-report-json">${ic('database',15)} 分析 JSON</button>`)}
      <div class="analysis-toolbar"><div class="analysis-toolbar-context">${ic('calendar',17)} <b>分析期間</b><span>${monthsText}</span></div><div class="tabs" role="group" aria-label="期間篩選">${[['3','近 3 個月'],['6','近 6 個月'],['12','近 12 個月'],['all','全部']].map(([key,label])=>`<button class="tab ${state.period===key?'active':''}" data-action="analysis-period" data-period="${key}" aria-pressed="${state.period===key}">${label}</button>`).join('')}</div></div>
      <div class="analysis-metric-grid">
        ${analyticsMetric('期間資產淨變動',signMoney(p.deltaTwd),`${monthsText} · 資產成長率 ${signedPercent(p.growthPct)}`,'trend',upDown(p.deltaTwd))}
        ${analyticsMetric('外部資金淨投入',displaySign(p.netFlowTwd),'只計入外部存入減提領；買賣股票不算新投入','wallet')}
        ${analyticsMetric('估算評價變動',displaySign(p.valuationTwd),`資產變動 − 淨入金 · 約 ${signedPercent(p.valPct)}`,'arrow',p.valuationTwd===null?'':upDown(p.valuationTwd))}
        ${analyticsMetric('目前未實現投資報酬',signedPercent(a.roiPct),`未實現損益 ${signMoney(a.pnl)} · 依現價和平均成本計算`,'pie',upDown(a.pnl))}
      </div>
      <div class="analysis-primary-grid">
        <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>資產成長軌跡</h2><p>總金融資產 vs 銀行存款 · 按月追蹤</p></div><span class="panel-topline">${esc(p.list[0]?.month||'—')} — ${esc(p.list.at(-1)?.month||'—')}</span></div>${chartHistory(a,p)}</div></section>
        <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>每月變動從哪裡來？</h2><p>拆分外部存提與剩餘估算評價變動</p></div></div>${historyContribution(p)}<p class="micro-disclaimer">${p.flowsAvailable?'右側數字為該月份資產總額增減；藍綠色條長度為變動絕對值。':'歷史資產總額與變化已計入匯入快照；因未提供外部淨流入，無法拆分存提款與估值變動。'}</p></div></section>
      </div>
      <div class="analysis-section-heading"><div><span class="eyebrow">PERFORMANCE BREAKDOWN</span><h2>投資績效解剖</h2><p>不是只有總獲利，還要了解獲利來自哪些部位與市場。</p></div><span class="method-chip">當前持倉 · 不含已實現損益</span></div>
      <div class="four-points">
        <div><span>投資市值</span><strong class="num sensitive">${twd(a.invest)}</strong></div>
        <div><span>持有成本</span><strong class="num sensitive">${twd(a.cost)}</strong></div>
        <div><span>獲利／虧損部位</span><strong>${a.profitable} <span class="up">獲利</span> / ${a.losing} <span class="down">虧損</span></strong></div>
        <div><span>持有部位獲利占比</span><strong class="num">${precise(a.winRatePct)}</strong></div>
      </div>
      ${analyticsSegmentRows(a)}
      <div class="analysis-half-grid">
        <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>${ic('arrowup',16)} 獲利貢獻排行</h2><p>按未實現獲利金額排序，而非勝率</p></div></div>${roiRanking(a.gainers)}</div></section>
        <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>${ic('arrowdown',16)} 虧損部位追蹤</h2><p>按未實現虧損金額由大至小排序</p></div></div>${roiRanking(a.losers,true)}</div></section>
      </div>
      <div class="analysis-section-heading"><div><span class="eyebrow">EXPOSURE & RISK</span><h2>資產曝險與集中度</h2><p>從貨幣、機構與單一標的角度，盤點風險來源。</p></div></div>
      <div class="risk-summary-grid">
        ${analyticsMetric('銀行存款占比',precise(WealthAnalytics.percentage(a.cash,a.total)),`可運用存款 ${twd(a.cash)}`,'wallet')}
        ${analyticsMetric('外幣資產占比',precise(a.currencyWeight),`外幣市值約 ${twd(a.foreignExposure)}`,'swap')}
        ${analyticsMetric('前三大持倉集中度',precise(a.top3Weight),`最大部位 ${esc(top?.symbol||'—')} · ${precise(a.topPositionWeight)}`,'pie')}
        ${analyticsMetric('最大機構資產比重',precise(a.institutionTopWeight),esc(a.institutions[0]?.key||'尚無機構'),'database')}
      </div>
      <div class="analysis-half-grid">
        <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>資產幣別分布</h2><p>以目前展示匯率換算新台幣 · 占全部金融資產</p></div></div>${exposureRows(currencyItems)}</div></section>
        <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>銀行與券商分布</h2><p>銀行餘額與券商託管部位依機構名稱彙整</p></div></div>${exposureRows(a.institutions.slice(0,7))}</div></section>
      </div>
      <div class="analysis-half-grid">
        <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>配置健康檢查</h2><p>僅使用簡易比例門檻提示，非個人化理財建議</p></div></div>${alertsBlock(a)}</div></section>
        <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>持倉時間分布</h2><p>依首次進場日期分類 · 持有部位數量</p></div></div>${agesBlock(a)}<div class="key-position"><span>最大單一投資部位</span><div>${top?`${assetLogo(top)}<span><b>${esc(top.symbol)}</b><small class="num sensitive">${twd(top.valueTwd)} · ${precise(a.topPositionWeight)} 投資占比</small></span>`:'尚無投資部位'}</div></div></div></section>
      </div>
      ${scenarioView(a)}
      <section class="panel monthly-panel"><div class="panel-inner"><div class="panel-heading"><div><h2>月度資產變化明細</h2><p>用月份拆分總資產增減、外部淨入金，以及簡易估算評價變動</p></div><button class="outline-btn" data-action="export-monthly">${ic('download',14)} 月報 CSV</button></div>${monthlyTable(p)}<p class="method-note">估算評價變動 = 本月資產總額 − 上月資產總額 − 當月外部淨入金。估算比率 = 估算評價變動 ÷ 上月資產總額。這並非時間加權報酬率 (TWR) 或資金加權報酬率 (XIRR)，也不等於已實現獲利。</p></div></section>
      <div class="methodology"><span>${ic('circle',19)}</span><div><strong>資料方法與限制</strong><p>資料與月度快照皆由本帳號的 JSON 紀錄計算，存款及市值以目前設定匯率換算台幣。v6 持有成本已依交易日匯率及費用計入，但此處未實現損益不等於含已實現損益、配息及稅費的整體投資報酬。TWR／XIRR 須另行記錄完整估值事件與外部資金流；詳細結果請至「績效」頁查看。</p></div></div>
    </div>`;
  }
  function exportAnalysisCSV(){
    const a=analysis();
    const headers=['代碼','名稱','類別','券商','幣別','首次進場','持有股數/單位','平均成本','現價/淨值','成本(TWD)','市值(TWD)','未實現損益(TWD)','未實現報酬率(%)','持有天數'];
    const data=a.holdings.map(h=>[h.symbol,h.name,types[h.type],h.broker,h.currency,h.entryDate,h.quantity,h.avgCost,h.currentPrice,h.costTwd,h.valueTwd,h.pnlTwd,h.roiPct,h.daysHeld??'']);
    const sanitizeCell=v=>{const str=String(v??'');const safe=/^[=+@\-\t\r]/.test(str)&&typeof v==='string'?`'${str}`:str;return `"${safe.replace(/"/g,'""')}"`;};
    const content='\ufeff'+[headers,...data].map(row=>row.map(sanitizeCell).join(',')).join('\r\n');
    const file=new Blob([content],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download='wealthdesk-holdings-analysis.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('分析明細 CSV 已匯出');
  }

  function downloadReport(filename,blob){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  const csvRows=(header,rows)=>'\ufeff'+[header,...rows].map(row=>row.map(value=>{let str=String(value??'');if(typeof value==='string'&&/^[=+@\-\t\r]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
  function exportMonthlyCSV(){
    const a=analysis(),p=WealthAnalytics.periodStats(a,state.period);
    const headings=['月份','資產總額(TWD)','資產變動(TWD)','外部淨入金(TWD)','估算評價變動(TWD)','估算變動率(%)'];
    const lines=p.months.map(m=>[m.month,m.totalTwd,m.deltaTwd,m.netFlowTwd??'',m.valuationTwd??'',m.valuationPct??'']);
    downloadReport('wealthdesk-monthly-analysis.csv',new Blob([csvRows(headings,lines)],{type:'text/csv;charset=utf-8'}));
    toast('月度分析 CSV 已匯出');
  }
  function exportReportJSON(){
    const a=analysis(),p=WealthAnalytics.periodStats(a,state.period);
    const report={meta:{asOf:a.asOf,baseCurrency:'TWD',source:'derived-from-mock-json',period:state.period,disclaimer:'估算評價變動非精確 TWR／XIRR；目前匯率折算成本，不含費稅、配息或已實現損益。'},metrics:{total:a.total,cash:a.cash,invest:a.invest,cost:a.cost,unrealizedPnL:a.pnl,unrealizedReturnPct:a.roiPct,profitableHoldings:a.profitable,losingHoldings:a.losing,top3HoldingWeightPct:a.top3Weight,foreignCurrencyWeightPct:a.currencyWeight,largestInstitutionWeightPct:a.institutionTopWeight},period:{monthCount:p.monthCount,changeTwd:p.deltaTwd,growthPct:p.growthPct,netExternalFlowTwd:p.netFlowTwd,estimatedValuationChangeTwd:p.valuationTwd,estimatedValuationRatePct:p.valPct},categories:a.groups,currencies:a.currencies,institutions:a.institutions,holdings:a.holdings,monthlyHistory:p.list,risks:a.risks};
    downloadReport('wealthdesk-analytics-report.json',new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'}));
    toast('統計分析 JSON 已匯出');
  }

  function historyMonthOptions(records,selected){return records.map(x=>`<option value="${esc(x.month)}" ${x.month===selected?'selected':''}>${esc(x.month)}</option>`).join('');}
  function historyPanelHeader(title,desc,records,selected,kind){return `<div class="panel-heading"><div><h2>${title}</h2><p>${desc}</p></div>${records.length?`<label class="history-month-picker"><span>月份</span><select class="input-select" data-history-month-kind="${kind}" aria-label="選擇${title}月份">${historyMonthOptions(records,selected)}</select></label>`:''}</div>`;}
  function renderBankHistory(){const records=[...(state.data.bankHistory||[])].sort((a,b)=>a.month.localeCompare(b.month)),selected=records.some(x=>x.month===state.bankHistoryMonth)?state.bankHistoryMonth:records.at(-1)?.month,snapshot=records.find(x=>x.month===selected),accounts=snapshot?.accounts||[],total=accounts.reduce((sum,x)=>sum+Number(x.valueTwd||0),0);return `<section class="panel history-panel"><div class="panel-inner">${historyPanelHeader('歷史銀行餘額','目前帳戶金額不會自動寫入歷史；按上方「存成當月歷史快照」後會顯示在這裡。',records,selected,'bank')}${snapshot?`<div class="history-total">${esc(selected)} · 台幣換算合計 <strong class="num sensitive">${twd(total)}</strong></div><div class="history-table-wrap"><table class="history-table"><thead><tr><th>銀行</th><th>帳戶用途</th><th>幣別</th><th class="align-r">月末餘額</th><th class="align-r">月末匯率</th><th class="align-r">台幣換算</th></tr></thead><tbody>${accounts.map(x=>`<tr><td>${esc(x.bank)}</td><td>${esc(x.accountName)}</td><td>${esc(x.currency)}</td><td class="align-r num sensitive">${money(x.balance,x.currency)}</td><td class="align-r num">${fmtNum(x.fxRate,4)}</td><td class="align-r num sensitive">${twd(x.valueTwd)}</td></tr>`).join('')}</tbody></table></div>`:renderEmpty('尚無歷史銀行餘額','在資料設定匯入 Excel 範本中的「銀行餘額」工作表')}</div></section>`;}
  function renderHoldingsHistory(){const records=[...(state.data.holdingsHistory||[])].sort((a,b)=>a.month.localeCompare(b.month)),selected=records.some(x=>x.month===state.holdingsHistoryMonth)?state.holdingsHistoryMonth:records.at(-1)?.month,snapshot=records.find(x=>x.month===selected),items=snapshot?.holdings||[],total=items.reduce((sum,x)=>sum+Number(x.marketValueTwd||0),0);return `<section class="panel history-panel"><div class="panel-inner">${historyPanelHeader('歷史持倉','依月份保存數量、月末價格與匯率。資料不會加入目前交易流水。',records,selected,'holdings')}${snapshot?`<div class="history-total">${esc(selected)} · 投資市值合計 <strong class="num sensitive">${twd(total)}</strong></div><div class="history-table-wrap"><table class="history-table"><thead><tr><th>標的</th><th>類別</th><th>券商／帳戶</th><th>幣別</th><th class="align-r">持有數量</th><th class="align-r">月末價格</th><th class="align-r">市值 TWD</th><th class="align-r">平均成本</th></tr></thead><tbody>${items.map(x=>`<tr><td><strong>${esc(x.symbol)}</strong><small>${esc(x.name)}</small></td><td>${esc(types[x.type]||x.type)}</td><td>${esc([x.broker,x.accountName].filter(Boolean).join(' · ')||'—')}</td><td>${esc(x.currency)}</td><td class="align-r num">${fmtNum(x.quantity,4)}</td><td class="align-r num">${money(x.currentPrice,x.currency,2)}</td><td class="align-r num sensitive">${twd(x.marketValueTwd)}</td><td class="align-r num">${x.avgCost===null?'—':money(x.avgCost,x.currency,2)}</td></tr>`).join('')}</tbody></table></div>`:renderEmpty('尚無歷史持倉','在資料設定匯入 Excel 範本中的「歷史持倉」工作表')}</div></section>`;}
  function carryBankHistoryForward(){
    const snapshots=[...(state.data.bankHistory||[])].sort((a,b)=>a.month.localeCompare(b.month)),snapshot=snapshots.at(-1),accounts=snapshot?.accounts||[];
    if(!snapshot||!accounts.length){toast('找不到可帶入的銀行歷史快照');return;}
    const current=state.data.bankAccounts.map(b=>({...b})),key=b=>[b.bank,b.accountName,b.currency].map(x=>String(x||'').trim().toLocaleLowerCase()).join('|');
    let added=0,updated=0;
    accounts.forEach((item,index)=>{
      const existing=current.find(b=>key(b)===key(item));
      if(existing){existing.balance=Number(item.balance);existing.updatedAt=snapshot.month;updated++;}
      else{current.push({id:`bank-${Date.now()}-${index}`,bank:item.bank,accountName:item.accountName,currency:item.currency,balance:Number(item.balance),updatedAt:snapshot.month});added++;}
    });
    if(!window.confirm(`將 ${snapshot.month} 的歷史快照帶入目前帳戶：新增 ${added} 個帳戶、更新 ${updated} 個同銀行、代稱與幣別帳戶的餘額。帳戶餘額日期會保留為 ${snapshot.month}；歷史快照不會刪除。帶入後可逐筆編輯成目前金額。要繼續嗎？`))return;
    state.data=WealthPro.migrate({...state.data,bankAccounts:current});const task=persist();render();task.then(()=>toast(`已帶入 ${snapshot.month} 快照：新增 ${added} 個帳戶、更新 ${updated} 個。請再修正為目前餘額。`)).catch(()=>{});
  }
  async function saveBankHistorySnapshot(){
    const accounts=state.data.bankAccounts||[];
    if(!accounts.length){toast('目前沒有銀行帳戶可以保存');return;}
    const month=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}).slice(0,7),existing=(state.data.bankHistory||[]).some(x=>x.month===month);
    const message=existing?`${month} 已有歷史快照。要用目前 ${accounts.length} 個帳戶的金額覆蓋這個月份嗎？`:`要將目前 ${accounts.length} 個銀行帳戶存成 ${month} 歷史快照嗎？保存後會顯示在下方歷史資料。`;
    if(!window.confirm(message))return;
    const previous=state.data,previousMonth=state.bankHistoryMonth,snapshot={id:`bank-history-${month}`,month,accounts:accounts.map(account=>{const balance=Number(account.balance),fxRate=rate(account.currency);return {bank:account.bank,accountName:account.accountName,currency:account.currency,balance,fxRate,valueTwd:balance*fxRate};})};
    state.data=WealthPro.migrate({...state.data,bankHistory:upsertHistoryMonths(state.data.bankHistory,[snapshot])});state.bankHistoryMonth=month;render();
    try{await persist();toast(`${month} 歷史快照已保存，共 ${accounts.length} 個帳戶。`);}
    catch(error){state.data=previous;state.bankHistoryMonth=previousMonth;render();toast(`歷史快照儲存失敗：${error.message||'請稍後再試'}`);}
  }
  function renderBanks(){const s=summary(),usd=state.data.bankAccounts.filter(b=>b.currency==='USD').reduce((sum,b)=>sum+Number(b.balance),0),bankHistory=[...(state.data.bankHistory||[])].sort((a,b)=>a.month.localeCompare(b.month)),latestBankSnapshot=bankHistory.at(-1),snapshotMonth=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}).slice(0,7),hasCurrentMonthSnapshot=bankHistory.some(x=>x.month===snapshotMonth);return `<div class="content">${heroHeader('銀行帳戶','統一管理各家銀行存款、幣別餘額與帳戶資訊。','BANK ACCOUNTS',`${latestBankSnapshot?`<button class="outline-btn" data-action="convert-bank-history">${ic('refresh',15)} 帶入 ${esc(latestBankSnapshot.month)} 快照</button>`:''}${state.data.bankAccounts.length?`<button class="outline-btn" data-action="snapshot-bank-history">${ic('calendar',15)} ${hasCurrentMonthSnapshot?'更新':'存成'} ${snapshotMonth} 歷史快照</button>`:''}<button class="primary-btn" data-action="add-bank">${ic('plus',15)} 新增帳戶</button>`)}
    <div class="sub-kpi-grid"><section class="panel sub-kpi"><span>存款總額 · TWD 換算</span><strong class="num sensitive">${twd(s.banks)}</strong><small>${state.data.bankAccounts.length} 個銀行帳戶</small></section><section class="panel sub-kpi"><span>新台幣存款</span><strong class="num sensitive">${twd(state.data.bankAccounts.filter(b=>b.currency==='TWD').reduce((a,b)=>a+Number(b.balance),0))}</strong><small>原幣金額</small></section><section class="panel sub-kpi"><span>美元存款</span><strong class="num sensitive">${money(usd,'USD')}</strong><small>約 ${twd(usd*rate('USD'))}</small></section></div>
    <div class="section-row"><h2 class="section-title">全部銀行帳戶</h2><span class="text-help">金額以自行記錄的餘額計算</span></div><div class="bank-grid">${state.data.bankAccounts.map((b,i)=>`<div class="panel bank-card"><div class="bank-card-top">${bankLogo(b,i)}<div class="account-descr"><strong>${esc(b.bank)}</strong><span>${esc(b.accountName)}</span></div><span class="type-pill">${esc(b.currency)}</span></div><div class="bank-card-amount num sensitive">${money(b.balance,b.currency)}</div><div class="bank-card-foot"><span>${b.currency==='TWD'?'台幣存款':'約 '+twd(Number(b.balance)*rate(b.currency))} · ${dateZh(b.updatedAt)} 更新</span><button class="link-btn" data-action="edit-bank" data-id="${esc(b.id)}">編輯 ${ic('chevron',13)}</button></div></div>`).join('')||renderEmpty('還沒有銀行帳戶',latestBankSnapshot?`已匯入 ${bankHistory.length} 個月份的歷史餘額（最新 ${latestBankSnapshot.month}）。按上方「帶入 ${latestBankSnapshot.month} 快照」建立帳戶，再逐筆修正餘額即可。`:'按新增帳戶建立你的第一筆紀錄')}</div>
    <div class="insight-row">${ic('circle',18)}<span><strong>幣別換算說明：</strong>美元按照你設定的匯率 1 USD = ${fmtNum(rate('USD'),2)} TWD 換算。帳戶金額需手動維護，沒有連接任何銀行。</span></div>${renderBankHistory()}
    </div>`;}
  function renderInvestments(){const s=summary();return `<div class="content">${heroHeader('投資部位管理','查看台股、美股與基金的首次進場日期、持有成本及未實現損益。','INVESTMENT PORTFOLIO',`<button class="primary-btn" data-action="add-holding">${ic('plus',15)} 新增投資</button>`)}
    <div class="sub-kpi-grid"><section class="panel sub-kpi"><span>投資總市值 · TWD</span><strong class="num sensitive">${twd(s.invest)}</strong><small>依手動設定的匯率換算</small></section><section class="panel sub-kpi"><span>總持有成本 · TWD</span><strong class="num sensitive">${twd(s.invest-s.pnl)}</strong><small>數量 × 平均成本 × 匯率</small></section><section class="panel sub-kpi"><span>未實現損益</span><strong class="num sensitive ${s.pnl>=0?'up':'down'}">${signMoney(s.pnl)}</strong><small>${pct(s.roi)} · 未扣成本與稅費</small></section></div>
    <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>全部持有部位</h2><p>單筆成本與現價皆以標的原幣計算，市值與總損益換算成台幣</p></div><span class="panel-topline" id="match-count">${filteredHoldings().length} 筆部位</span></div>
    <div class="table-toolbar"><div class="tabs" role="group" aria-label="投資類別篩選">${[['all','全部'],['tw_stock','台股'],['us_stock','美股'],['fund','基金']].map(([key,name])=>`<button class="tab ${state.filter===key?'active':''}" data-action="filter" data-filter="${key}" aria-pressed="${state.filter===key}">${name}</button>`).join('')}</div><div style="display:flex;flex-wrap:wrap;gap:9px"><label class="search-box">${ic('search',15)}<input id="investment-search" type="search" placeholder="搜尋代碼、名稱或券商" value="${esc(state.search)}" aria-label="搜尋投資部位" /></label><select class="input-select" id="investment-sort" aria-label="投資部位排序"><option value="value" ${state.sort==='value'?'selected':''}>市值由高至低</option><option value="profit" ${state.sort==='profit'?'selected':''}>損益由高至低</option><option value="date" ${state.sort==='date'?'selected':''}>最近進場日期</option></select></div></div>
    <div id="holdings-results">${holdingsTable(filteredHoldings())}</div><div class="data-caption">平均成本以原幣記錄。若分批進場，請以加權平均成本填寫；「進場日期」記錄首次購入日期。</div></div></section>${renderHoldingsHistory()}</div>`;}
  function renderSettings(){const d=state.data;let hasLegacy=false;try{hasLegacy=!!localStorage.getItem(LEGACY_KEY);}catch(_){}
    const accountPanel=`<section class="panel account-profile-panel"><div class="panel-inner"><div class="account-profile-heading"><span class="profile-avatar">${esc(state.user.name.slice(0,1))}</span><div><span class="eyebrow">ACCOUNT & DATA PRIVACY</span><h2>帳號與資料空間</h2><p>目前登入：<strong>${esc(state.user.name)}</strong> · ${esc(state.user.email)}</p></div><span class="local-only-tag">GAS 雲端帳號</span></div><div class="account-privacy-grid"><div>${ic('shield',19)}<strong>依使用者儲存</strong><span>每個帳號都有獨立的銀行、持倉與分析資料。</span></div><div>${ic('database',19)}<strong>後端驗證</strong><span>資產資料由 GAS 檢查 Session 與帳號權限，保存於試算表。</span></div><div>${ic('circle',19)}<strong>跨裝置同步</strong><span>使用同一帳號可在其他裝置取得最新資料，忘記密碼可透過信箱重設。</span></div></div><div class="settings-actions"><button class="outline-btn" data-action="open-password">${ic('shield',15)} 變更密碼</button><button class="outline-btn" data-action="logout">${ic('arrow',15)} 登出／切換帳號</button>${hasLegacy?`<button class="outline-btn" data-action="import-legacy">${ic('database',15)} 匯入舊版 v2 資料</button>`:''}</div><p class="data-note">Google Sheets 由部署者保管，資料並非端對端加密；後端會驗證每次資料存取的權限。請定期匯出 JSON，並限制試算表分享權限。</p></div></section>`;
    return `<div class="content">${heroHeader('帳號、資料與設定','每位使用者都有專屬資產資料，可以在這裡變更密碼、匯入歷史資料或設定匯率。','DATA & PREFERENCES')}
    ${accountPanel}
    <div class="data-grid"><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>JSON 資料預覽</h2><p>顯示目前帳號在雲端儲存的部分資料</p></div><button class="outline-btn" data-action="copy-json">${ic('credit',14)} 複製 JSON</button></div><pre class="data-code" id="data-preview">${esc(JSON.stringify({meta:d.meta,fxRates:d.fxRates,bankAccounts:d.bankAccounts.slice(0,2),holdings:d.holdings.slice(0,2)},null,2))}</pre><div class="data-note">上方僅顯示部分範例；點選右上角「匯出 JSON」即可下載包含所有銀行帳戶、投資部位、歷史資料的完整內容。</div></div></section>
    <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>匯率設定</h2><p>統一以新台幣（TWD）計算淨資產</p></div>${ic('swap',18)}</div><form id="fx-form" class="settings-list"><div class="form-field"><label for="usd-rate">1 美元（USD）兌新台幣</label><input id="usd-rate" name="USD" type="number" min="0.0001" step="0.0001" required value="${esc(d.fxRates.USD)}"/><small>用於美元銀行帳戶、美股及美元基金</small></div><div class="form-field"><label for="jpy-rate">1 日圓（JPY）兌新台幣</label><input id="jpy-rate" name="JPY" type="number" min="0.0001" step="0.0001" required value="${esc(d.fxRates.JPY)}"/><small>可供後續擴充日圓資產使用</small></div><button type="submit" class="primary-btn" style="align-self:flex-start">${ic('check',15)} 儲存匯率</button></form><div class="divider"></div><div class="panel-heading"><div><h2>匯入歷史資產</h2><p>總覽、銀行餘額與持倉可分別填寫及匯入</p></div></div><div class="settings-actions"><a class="outline-btn" href="frontend/templates/wealthdesk-history-template.xlsx" download>${ic('download',15)} 下載 Excel 範本</a><button class="outline-btn" data-action="import-history">${ic('database',15)} 匯入 Excel 資料</button><input id="history-import-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden /></div><p class="data-note">只匯入有填資料的工作表。同月份重匯會更新該類別的快照，其他類別保留。「銀行餘額」只保存在銀行頁歷史資料，不會建立目前帳戶或出現在分析趨勢；分析頁趨勢讀取「月度總覽」，至少需要兩個月份。</p><div class="divider"></div><div class="panel-heading"><div><h2>雲端資料管理</h2><p>資料保存於 Google Sheets</p></div></div><div class="settings-actions"><button class="outline-btn" data-action="export-json">${ic('download',15)} 匯出完整 JSON</button><button class="outline-btn" data-action="import-json">${ic('database',15)} 匯入 JSON</button><input id="import-json-input" type="file" accept=".json,application/json" hidden /><button class="outline-btn" data-action="reset-data">${ic('refresh',15)} 清空我的資料</button></div><p class="data-note">系統會依 Session 將資料存入雲端，若儲存失敗請勿登出或關閉分頁。支援從本機 JSON 匯入完整資產資料。匯入會覆蓋目前帳號的雲端資產資料。請先匯出 JSON 備份。此系統不會直接連接銀行或券商。</p></div></section></div></div>`;}
  // v4 sharing: presentation is a separate read-only surface. It never passes
  // someone else's decrypted portfolio into the existing editor/store.
  const grantState=g=>g.expired?'expired':g.status;
  function grantBadge(g){const status=grantState(g);return `<span class="wd4-status wd4-${esc(status)}">${esc(g.statusLabel)}</span>`;}
  function userBubble(name,cls=''){return `<span class="wd4-avatar ${cls}">${esc(String(name||'U').slice(0,1))}</span>`;}
  function scopeLabel(scope){return WealthShares.scopes[scope]||scope;}
  function shareDate(value){return value?dateZh(String(value).slice(0,10)):'永久有效';}
  function sharingEventLine(e){
    const verbs={invited:'發出共享邀請',accepted:'接受共享邀請',declined:'拒絕共享邀請',updated:'更新共享範圍',revoked:'撤銷共享'};
    const who=e.actorId===e.ownerId?e.owner:e.viewer;
    return `<div class="wd4-event"><span class="wd4-event-dot"></span><div><strong>${esc(who)} · ${esc(verbs[e.type]||e.type)}</strong><small>${esc(e.owner)} → ${esc(e.viewer)} · ${esc(new Date(e.at).toLocaleString('zh-TW',{hour12:false}))}</small></div></div>`;
  }
  function renderSharing(){
    const grants=WealthShares.outgoing(state.user.id),active=grants.filter(g=>g.status==='active'&&!g.expired).length;
    const pending=grants.filter(g=>g.status==='pending'&&!g.expired).length;
    const events=WealthShares.eventsFor(state.user.id);
    return `<div class="content wd4-sharing">${heroHeader('我的共享管理','決定誰可以查看你的金融資產，以及允許對方看到多少內容。','SHARING & PERMISSIONS')}
      <div class="wd4-summary-strip"><div><span>${ic('shield',22)}</span><strong>你始終保有資產所有權</strong><small>預設唯讀 · 可隨時撤銷 · 不開放修改</small></div><div class="wd4-stat"><strong>${fmtNum(active)}</strong><span>共享中的使用者</span></div><div class="wd4-stat"><strong>${fmtNum(pending)}</strong><span>等待回覆的邀請</span></div></div>
      <div class="wd4-grid-main"><section class="panel wd4-invite-panel"><div class="panel-inner"><div class="panel-heading"><div><h2>邀請使用者</h2><p>使用對方已註冊的 Email 指定資產查看範圍</p></div><span class="wd4-box-icon">${ic('plus',19)}</span></div>
      <form id="share-invite-form" class="wd4-form">
       <div class="form-field"><label for="share-invite-email">受邀者 Email *</label><input name="email" id="share-invite-email" type="email" required placeholder="例如 friend@example.com" autocomplete="off" /></div>
       <div class="form-field"><label for="share-invite-scope">共享範圍 *</label><select name="scope" id="share-invite-scope" required><option value="summary">僅資產總覽（不含明細）</option><option value="investments">投資部位與統計</option><option value="full" selected>完整金融資產（唯讀）</option></select></div>
       <div class="form-field"><label for="share-expire">授權到期日 <span class="wd4-optional">（選填）</span></label><input name="expiresAt" id="share-expire" type="date" /><small>不設定則持續有效，直到你主動取消。</small></div>
       <label class="wd4-check"><input type="checkbox" name="allowExport" /><span>額外允許下載共享資料 JSON（預設禁止）</span></label>
       <p id="invite-error" class="field-warning" role="alert"></p>
       <button class="primary-btn wd4-full" type="submit">${ic('plus',15)} 發送查看邀請</button>
      </form></div></section>
      <section class="panel wd4-permissions-panel"><div class="panel-inner"><div class="panel-heading"><div><h2>目前的共享紀錄</h2><p>授權是單向的，A 能查看 B，不代表 B 能查看 A</p></div><span class="panel-topline">${grants.length} 筆邀請</span></div>
      ${grants.length?`<div class="wd4-grants">${grants.map(g=>`<div class="wd4-grant-row">${userBubble(g.viewerName)}<div class="wd4-grant-body"><div class="wd4-grant-title"><strong>${esc(g.viewerName)}</strong>${grantBadge(g)}</div><small>${esc(g.viewerEmail)}</small><div class="wd4-grant-tags"><span>${ic('eye',13)} ${esc(g.scopeLabel)}</span><span>${ic('calendar',13)} ${g.expiresAt?`至 ${shareDate(g.expiresAt)}`:'永久有效'}</span><span>${g.allowExport?'可匯出':'禁止匯出'}</span></div></div><div class="wd4-grant-actions">${['active','pending'].includes(g.status)&&!g.expired?`<button class="outline-btn wd4-compact" data-action="grant-config" data-id="${esc(g.id)}">設定</button><button class="outline-btn wd4-compact danger-btn" data-action="grant-revoke" data-id="${esc(g.id)}">撤銷</button>`:''}</div></div>`).join('')}</div>`:renderEmpty('還沒有共享任何資產','在左側輸入受邀者 Email，選擇要開放的資料範圍')}
      </div></section></div>
      <section class="panel wd4-log"><div class="panel-inner"><div class="panel-heading"><div><h2>共享操作紀錄</h2><p>保存在 GAS 的共享稽核紀錄（不含資產明細）</p></div>${ic('calendar',18)}</div><div class="wd4-events">${events.length?events.map(sharingEventLine).join(''):'<p class="wd4-muted">目前沒有共享操作紀錄。</p>'}</div></div></section>
      <div class="wd4-notice">${ic('circle',17)} 共享邀請支援跨裝置；GAS 在每次讀取時重新確認授權。撤銷後不可再讀取，但無法收回對方已下載或截圖的內容。</div>
    </div>`;
  }
  function renderSharedInbox(){
    const grants=WealthShares.incoming(state.user.id),invites=grants.filter(g=>g.status==='pending'&&!g.expired),active=grants.filter(g=>g.status==='active'&&!g.expired);
    const past=grants.filter(g=>!['active','pending'].includes(g.status)||g.expired);
    return `<div class="content wd4-sharing">${heroHeader('共享給我的資產','查看其他使用者授權給你的銀行、投資與統計資料，所有共享內容均為唯讀。','SHARED WITH ME')}
      <div class="wd4-summary-strip wd4-received-strip"><div><span>${ic('eye',22)}</span><strong>你能查看，但無法替他人修改</strong><small>這些資料不會計入你的個人資產</small></div><div class="wd4-stat"><strong>${fmtNum(active.length)}</strong><span>可查看的資產空間</span></div><div class="wd4-stat"><strong>${fmtNum(invites.length)}</strong><span>待接受邀請</span></div></div>
      ${invites.length?`<div class="wd4-section-title"><h2>等待你的回覆</h2><span>${invites.length} 個待處理邀請</span></div><div class="wd4-invite-cards">${invites.map(g=>`<article class="panel wd4-pending-card"><div class="wd4-card-head">${userBubble(g.ownerName,'wd4-purple')}<div><strong>${esc(g.ownerName)} 邀請你查看資產</strong><small>${esc(g.ownerEmail)}</small></div>${grantBadge(g)}</div><div class="wd4-card-scope">${ic('shield',15)} ${esc(g.scopeLabel)} <span>·</span> ${g.allowExport?'可匯出':'禁止匯出'} <span>·</span> ${shareDate(g.expiresAt)}</div><div class="wd4-button-row"><button class="primary-btn" data-action="grant-accept" data-id="${esc(g.id)}">${ic('check',15)} 接受邀請</button><button class="outline-btn" data-action="grant-decline" data-id="${esc(g.id)}">婉拒邀請</button></div></article>`).join('')}</div>`:''}
      <div class="wd4-section-title"><h2>可以查看的資產</h2><span>僅顯示已接受且尚未到期的授權</span></div>
      ${active.length?`<div class="wd4-asset-cards">${active.map(g=>`<article class="panel wd4-asset-card"><div class="wd4-card-head">${userBubble(g.ownerName,'wd4-purple')}<div><strong>${esc(g.ownerName)}的資產中心</strong><small>${esc(g.ownerEmail)}</small></div><span class="wd4-status wd4-active">唯讀</span></div><div class="wd4-access-meta"><span>${ic('eye',15)} ${esc(g.scopeLabel)}</span><span>${ic('calendar',15)} ${g.expiresAt?'至 '+shareDate(g.expiresAt):'持續有效'}</span></div><div class="wd4-card-footer"><small>授權更新：${esc(new Date(g.lastSharedAt||g.updatedAt).toLocaleString('zh-TW',{hour12:false}))}</small><div class="wd5-inbox-actions"><button class="outline-btn" data-action="compare-open" data-id="${esc(g.id)}">${ic('swap',14)} 與我比較</button><button class="primary-btn" data-action="grant-open" data-id="${esc(g.id)}">查看資產 ${ic('chevron',15)}</button></div></div></article>`).join('')}</div>`:renderEmpty('還沒有可查看的共享資產','請另一位使用者在「我的共享管理」使用你的 Email 發送邀請')}
      ${active.length?`<div class="wd4-family-invite"><div>${ic('pie',22)}<span><strong>家庭合計資產</strong><small>將我的資產加上已授權的其他帳號做估算統計</small></span></div><button class="outline-btn" data-action="open-family">查看合計分析 ${ic('arrow',15)}</button></div>`:''}
      ${past.length?`<div class="wd4-section-title"><h2>歷史邀請</h2><span>${past.length} 筆</span></div><div class="panel wd4-history-grants">${past.map(g=>`<div><span>${userBubble(g.ownerName)} ${esc(g.ownerName)} · ${esc(g.scopeLabel)}</span>${grantBadge(g)}</div>`).join('')}</div>`:''}
      <div class="wd4-notice">${ic('shield',17)} 此頁面不會合併你的個人資產與別人的資產。即使是完整共享，也只能查看、不能新增、修改或刪除對方資料。</div>
    </div>`;
  }
  function shareTrendSvg(history){
    const list=(history||[]).filter(h=>Number.isFinite(Number(h.totalTwd))).slice(-9);if(list.length<2)return renderEmpty('歷史資料不足','請資產擁有者補上每月資產快照');
    const values=list.map(h=>Number(h.totalTwd)),low=Math.min(...values),high=Math.max(...values),span=Math.max(1,high-low),W=740,H=205;
    const points=values.map((v,i)=>({x:20+i*700/(values.length-1),y:185-((v-low)/span)*143}));
    const path=points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area=path+` L${points.at(-1).x} 185 L20 185 Z`;
    return `<svg class="wd4-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="所共享帳號的歷史總資產趨勢"><defs><linearGradient id="wd4-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6474e6" stop-opacity=".18"/><stop offset="100%" stop-color="#6474e6" stop-opacity="0"/></linearGradient></defs>${[50,95,140,185].map(y=>`<line x1="20" x2="720" y1="${y}" y2="${y}" stroke="#e9edf7" stroke-dasharray="4 5"/>`).join('')}<path d="${area}" fill="url(#wd4-chart-fill)"/><path d="${path}" fill="none" stroke="#6675db" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>${points.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="3.7" fill="#fff" stroke="#6675db" stroke-width="2"><title>${esc(list[i].month)}：${twd(values[i])}</title></circle>`).join('')}</svg><div class="wd4-chart-dates"><span>${esc(list[0].month)}</span><span>總金融資產 · TWD</span><span>${esc(list.at(-1).month)}</span></div>`;
  }
  function shareAllocation(roll){const keys=[['cash','銀行存款','#6476e9'],['tw_stock','台股','#2fbaa2'],['us_stock','美股','#f1b86a'],['fund','基金','#9f8aeb']];return `<div class="wd4-alloc-list">${keys.map(([key,label,color])=>{const value=roll.groups?.[key]||0,p=roll.totalTwd?value/roll.totalTwd*100:0;return `<div><div class="wd4-alloc-title"><span><i style="background:${color}"></i>${label}</span><strong class="num sensitive">${twd(value)} <em>${fmtNum(p,1)}%</em></strong></div><div class="track"><span class="fill" style="width:${Math.min(100,p)}%;background:${color}"></span></div></div>`;}).join('')}</div>`;}
  function renderSharedDetail(){
    const item=state.sharedView;
    if(!item)return `<div class="content">${renderEmpty('尚未選擇共享資產','請回到共享給我的資產，選擇要查看的帳號')}</div>`;
    const {grant,data}=item,roll=data.rollup,holdings=data.holdings||[],banks=data.bankAccounts||[],history=data.history||[];
    const canHoldings=grant.scope!=='summary',canBanks=grant.scope==='full';
    return `<div class="content wd4-sharing wd4-shared-detail"><div class="wd4-backline"><button class="wd4-back" data-action="shared-back">${ic('chevron',15)} 返回共享資產</button><span class="wd4-view-only">${ic('eye',14)} 唯讀模式 · 禁止修改</span></div>
      ${heroHeader(`${grant.ownerName}的資產總覽`,`由 ${grant.ownerName} 授權你查看 · ${scopeLabel(grant.scope)} · 展示資料日期 ${data.asOf||'—'}`,'SHARED PORTFOLIO',`<div class="wd5-detail-actions"><button class="primary-btn" data-action="compare-open" data-id="${esc(grant.id)}">${ic('swap',15)} 和我的資產比較</button>${grant.allowExport?`<button class="outline-btn" data-action="grant-export">${ic('download',15)} 匯出已授權資料</button>`:''}</div>`)}
      <div class="wd4-readonly-banner">${ic('shield',19)} <div><strong>正在查看他人資產，這不是你的資產</strong><span>你可以瀏覽授權內容與統計圖表，但無法新增、編輯、刪除、修改匯率或重設資料。</span></div><span class="wd4-status wd4-active">只讀</span></div>
      <div class="wd4-kpi-grid"><section class="panel wd4-big-kpi"><span>總金融資產</span><strong class="num sensitive">${twd(roll.totalTwd)}</strong><small>銀行存款與投資市值合計</small></section><section class="panel wd4-big-kpi"><span>銀行存款</span><strong class="num sensitive">${twd(roll.cashTwd)}</strong><small>${roll.bankCount} 個銀行帳戶（僅顯示授權明細）</small></section><section class="panel wd4-big-kpi"><span>投資市值</span><strong class="num sensitive">${twd(roll.investTwd)}</strong><small>${roll.holdingCount} 筆投資部位</small></section><section class="panel wd4-big-kpi"><span>未實現損益</span><strong class="num sensitive ${roll.pnlTwd>=0?'up':'down'}">${signMoney(roll.pnlTwd)}</strong><small>成本報酬率 ${pct(roll.roiPct)}</small></section></div>
      <div class="wd4-insight-grid"><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>資產成長趨勢</h2><p>歷史快照 · 最近 ${Math.min(history.length,9)} 個月</p></div>${ic('trend',18)}</div>${shareTrendSvg(history)}</div></section><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>資產類別配置</h2><p>依所有者提供的最新估算市值</p></div>${ic('pie',18)}</div>${shareAllocation(roll)}</div></section></div>
      <div class="wd4-section-title"><h2>投資部位</h2><span>${canHoldings?`${holdings.length} 筆明細 · 唯讀`:'目前授權不包含投資明細'}</span></div>
      ${canHoldings?`<section class="panel"><div class="table-scroll"><table class="data-table wd4-table"><thead><tr><th>標的</th><th>類別</th><th>數量</th><th>平均成本</th><th>目前價格</th><th>首次進場</th><th>市值（TWD）</th><th>未實現損益</th></tr></thead><tbody>${holdings.map(h=>{const fx=Number(data.fxRates[h.currency]||1),cost=Number(h.quantity)*Number(h.avgCost)*fx,value=Number(h.quantity)*Number(h.currentPrice)*fx;return `<tr><td><strong>${esc(h.symbol)}</strong><small>${esc(h.name)}</small></td><td>${esc(types[h.type]||'基金')}</td><td class="num">${fmtNum(h.quantity,2)}</td><td class="num">${money(h.avgCost,h.currency,2)}</td><td class="num">${money(h.currentPrice,h.currency,2)}</td><td>${esc(dateZh(h.entryDate))}</td><td class="num sensitive">${twd(value)}</td><td class="num sensitive ${value-cost>=0?'up':'down'}">${signMoney(value-cost)}</td></tr>`;}).join('')}</tbody></table></div></section>`:`<div class="wd4-locked">${ic('shield',23)} <div><strong>投資持倉明細未開放</strong><span>資產擁有者目前僅授權總覽，你無法存取單一標的資料。</span></div></div>`}
      <div class="wd4-section-title"><h2>銀行帳戶</h2><span>${canBanks?`${banks.length} 個銀行帳戶 · 唯讀`:'目前授權不包含銀行明細'}</span></div>
      ${canBanks?`<div class="wd4-bank-grid">${banks.map(b=>`<article class="panel wd4-bank-item"><div><span class="wd4-bank-icon">${ic('wallet',18)}</span><div><strong>${esc(b.bank)}</strong><small>${esc(b.accountName)}</small></div></div><strong class="num sensitive">${money(b.balance,b.currency)}</strong><small>幣別 ${esc(b.currency)}</small></article>`).join('')}</div>`:`<div class="wd4-locked">${ic('shield',23)} <div><strong>銀行帳戶明細未開放</strong><span>為保護隱私，只有完整共享模式才會提供銀行列表。</span></div></div>`}
      <div class="wd4-notice">${ic('circle',17)} 共享畫面只使用 GAS 授權提供的資料。實際持有成本、報酬與資產歷史依擁有者填寫的資料計算，所有跨帳號讀取都由 GAS 驗證。</div>
    </div>`;
  }
  function renderFamily(){
    const rows=state.familyRows||[];
    const total=rows.reduce((s,x)=>s+x.rollup.totalTwd,0),cash=rows.reduce((s,x)=>s+x.rollup.cashTwd,0),invest=rows.reduce((s,x)=>s+x.rollup.investTwd,0);
    return `<div class="content wd4-sharing wd4-family"><div class="wd4-backline"><button class="wd4-back" data-action="shared-back">${ic('chevron',15)} 返回共享資產</button><span class="wd4-view-only">估算合計 · 不變更資料所有權</span></div>${heroHeader('家庭金融資產總覽','將我的資產與已獲授權查看的資產彙整，供家庭資產配置參考。','HOUSEHOLD VIEW')}
      <div class="wd4-kpi-grid wd4-family-kpis"><section class="panel wd4-big-kpi"><span>家庭合計資產</span><strong class="num sensitive">${twd(total)}</strong><small>${rows.length} 個獨立資產擁有者</small></section><section class="panel wd4-big-kpi"><span>銀行存款合計</span><strong class="num sensitive">${twd(cash)}</strong><small>所有已授權帳號</small></section><section class="panel wd4-big-kpi"><span>投資市值合計</span><strong class="num sensitive">${twd(invest)}</strong><small>與銀行存款分開統計</small></section></div>
      <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>各使用者資產比較</h2><p>不會在你的個人資產中重複加總共享帳戶</p></div>${ic('pie',18)}</div><div class="wd4-family-list">${rows.map(r=>`<div class="wd4-family-row">${userBubble(r.ownerName,r.isMine?'':'wd4-purple')}<div><strong>${esc(r.ownerName)} ${r.isMine?'<span>（我的）</span>':'<span>（授權查看）</span>'}</strong><div class="wd4-family-bar"><i style="width:${total?Math.max(1,r.rollup.totalTwd/total*100):0}%"></i></div></div><b class="num sensitive">${twd(r.rollup.totalTwd)}</b></div>`).join('')}</div></div></section>
      <div class="wd4-notice wd4-caution">${ic('circle',17)} 重要：這是各帳號「資產總額相加」的展示估算。若有共同帳戶、代持或相同資產重複記錄，本版無法自動去重；不是精確家庭淨值，也不包含負債。</div>
    </div>`;
  }

  // v5: compare only the logged-in user's portfolio with an authorized,
  // decrypted snapshot. Shared assets never enter the editing store.
  const comparePercent=v=>v===null||!Number.isFinite(v)?'—':`${fmtNum(v,1)}%`;
  const compareChange=v=>v===null||!Number.isFinite(v)?'—':`${v>=0?'+':'−'}${fmtNum(Math.abs(v),1)}%`;
  const comparePoints=v=>v===null||!Number.isFinite(v)?'—':`${v>=0?'+':'−'}${fmtNum(Math.abs(v),1)} pp`;
  const compareMoney=v=>v===null||!Number.isFinite(v)?'—':twd(v);
  const compareDifference=v=>v===null||!Number.isFinite(v)?'—':`${v>=0?'+':'−'}${twd(Math.abs(v))}`;
  const compareAccess=()=>WealthShares.incoming(state.user.id).filter(g=>g.status==='active'&&!g.expired);
  function compareEmpty(){return `<div class="content wd5-compare">${heroHeader('雙人資產比較','將自己的銀行、台股、美股與基金和已授權的使用者並排分析。','PORTFOLIO COMPARISON')}
    <section class="panel wd5-empty"><span class="wd5-empty-icon">${ic('users',27)}</span><h2>需要先取得資產共享授權</h2><p>接受其他帳號的邀請後，就能比較總資產、資產配置與共同月份的變化趨勢。沒有授權時，這裡不會讀取他人資料。</p><button class="primary-btn" data-page="shared">前往共享給我的資產 ${ic('chevron',15)}</button></section></div>`;}
  function compareCard(title,mine,peer,difference,hint,styles={}){
    const diffClass=difference===null?'':difference<0?'wd5-minus':'wd5-plus';
    return `<article class="panel wd5-metric-card"><div class="wd5-metric-head"><span>${esc(title)}</span>${ic('swap',17)}</div>
      <div class="wd5-metric-duo"><div><small><i class="wd5-dot wd5-mine"></i>我的</small><strong class="num sensitive">${mine}</strong></div><div><small><i class="wd5-dot wd5-peer"></i>對方</small><strong class="num sensitive">${peer}</strong></div></div>
      <div class="wd5-metric-foot"><span>我的 − 對方</span><strong class="num sensitive ${diffClass}">${difference===null?'—':styles.point?comparePoints(difference):styles.money?compareDifference(difference):compareChange(difference)}</strong></div>
      <p class="wd5-metric-help">${esc(hint)}</p></article>`;
  }
  function compareTrendChart(trend,mode='index'){
    const entries=trend.rows;
    if(entries.length<2)return `<div class="wd5-chart-empty">${ic('calendar',26)}<strong>沒有足夠的共同月份</strong><span>請兩位使用者在 JSON 中補足相同月份的資產快照；沒有數據的月份不會補 0 或推估。</span></div>`;
    const useIndex=mode==='index';
    if(useIndex&&entries.some(x=>x.mineIndex===null||x.peerIndex===null))return `<div class="wd5-chart-empty">${ic('circle',26)}<strong>無法計算基準 100</strong><span>起始月份的資產必須大於 0 才能比較相對成長。</span></div>`;
    const left=entries.map(x=>useIndex?x.mineIndex:x.mine),right=entries.map(x=>useIndex?x.peerIndex:x.peer);
    let min=Math.min(...left,...right),max=Math.max(...left,...right);
    const span=Math.max(max-min,useIndex?6:Math.max(1,max*.08));min-=span*.18;max+=span*.21;
    if(!Number.isFinite(min)||!Number.isFinite(max)||max===min)return '';
    const L=68,R=884,T=24,B=258,H=B-T,W=R-L;
    const pos=(v,i)=>({x:L+i*W/(entries.length-1),y:B-(v-min)/(max-min)*H});
    const shape=(values)=>values.map((v,i)=>`${i===0?'M':'L'}${pos(v,i).x.toFixed(1)},${pos(v,i).y.toFixed(1)}`).join(' ');
    const ticks=[0,1,2,3,4].map(i=>{const value=min+(max-min)*i/4,y=B-H*i/4;return `<line x1="${L}" x2="${R}" y1="${y}" y2="${y}" stroke="#e7ebf3" stroke-dasharray="4 6"/><text x="${L-12}" y="${y+4}" text-anchor="end" font-size="11" fill="#8996ab">${esc(useIndex?fmtNum(value,0):`${fmtNum(value/10000,0)}萬`)}</text>`;}).join('');
    const lines=left.map((v,i)=>{const p=pos(v,i);return `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#fff" stroke="#5368d6" stroke-width="2"><title>我的 ${esc(entries[i].month)}：${esc(useIndex?`${fmtNum(v,1)} 指數`:twd(v))}</title></circle>`;}).join('');
    const dots=right.map((v,i)=>{const p=pos(v,i);return `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#fff" stroke="#1fa68f" stroke-width="2"><title>對方 ${esc(entries[i].month)}：${esc(useIndex?`${fmtNum(v,1)} 指數`:twd(v))}</title></circle>`;}).join('');
    const lab=entries.map((x,i)=>{if(entries.length>8 && i!==0&&i!==entries.length-1&&i%2)return '';const p=pos(left[i],i);return `<text x="${p.x}" y="286" text-anchor="middle" font-size="11" fill="#96a4b8">${esc(x.month.slice(5))}月</text>`;}).join('');
    return `<svg class="wd5-chart" viewBox="0 0 920 303" role="img" aria-label="同月份兩位使用者的${useIndex?'起始基準100相對成長':'新台幣金融資產價值'}比較">${ticks}<path d="${shape(left)}" fill="none" stroke="#5368d6" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="${shape(right)}" fill="none" stroke="#1fa68f" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>${lines}${dots}${lab}</svg>
      <div class="wd5-chart-legend"><span><i class="wd5-dot wd5-mine"></i>我的資產</span><span><i class="wd5-dot wd5-peer"></i>對方資產</span><span>${useIndex?'起點皆為 100 · 無單位':'共同刻度 · 新台幣 TWD'}</span></div>`;
  }
  function compareGroupRows(items){
    return `<div class="wd5-group-rows">${items.map(x=>{const mine=x.minePct??0,peer=x.peerPct??0;
      return `<div class="wd5-group-line"><div class="wd5-group-title"><strong>${esc(x.label)}</strong><span class="num sensitive">${compareMoney(x.mine)} <em>vs</em> ${compareMoney(x.peer)}</span></div>
        <div class="wd5-bars"><span class="wd5-group-axis">我的</span><div class="wd5-bar-track"><i class="wd5-fill-mine" style="width:${Math.max(0,Math.min(100,mine))}%"></i></div><b class="num sensitive">${comparePercent(x.minePct)}</b></div>
        <div class="wd5-bars"><span class="wd5-group-axis">對方</span><div class="wd5-bar-track"><i class="wd5-fill-peer" style="width:${Math.max(0,Math.min(100,peer))}%"></i></div><b class="num sensitive">${comparePercent(x.peerPct)}</b></div>
      </div>`;}).join('')}</div>`;
  }
  function compareCurrencies(items){return `<div class="wd5-currency-list">${items.map(item=>`<div class="wd5-currency-row"><strong>${esc(item.code)}</strong><div><div class="wd5-currency-percent"><span>我的</span><span class="num sensitive">${comparePercent(item.minePct)}</span></div><div class="wd5-bars-compact"><i class="wd5-fill-mine" style="width:${Math.min(100,item.minePct??0)}%"></i></div></div><div><div class="wd5-currency-percent"><span>對方</span><span class="num sensitive">${comparePercent(item.peerPct)}</span></div><div class="wd5-bars-compact"><i class="wd5-fill-peer" style="width:${Math.min(100,item.peerPct??0)}%"></i></div></div></div>`).join('')}</div>`;}
  function compareRanking(positions,owner){
    if(!positions.length)return `<p class="wd5-muted">${esc(owner)}沒有可比較的投資部位。</p>`;
    const total=positions.reduce((s,x)=>s+x.valueTwd,0);
    return `<div class="wd5-rank-list">${positions.slice(0,5).map((x,i)=>`<div class="wd5-rank-item"><span class="wd5-rank-number">${i+1}</span><div class="wd5-rank-name"><strong>${esc(x.symbol)}</strong><small>${esc(x.name)}</small></div><div class="wd5-rank-value"><strong class="num sensitive">${twd(x.valueTwd)}</strong><small class="num ${x.pnlTwd>=0?'up':'down'} sensitive">${compareChange(x.roi)}</small></div></div>`).join('')}</div><p class="wd5-smallnote">前五大部位依市值排序；顯示占投資資產 ${fmtNum(positions.slice(0,5).reduce((s,x)=>s+x.valueTwd,0)/(total||1)*100,1)}%</p>`;
  }
  function compareOverlap(rows){
    if(!rows.length)return `<div class="wd5-muted">目前沒有共同持有的同類型、同代碼標的。下方仍可比較兩位使用者各自的主要投資部位。</div>`;
    return `<div class="wd5-overlap-wrap"><table class="wd5-overlap-table"><thead><tr><th>共同持有標的</th><th>我的平均成本</th><th>對方平均成本</th><th>我的成本報酬率</th><th>對方成本報酬率</th><th>差距（pp）</th></tr></thead><tbody>${rows.map(({mine,peer})=>{const gap=mine.roi===null||peer.roi===null?null:mine.roi-peer.roi;return `<tr><td><strong>${esc(mine.symbol)}</strong><small>${esc(mine.name)}</small></td><td class="num sensitive">${money(mine.avgCost,mine.currency,2)}</td><td class="num sensitive">${money(peer.avgCost,peer.currency,2)}</td><td class="num sensitive ${mine.roi>=0?'up':'down'}">${compareChange(mine.roi)}</td><td class="num sensitive ${peer.roi>=0?'up':'down'}">${compareChange(peer.roi)}</td><td class="num sensitive">${comparePoints(gap)}</td></tr>`;}).join('')}</tbody></table></div>`;
  }
  function compareBankRows(banks,label,fxRates){
    const banksPrepared=(banks||[]).map(x=>({...x,twdValue:Number(x.balance)*(Number(fxRates[x.currency]||1))})).sort((a,b)=>b.twdValue-a.twdValue);
    return `<div class="wd5-rank-list">${banksPrepared.slice(0,5).map((b,i)=>`<div class="wd5-rank-item"><span class="wd5-rank-number">${i+1}</span><div class="wd5-rank-name"><strong>${esc(b.bank)}</strong><small>${esc(b.accountName)} · ${esc(b.currency)}</small></div><div class="wd5-rank-value"><strong class="num sensitive">${twd(b.twdValue)}</strong><small>台幣換算</small></div></div>`).join('')}</div>`;
  }
  function renderCompare(){
    const grants=compareAccess();
    if(!grants.length)return compareEmpty();
    const item=state.compareView;
    const existing=item?WealthShares.latestMetadata(state.user.id,item.grant.id):null;
    const valid=!!(existing&&existing.status==='active'&&!existing.expired&&existing.updatedAt===item.grant.updatedAt&&existing.lastSharedAt===item.grant.lastSharedAt);
    const selected=(valid?item.grant.id:(state.compareTarget||grants[0].id));
    const toolbar=`<div class="wd5-toolbar"><div class="wd5-person-control"><label for="compare-owner-select">比較對象</label><select id="compare-owner-select" aria-label="選擇比較對象">${grants.map(g=>`<option value="${esc(g.id)}" ${selected===g.id?'selected':''}>${esc(g.ownerName)} · ${esc(scopeLabel(g.scope))}</option>`).join('')}</select></div><div class="wd5-period-control"><span>歷史區間</span><div class="wd5-period-pills">${[['3','近 3 月'],['6','近 6 月'],['12','近 12 月'],['all','全部']].map(([value,label])=>`<button class="${state.comparePeriod===value?'is-selected':''}" data-action="compare-period" data-period="${value}" aria-pressed="${state.comparePeriod===value}">${label}</button>`).join('')}</div></div></div>`;
    if(!valid)return `<div class="content wd5-compare">${heroHeader('雙人資產比較','自己的資產與受邀共享的資產，分別顯示並做同期分析。','PORTFOLIO COMPARISON')}${toolbar}<section class="panel wd5-empty"><span class="wd5-empty-icon">${ic('shield',26)}</span><h2>${item?'共享資料已更新或授權已變更':'尚未讀取比較資料'}</h2><p>${item?'為保護他人資產，已停止顯示舊快照。請重新讀取目前仍有權限的資料。':'選擇已接受的共享邀請後，系統會向 GAS 重新驗證授權並取得最新資料。'}</p><button class="primary-btn" data-action="compare-reload" data-id="${esc(selected)}">讀取並開始比較 ${ic('chevron',15)}</button></section></div>`;
    const {grant,data}=item;
    const result=WealthCompare.compare(state.data,data,state.comparePeriod);
    const {mine,peer,trend,groups,currencies,holdings}=result;
    const p=txt=>`<span class="sensitive">${txt}</span>`;
    const dateIssue=result.valuationsMismatch?`<div class="wd5-warning">${ic('calendar',16)} 兩人估值日期不同：我的 ${esc(result.asOfMine)}、對方 ${esc(result.asOfPeer)}，金額比較可能不在同一天。</div>`:'';
    const ratesIssue=result.fxDifferences.length?`<div class="wd5-warning">${ic('circle',16)} ${esc(result.fxDifferences.join('、'))} 換算匯率不同，會影響台幣比較；本版使用各自 JSON 所記錄的匯率。</div>`:'';
    const periodIssue=trend.rows.length>=2?`共 ${trend.rows.length} 個共同月份（${esc(trend.rows[0].month)} ～ ${esc(trend.rows.at(-1).month)}）`:'資料不足，無法計算同期成長';
    return `<div class="content wd5-compare">
      ${heroHeader('雙人資產比較',`我的資產 × ${grant.ownerName}授權的資產 · 不合併所有權 · 依最新授權資料計算`,'PORTFOLIO COMPARISON',`<span class="wd5-view-tag">${ic('eye',15)} 共享資料唯讀</span>`)}
      ${toolbar}
      <div class="wd5-compare-notice">${ic('shield',19)} <div><strong>我的資產與 ${esc(grant.ownerName)} 的資產分開統計</strong><span>僅使用對方已授權的 ${esc(scopeLabel(grant.scope))} 資料；對方的資料不會加入我的帳戶，也不能在這裡編輯、匯出或重新分享。</span></div></div>
      ${dateIssue}${ratesIssue}
      <div class="wd5-identity-strip"><div><span class="wd5-identity-bubble wd5-id-mine">${esc(state.user.name.slice(0,1))}</span><div><small>我的資產</small><strong>${esc(state.user.name)}</strong></div><b class="num sensitive">${twd(mine.total)}</b></div><span class="wd5-versus">VS</span><div><span class="wd5-identity-bubble wd5-id-peer">${esc(grant.ownerName.slice(0,1))}</span><div><small>共享帳號 · ${esc(scopeLabel(grant.scope))}</small><strong>${esc(grant.ownerName)}</strong></div><b class="num sensitive">${twd(peer.total)}</b></div></div>
      ${WealthProUI.comparePerformanceMarkup(state.data,data,grant.scope)}
      <div class="wd5-metrics">${compareCard('總金融資產',p(twd(mine.total)),p(twd(peer.total)),mine.total-peer.total,'各自的銀行存款＋投資市值，台幣計價。',{money:true})}
      ${compareCard('投資市值',p(twd(mine.invest)),p(twd(peer.invest)),mine.invest-peer.invest,'以目前 JSON 價格估值，沒有計算已實現損益。',{money:true})}
      ${compareCard('投資成本報酬率',p(comparePercent(mine.roi)),p(comparePercent(peer.roi)),mine.roi!==null&&peer.roi!==null?mine.roi-peer.roi:null,'僅持有部位的未實現損益 ÷ 成本，不是年化報酬。',{point:true})}
      ${compareCard('銀行存款占比',p(comparePercent(mine.cashPct)),p(comparePercent(peer.cashPct)),mine.cashPct!==null&&peer.cashPct!==null?mine.cashPct-peer.cashPct:null,'現金占總金融資產比重，以百分點比較。',{point:true})}</div>
      <section class="panel wd5-trend-panel"><div class="panel-inner"><div class="wd5-chart-heading"><div><span class="wd5-eyebrow">PERFORMANCE OVERLAY</span><h2>同期間資產成長對照</h2><p>${esc(periodIssue)} · 以共同月份為準，不插值</p></div><div class="wd5-chart-toggle"><button data-action="compare-mode" data-mode="index" class="${state.compareMode==='index'?'is-selected':''}" aria-pressed="${state.compareMode==='index'}">起點 = 100</button><button data-action="compare-mode" data-mode="amount" class="${state.compareMode==='amount'?'is-selected':''}" aria-pressed="${state.compareMode==='amount'}">實際金額</button></div></div>
      <div class="wd5-growth-stats"><div><small>我的同期變化</small><strong class="num sensitive">${compareChange(trend.mineGrowth)}</strong></div><div><small>${esc(grant.ownerName)}同期變化</small><strong class="num sensitive">${compareChange(trend.peerGrowth)}</strong></div><div><small>成長幅度差距</small><strong class="num sensitive">${trend.mineGrowth!==null&&trend.peerGrowth!==null?comparePoints(trend.mineGrowth-trend.peerGrowth):'—'}</strong></div></div>
      ${compareTrendChart(trend,state.compareMode)}<p class="wd5-chart-disclaimer">重要：資產成長率包含新增存款、提領與投資估值變化；不能直接解讀成投資報酬率。${trend.mineFlow!==null&&trend.peerFlow!==null?`此區間我的外部淨入金 ${compareDifference(trend.mineFlow)}，對方 ${compareDifference(trend.peerFlow)}。`:'至少一人的逐月淨入金資料不完整，因此不推算雙方淨投入差距。'}</p></div></section>
      <div class="wd5-two-panels"><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>資產類別配置比較</h2><p>銀行、台股、美股與基金占各自資產的比例</p></div>${ic('pie',18)}</div>${compareGroupRows(groups)}</div></section>
      <section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>幣別曝險對比</h2><p>同一幣別占各自金融資產比重</p></div>${ic('swap',18)}</div>${compareCurrencies(currencies)}<div class="wd5-dual-foot"><div><small>我的外幣比重</small><strong class="num sensitive">${comparePercent(mine.foreignPct)}</strong></div><div><small>對方外幣比重</small><strong class="num sensitive">${comparePercent(peer.foreignPct)}</strong></div></div></div></section></div>
      <section class="panel wd5-insights"><div class="panel-inner"><div class="panel-heading"><div><h2>比較觀察</h2><p>依目前兩個帳號的 JSON 自動整理，非投資建議</p></div>${ic('trend',18)}</div><div class="wd5-insights-grid">${result.insights.map((x,i)=>`<div class="wd5-insight"><span>0${i+1}</span><strong>${esc(x.label)}</strong><p>${esc(x.text)}</p></div>`).join('')}</div></div></section>
      ${holdings?`<div class="wd5-section-header"><h2>投資部位深度比較</h2><span>${esc(scopeLabel(grant.scope))} · 有權查看投資明細</span></div><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>共同持有標的比較</h2><p>同類型與同代碼才配對；平均成本為原幣，報酬率為未實現損益 ÷ 成本</p></div><span class="wd5-count">${holdings.overlap.length} 個共同標的</span></div>${compareOverlap(holdings.overlap)}</div></section>
      <div class="wd5-two-panels wd5-holdings-grid"><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>我的前五大投資</h2><p>投資市值與成本報酬率</p></div><span class="wd5-legend-label"><i class="wd5-dot wd5-mine"></i>我的</span></div>${compareRanking(holdings.mine,state.user.name)}<div class="wd5-concentration">前三大占投資部位 <strong>${comparePercent(holdings.mineConcentration.top3)}</strong></div></div></section><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>${esc(grant.ownerName)}的前五大投資</h2><p>僅依已授權的持有部位</p></div><span class="wd5-legend-label"><i class="wd5-dot wd5-peer"></i>對方</span></div>${compareRanking(holdings.theirs,grant.ownerName)}<div class="wd5-concentration">前三大占投資部位 <strong>${comparePercent(holdings.peerConcentration.top3)}</strong></div></div></section></div>`:
      `<div class="wd5-locked">${ic('shield',21)} <div><strong>對方未授權投資明細比較</strong><span>目前只能比較總覽數字、各類資產及歷史曲線。要比較股票成本和共同持股，請由對方將共享範圍調整為「投資與統計」或「完整」。</span></div></div>`}
      ${grant.scope==='full'?`<div class="wd5-section-header"><h2>銀行帳戶結構比較</h2><span>完整共享才會解鎖 · 不展示帳號識別資訊</span></div><div class="wd5-two-panels"><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>我的主要銀行帳戶</h2><p>依台幣換算餘額排序</p></div>${ic('wallet',17)}</div>${compareBankRows(state.data.bankAccounts,'我的',state.data.fxRates)}</div></section><section class="panel"><div class="panel-inner"><div class="panel-heading"><div><h2>${esc(grant.ownerName)}的銀行帳戶</h2><p>只顯示授權且去識別的銀行資訊</p></div>${ic('wallet',17)}</div>${compareBankRows(data.bankAccounts||[],'對方',data.fxRates||{})}</div></section></div>`:
      `<div class="wd5-locked">${ic('shield',21)} <div><strong>銀行明細受限</strong><span>可比較銀行存款總額與占比，但對方沒有開放逐筆銀行帳戶資料。完整共享後才會顯示銀行結構。</span></div></div>`}
      <div class="wd5-privacy-note">${ic('circle',17)} 本頁是雙人資產對照工具：不代表誰投資能力較好，舊版持倉比較仍以未實現成本報酬為主，新增績效頁獨立列出交易費、已實現損益、股息及 TWR／XIRR；不包含完整稅務分析。相同月份的資產總值不等於同一估值日期的市場行情；共享讀取與權限均由 GAS 驗證。</div>
    </div>`;
  }

  function render(){
    const pages={overview:renderOverview,analytics:renderAnalytics,banks:renderBanks,investments:renderInvestments,settings:renderSettings,shared:renderSharedInbox,sharing:renderSharing,'shared-detail':renderSharedDetail,family:renderFamily,compare:renderCompare, trades:()=>WealthProUI.render('trades',proCtx()), performance:()=>WealthProUI.render('performance',proCtx()), cashflow:()=>WealthProUI.render('cashflow',proCtx()), risks:()=>WealthProUI.render('risks',proCtx())};
    byId('view-root').innerHTML=(pages[state.page]||renderOverview)();
    document.querySelectorAll('.nav-link').forEach(el=>{
      const active=el.dataset.page===(['shared-detail','family','compare'].includes(state.page)?'shared':state.page);
      el.classList.toggle('is-active',active);el.setAttribute('aria-current',active?'page':'false');
    });
    byId('breadcrumb-page').textContent={overview:'資產總覽',analytics:'深度資產分析',banks:'銀行帳戶',investments:'投資部位',settings:'資料設定',shared:'共享給我的資產',sharing:'我的共享管理','shared-detail':'唯讀資產總覽',family:'家庭合計資產',compare:'雙人資產比較',trades:'完整交易流水',performance:'績效報酬分析',cashflow:'負債與現金流',risks:'風險與財務目標'}[state.page]||'資產總覽';
    const sharedPage=['shared-detail','family','compare'].includes(state.page);
    document.body.classList.toggle('is-shared-view',sharedPage);
    byId('breadcrumb-owner').textContent=state.page==='shared-detail'&&state.sharedView?state.sharedView.grant.ownerName+'的資產空間':`${state.user.name}的資產中心`;
    byId('topbar-user').textContent=state.page==='shared-detail'?'目前登入 '+state.user.name+' · 唯讀':state.user.name;
    const exportTop=document.querySelector('.top-export');if(exportTop)exportTop.hidden=sharedPage;
    byId('privacy-btn').innerHTML=ic(state.privacy?'eyeoff':'eye',17);
    byId('privacy-btn').setAttribute('aria-label',state.privacy?'顯示資產金額':'隱藏資產金額');
    document.body.classList.toggle('privacy-on',state.privacy);
    document.querySelector('[data-count="banks"]').textContent=state.data.bankAccounts.length;
    document.querySelector('[data-count="investments"]').textContent=state.data.holdings.length;
    const pending=WealthShares.incoming(state.user.id).filter(g=>g.status==='pending'&&!g.expired).length;
    const count=byId('share-inbox-count');if(count){count.textContent=pending?String(pending):'';count.hidden=!pending;}
    const asof=byId('topbar-asof');if(asof)asof.textContent=`資料日期 ${state.data.meta.asOf.replace(/-/g,' / ')}`;
  }
  function proCtx(){return {data:state.data,toast,render,onChange:(next,message)=>{state.data=WealthPro.migrate(next);const task=persist();render();task.then(()=>toast(message||'雲端資料已同步')).catch(()=>{});}};}
  function navigate(page){state.sharedView=null;state.familyRows=null;state.compareView=null;state.compareTarget=null;state.page=page;state.search='';state.filter='all';state.sort='value';document.body.classList.remove('mobile-open');render();if(['shared','sharing'].includes(page))WealthShares.refresh().then(()=>{if(state.page===page)render();}).catch(e=>toast('共享資訊更新失敗：'+e.message));window.scrollTo({top:0,behavior:'smooth'});}
  function toast(message){const box=byId('toast');box.innerHTML=`${ic('check',17)} <span>${esc(message)}</span>`;box.hidden=false;clearTimeout(state.toastTimeout);state.toastTimeout=setTimeout(()=>{box.hidden=true;},3400);}
  function refreshResults(){const container=byId('holdings-results');if(!container)return;const items=filteredHoldings();container.innerHTML=holdingsTable(items);const count=byId('match-count');if(count)count.textContent=`${items.length} 筆部位`;}
  function openEditor(kind='tw_stock',id=null){if(['shared-detail','family','compare'].includes(state.page))return;
    if(kind!=='bank'){WealthProUI.open(id?'quote':'asset',proCtx(),id);return;}
    let item=null;
    if(id){item=kind==='bank'?state.data.bankAccounts.find(x=>x.id===id):state.data.holdings.find(x=>x.id===id);if(!item){toast('找不到要編輯的資料');return;}}
    state.edit={kind,id};
    const modal=byId('edit-dialog');byId('modal-title').textContent=id?'編輯資產資料':'新增金融資產';byId('modal-subtitle').textContent=id?'更新資料後，金額及圖表將自動重新計算':'資料會同步儲存到 Google Sheets';
    const select=byId('editor-kind');select.value=kind;select.disabled=!!id;
    renderEditorFields(kind,item);
    byId('delete-entity').hidden=!id;
    byId('modal-error').textContent='';
    modal.showModal();
  }
  function renderEditorFields(kind,item){const b=kind==='bank',c=item?.currency||(kind==='us_stock'?'USD':'TWD');byId('editor-fields').innerHTML=b?`
    <div class="form-grid"><div class="form-field"><label for="edit-bank-name">銀行名稱 *</label><input id="edit-bank-name" name="bank" required maxlength="50" value="${esc(item?.bank||'')}" placeholder="例：國泰世華"/></div><div class="form-field"><label for="edit-account-name">帳戶用途 *</label><input id="edit-account-name" name="accountName" required maxlength="50" value="${esc(item?.accountName||'')}" placeholder="例：薪轉戶"/></div><div class="form-field"><label for="edit-bank-currency">存款幣別 *</label><select id="edit-bank-currency" name="currency"><option value="TWD" ${c==='TWD'?'selected':''}>TWD 新台幣</option><option value="USD" ${c==='USD'?'selected':''}>USD 美元</option><option value="JPY" ${c==='JPY'?'selected':''}>JPY 日圓</option></select></div><div class="form-field" style="grid-column:1/-1"><label for="edit-balance">存款餘額 *</label><input id="edit-balance" type="number" min="0" step="any" name="balance" required value="${esc(item?.balance??'')}" placeholder="例：250000"/></div></div>`:
    `<div class="form-grid"><div class="form-field"><label for="edit-symbol">代碼／基金識別 *</label><input id="edit-symbol" name="symbol" maxlength="30" required value="${esc(item?.symbol||'')}" placeholder="例：2330 / VOO" /></div><div class="form-field"><label for="edit-name">標的名稱 *</label><input id="edit-name" name="name" maxlength="90" required value="${esc(item?.name||'')}" placeholder="例：台積電" /></div><div class="form-field"><label for="edit-broker">券商／銀行</label><input id="edit-broker" name="broker" maxlength="70" value="${esc(item?.broker||'')}" placeholder="例：永豐金證券" /></div><div class="form-field"><label for="edit-currency">報價幣別 *</label><select id="edit-currency" name="currency"><option value="TWD" ${c==='TWD'?'selected':''}>TWD 新台幣</option><option value="USD" ${c==='USD'?'selected':''}>USD 美元</option><option value="JPY" ${c==='JPY'?'selected':''}>JPY 日圓</option></select></div><div class="form-field"><label for="edit-quantity">持有股數／基金單位 *</label><input id="edit-quantity" name="quantity" type="number" step="any" min="0.000001" required value="${esc(item?.quantity??'')}" placeholder="例：100" /></div><div class="form-field"><label for="edit-date">首次進場日期 *</label><input id="edit-date" name="entryDate" type="date" required value="${esc(item?.entryDate||state.data.meta.asOf)}" /></div><div class="form-field"><label for="edit-avg-cost">平均成本單價 *</label><input id="edit-avg-cost" name="avgCost" type="number" step="any" min="0" required value="${esc(item?.avgCost??'')}" placeholder="每股或每單位" /></div><div class="form-field"><label for="edit-current-price">目前單價／淨值 *</label><input id="edit-current-price" name="currentPrice" type="number" step="any" min="0" required value="${esc(item?.currentPrice??'')}" placeholder="每股或每單位" /></div></div>`;
  }
  function saveEditor(event){event.preventDefault();if(['shared-detail','family','compare'].includes(state.page))return;const kind=byId('editor-kind').value;const fd=new FormData(event.target),id=state.edit?.id;const isBank=kind==='bank';const next=isBank?{
    id:id||`bank-${Date.now()}`,bank:String(fd.get('bank')).trim(),accountName:String(fd.get('accountName')).trim(),currency:String(fd.get('currency')),balance:Number(fd.get('balance')),updatedAt:state.data.meta.asOf
  }:{id:id||`pos-${Date.now()}`,symbol:String(fd.get('symbol')).trim().toUpperCase(),name:String(fd.get('name')).trim(),type:kind,broker:String(fd.get('broker')||'').trim()||'自行管理',currency:String(fd.get('currency')),quantity:Number(fd.get('quantity')),avgCost:Number(fd.get('avgCost')),currentPrice:Number(fd.get('currentPrice')),entryDate:String(fd.get('entryDate'))};
    const nums=isBank?[next.balance]:[next.quantity,next.avgCost,next.currentPrice];if(nums.some(v=>!Number.isFinite(v)||v<0)||(!isBank&&next.quantity<=0)){byId('modal-error').textContent='請輸入有效的非負金額及大於零的持有數量。';return;}
    if(isBank&&id&&state.data.bankAccounts.find(b=>b.id===id)?.currency!==next.currency && ([...state.data.transactions,...state.data.cashFlows].some(x=>x.bankId===id))){byId('modal-error').textContent='此銀行帳戶已連動交易或收支，無法直接變更幣別';return;}
    const source=isBank?state.data.bankAccounts:state.data.holdings;const i=source.findIndex(x=>x.id===id);if(i>=0)source[i]=next;else source.unshift(next);const task=persist();byId('edit-dialog').close();render();task.then(()=>toast(id?'資料已儲存到雲端':'資產已新增並同步')).catch(()=>{});
  }
  function removeEditor(){if(['shared-detail','family','compare'].includes(state.page))return;
    if(state.edit?.kind==='bank'&&[...state.data.transactions,...state.data.cashFlows].some(t=>t.bankId===state.edit?.id)){toast('此銀行已關聯交易或收支流水，請先移除關聯紀錄再刪除');return;}const {kind,id}=state.edit||{};if(!id)return;const item=(kind==='bank'?state.data.bankAccounts:state.data.holdings).find(x=>x.id===id);if(!item)return;if(!window.confirm(`確定刪除「${kind==='bank'?item.bank:item.name}」嗎？刪除後無法在介面復原。`))return;const k=kind==='bank'?'bankAccounts':'holdings';state.data[k]=state.data[k].filter(x=>x.id!==id);const task=persist();byId('edit-dialog').close();render();task.then(()=>toast('資料已從雲端刪除')).catch(()=>{});}
  async function copyJson(){const json=JSON.stringify(state.data,null,2);try{await navigator.clipboard.writeText(json);toast('完整 JSON 已複製');}catch(_){const ta=document.createElement('textarea');ta.value=json;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();const success=document.execCommand('copy');ta.remove();toast(success?'完整 JSON 已複製':'複製失敗，請改用匯出 JSON');}}
  function exportJson(){if(['shared-detail','family','compare'].includes(state.page))return;const blob=new Blob([JSON.stringify(state.data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='wealthdesk-assets-backup.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已匯出完整 JSON 備份');}
  async function importJsonFile(file){
    if(!file)return;
    try {
      if(file.size>5*1024*1024)throw new Error('JSON 檔案不得超過 5MB');
      const incoming=JSON.parse(await file.text());
      if(!incoming || !Array.isArray(incoming.bankAccounts) || !Array.isArray(incoming.holdings) || !incoming.fxRates)throw new Error('缺少 bankAccounts、holdings 或 fxRates');
      if(incoming.bankAccounts.some(b=>!b.id||!b.bank||!b.accountName||!['TWD','USD','JPY'].includes(b.currency)||!Number.isFinite(+b.balance)||+b.balance<0))throw new Error('bankAccounts 有不合法欄位');
      if(incoming.holdings.some(h=>!h.id||!h.symbol||!h.name||!types[h.type]||!['TWD','USD','JPY'].includes(h.currency)||!h.entryDate||!Number.isFinite(+h.quantity)||+h.quantity<=0||!Number.isFinite(+h.avgCost)||+h.avgCost<0||!Number.isFinite(+h.currentPrice)||+h.currentPrice<0))throw new Error('holdings 有不合法欄位');
      for(const c of ['USD','JPY'])if(incoming.fxRates[c]!==undefined && !(Number(incoming.fxRates[c])>0))throw new Error(`${c} 匯率須大於 0`);
      const isV6=Array.isArray(incoming.assets)&&Array.isArray(incoming.transactions);
      const merged={...clone(seed),...incoming,meta:{...seed.meta,...incoming.meta},fxRates:{...seed.fxRates,...incoming.fxRates,TWD:1},history:Array.isArray(incoming.history)?incoming.history:[],activity:Array.isArray(incoming.activity)?incoming.activity:[]};
      if(!isV6){
        // Never combine the demo ledger with a real imported v2–v5 portfolio.
        // Reconstruct opening trades from the imported holdings instead.
        delete merged.assets;delete merged.transactions;
        merged.cashFlows=[];merged.liabilities=[];merged.goals=[];merged.performanceEvents=[];
      }
      if(merged.history.some(h=>!h.month||!Number.isFinite(+h.totalTwd)|| (h.netFlowTwd!==undefined && h.netFlowTwd!==null && !Number.isFinite(+h.netFlowTwd))))throw new Error('history 有不合法欄位');
      const candidate=WealthPro.migrate(merged);
      if(isV6&&(candidate.assets.length!==incoming.assets.length||candidate.transactions.length!==incoming.transactions.length))throw new Error('匯入交易資料完整性有誤');
      state.data=candidate;await persist();render();toast(`已同步匯入 ${merged.bankAccounts.length} 個帳戶及 ${candidate.holdings.length} 筆投資`);
    }catch(e){toast(`匯入失敗：${e.message}`);}
  }
  function monthList(records){return [...new Set(records.map(x=>x.month))].sort();}
  function historyImportPreviewRow(label,records,existing){
    if(!records.length)return `<li><strong>${label}</strong><span>未填寫，不變更</span></li>`;
    const months=monthList(records),old=new Set((existing||[]).map(x=>x.month)),replaced=months.filter(m=>old.has(m));
    return `<li><strong>${label}</strong><span>${months.length} 個月份、${records.length} 筆資料${replaced.length?`；更新既有月份 ${replaced.map(esc).join('、')}`:''}</span></li>`;
  }
  async function importHistoryExcel(file){
    if(!file)return;
    try{
      if(file.size>10*1024*1024)throw new Error('Excel 檔案不得超過 10MB');
      const plan=await WealthHistoryImport.parse(file);
      if(!plan.summary.length&&!plan.bankHistory.length&&!plan.holdingsHistory.length)throw new Error('三張資料工作表都沒有可匯入的資料列');
      state.historyImportPlan=plan;
      byId('history-import-preview').innerHTML=`<p>即將匯入以下工作表。相同月份會更新該工作表的資料，其他工作表與月份保留。</p><ul class="history-import-list">${historyImportPreviewRow('月度總覽',plan.summary,state.data.history)}${historyImportPreviewRow('銀行餘額',plan.bankHistory,state.data.bankHistory)}${historyImportPreviewRow('歷史持倉',plan.holdingsHistory,state.data.holdingsHistory)}</ul><p class="data-note">「銀行餘額」與「歷史持倉」不會改變目前帳戶或投資部位，但會納入資產歷史趨勢。同月份有「月度總覽」時，以總資產金額為準，快照資料補足未提供的類別金額。</p>`;
      byId('history-import-error').textContent='';byId('history-import-apply').disabled=false;byId('history-import-dialog').showModal();
    }catch(error){toast(`Excel 匯入預覽失敗：${error.message||'檔案格式不正確'}`);}
  }
  function upsertHistoryMonths(existing,incoming){const byMonth=new Map((existing||[]).map(x=>[x.month,x]));incoming.forEach(x=>byMonth.set(x.month,x));return [...byMonth.values()].sort((a,b)=>a.month.localeCompare(b.month));}
  async function applyHistoryImport(){
    const plan=state.historyImportPlan;if(!plan)return;
    const button=byId('history-import-apply'),previous=state.data;button.disabled=true;button.textContent='儲存中…';
    const candidate=clone(state.data);candidate.history=upsertHistoryMonths(candidate.history,plan.summary);candidate.bankHistory=upsertHistoryMonths(candidate.bankHistory,plan.bankHistory);candidate.holdingsHistory=upsertHistoryMonths(candidate.holdingsHistory,plan.holdingsHistory);state.data=WealthPro.migrate(candidate);
    try{
      await persist();
      if(plan.bankHistory.length)state.bankHistoryMonth=plan.bankHistory.at(-1).month;
      if(plan.holdingsHistory.length)state.holdingsHistoryMonth=plan.holdingsHistory.at(-1).month;
      state.historyImportPlan=null;byId('history-import-dialog').close();render();
      const count=plan.summary.length+plan.bankHistory.length+plan.holdingsHistory.length;toast(`已匯入 ${count} 個月份的歷史資料並同步至雲端`);
    }catch(error){state.data=previous;byId('history-import-error').textContent=`儲存失敗，資料未完成匯入：${error.message||'請稍後再試'}`;}
    finally{button.disabled=false;button.textContent='確認匯入';}
  }
  function resetData(){if(!window.confirm('確定清空此帳號全部資產資料？這會同步覆蓋 Google Sheets 的內容，且無法在介面復原！'))return;const fresh=clone(seed);fresh.meta.asOf=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});state.data=WealthPro.migrate(fresh);const task=persist();render();task.then(()=>toast('已清空雲端資產')).catch(()=>{});}
  async function startCompare(grantId=null){
    const priorUser=state.user?.id;
    if(!priorUser)return;
    try{await WealthShares.refresh();}catch(e){toast('無法更新共享授權：'+e.message);return;}
    const incoming=WealthShares.incoming(priorUser).filter(g=>g.status==='active'&&!g.expired);
    const target=grantId||state.compareTarget||incoming[0]?.id||null;
    state.sharedView=null;state.familyRows=null;state.compareTarget=target;state.compareNeedsRefresh=false;
    if(!target){state.compareView=null;state.page='compare';render();return;}
    try{
      const result=await WealthShares.read(priorUser,state.sharePrivateKey,target);
      if(!state.user||state.user.id!==priorUser)return;
      state.compareView=result;state.page='compare';render();
      document.body.classList.remove('mobile-open');window.scrollTo({top:0,behavior:'smooth'});
    }catch(e){
      if(!state.user||state.user.id!==priorUser)return;
      state.compareView=null;state.page='compare';render();toast(e.message||'比較資料無法讀取');
    }
  }
  async function openGranted(id){
    const result=await WealthShares.read(state.user.id,state.sharePrivateKey,id);
    state.sharedView=result;state.page='shared-detail';render();window.scrollTo({top:0,behavior:'smooth'});
  }
  async function sharingClick(action,btn){
    try{
      const id=btn.dataset.id;
      if(action==='grant-accept'){await WealthShares.respond(state.user.id,id,true);render();toast('已接受共享邀請，現在可以查看授權資產');}
      else if(action==='grant-decline'){if(!window.confirm('確定拒絕這份共享邀請？'))return;await WealthShares.respond(state.user.id,id,false);render();toast('已拒絕此邀請');}
      else if(action==='grant-open')await openGranted(id);
      else if(action==='compare-open')await startCompare(id);
      else if(action==='shared-back')navigate('shared');
      else if(action==='grant-revoke'){
        const g=WealthShares.outgoing(state.user.id).find(x=>x.id===id);
        if(!g)throw new Error('找不到此邀請');
        if(!window.confirm(`確定撤銷 ${g.viewerName} 的查看權限？此操作會停止後續共享查看。`))return;
        await WealthShares.revoke(state.user.id,id);render();toast('查看授權已撤銷');
      }else if(action==='grant-config'){
        const g=WealthShares.outgoing(state.user.id).find(x=>x.id===id);
        if(!g||!['pending','active'].includes(g.status)||g.expired)throw new Error('此授權無法變更');
        const form=byId('grant-config-form');form.reset();form.elements.grantId.value=g.id;
        form.elements.scope.value=g.scope;form.elements.expiresAt.value=g.expiresAt||'';
        form.elements.allowExport.checked=!!g.allowExport;
        byId('grant-config-person').textContent=`設定 ${g.viewerName} · ${g.viewerEmail} 可查看的資產範圍`;
        byId('grant-config-error').textContent='';byId('grant-config-dialog').showModal();
      }else if(action==='grant-config-close')byId('grant-config-dialog').close();
      else if(action==='grant-export'){
        const g=state.sharedView?.grant;if(!g)throw new Error('沒有可匯出的資料');
        const current=WealthShares.latestMetadata(state.user.id,g.id);
        if(!current||current.status!=='active'||current.expired||!current.allowExport)throw new Error('資料擁有者未授權匯出');
        const result=await WealthShares.read(state.user.id,state.sharePrivateKey,g.id,true);
        downloadReport('wealthdesk-shared-readonly-'+g.ownerId.slice(0,8)+'.json',new Blob([JSON.stringify(result.data,null,2)],{type:'application/json;charset=utf-8'}));
        toast('已匯出資產擁有者授權的部分資料');
      }else if(action==='open-family'){
        await WealthShares.refresh();
        const mine=WealthShares.projectPortfolio(state.data,'summary');
        const rows=[{ownerId:state.user.id,ownerName:state.user.name,rollup:mine.rollup,isMine:true}];
        const grants=WealthShares.incoming(state.user.id).filter(x=>x.status==='active'&&!x.expired);
        for(const g of grants){
          if(rows.some(x=>x.ownerId===g.ownerId))continue;
          try{const detail=await WealthShares.read(state.user.id,state.sharePrivateKey,g.id);rows.push({ownerId:g.ownerId,ownerName:g.ownerName,rollup:detail.data.rollup,isMine:false});}catch(_){}
        }
        state.familyRows=rows;state.page='family';render();window.scrollTo({top:0,behavior:'smooth'});
      }
    }catch(e){toast(e.message||'共享操作失敗');}
  }
  async function handleInviteSubmit(e){
    e.preventDefault();const form=e.target,btn=form.querySelector('button[type="submit"]');
    if(btn.disabled)return;
    btn.disabled=true;byId('invite-error').textContent='';
    try{
      const fd=new FormData(form);await persistQueue;
      await WealthShares.invite(state.user.id,String(fd.get('email')||''),String(fd.get('scope')),String(fd.get('expiresAt')||''),clone(state.data),fd.has('allowExport'));
      form.reset();render();toast('邀請已送出，對方登入後可接受或拒絕');
    }catch(error){byId('invite-error').textContent=error.message||'邀請失敗';}
    finally{btn.disabled=false;}
  }
  async function handleGrantConfig(e){
    e.preventDefault();const form=e.target,fd=new FormData(form),btn=form.querySelector('button[type="submit"]');
    if(btn.disabled)return;btn.disabled=true;byId('grant-config-error').textContent='';
    try{await persistQueue;await WealthShares.update(state.user.id,String(fd.get('grantId')),{
      scope:String(fd.get('scope')),expiresAt:String(fd.get('expiresAt')||''),allowExport:fd.has('allowExport')
    },clone(state.data));byId('grant-config-dialog').close();render();toast('共享權限已更新');}
    catch(error){byId('grant-config-error').textContent=error.message||'設定失敗';}
    finally{btn.disabled=false;}
  }
  document.addEventListener('click',(e)=>{
    const nav=e.target.closest('[data-page]');if(nav){if(nav.dataset.page==='compare')startCompare();else navigate(nav.dataset.page);return;}
    const btn=e.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;
    if(['grant-accept','grant-decline','grant-open','shared-back','grant-revoke','grant-config','grant-config-close','grant-export','open-family','compare-open'].includes(action)){sharingClick(action,btn);return;}
    if(['shared-detail','family','compare'].includes(state.page)&&['export-json','copy-json','import-json','import-history','history-import-apply','convert-bank-history','snapshot-bank-history','reset-data','add-bank','add-holding','edit-bank','edit-holding','delete-item','export-analysis','export-monthly','export-report-json'].includes(action)){toast('唯讀模式不允許修改或匯出未授權內容');return;}
    if(action?.startsWith('pro-')){WealthProUI.handleAction(btn,proCtx());return;}
    if(action==='compare-reload'){startCompare(btn.dataset.id);}
    else if(action==='compare-period'){state.comparePeriod=btn.dataset.period;render();}
    else if(action==='compare-mode'){state.compareMode=btn.dataset.mode;render();}
    else if(action==='add-bank')openEditor('bank');
    else if(action==='convert-bank-history')carryBankHistoryForward();
    else if(action==='snapshot-bank-history')saveBankHistorySnapshot();
    else if(action==='add-holding')openEditor('tw_stock');
    else if(action==='edit-bank')openEditor('bank',btn.dataset.id);
    else if(action==='edit-holding'){const item=state.data.holdings.find(x=>x.id===btn.dataset.id);openEditor(item?.type||'tw_stock',btn.dataset.id);}
    else if(action==='filter'){state.filter=btn.dataset.filter;render();}
    else if(action==='analysis-period'){state.period=btn.dataset.period;render();}
    else if(action==='scenario-reset'){state.stressPrice=0;state.stressFx=0;render();}
    else if(action==='export-analysis')exportAnalysisCSV();
    else if(action==='export-monthly')exportMonthlyCSV();
    else if(action==='export-report-json')exportReportJSON();
    else if(action==='export-json')exportJson();
    else if(action==='copy-json')copyJson();
    else if(action==='import-json')byId('import-json-input')?.click();
    else if(action==='import-history')byId('history-import-input')?.click();
    else if(action==='history-import-apply')applyHistoryImport();
    else if(action==='history-import-close'){state.historyImportPlan=null;byId('history-import-dialog').close();}
    else if(action==='reset-data')resetData();
    else if(action==='logout')logout();
    else if(action==='open-password'){byId('password-error').textContent='';byId('password-form').reset();byId('password-dialog').showModal();}
    else if(action==='close-password')byId('password-dialog').close();
    else if(action==='import-legacy')importLegacy();
    else if(action==='delete-item')removeEditor();
    else if(action==='close-modal')byId('edit-dialog').close();
    else if(action==='toggle-privacy'){state.privacy=!state.privacy;render();}
    else if(action==='toggle-menu')document.body.classList.toggle('mobile-open');
    else if(action==='close-menu')document.body.classList.remove('mobile-open');
  });
  document.addEventListener('input',(e)=>{
    if(e.target.id==='pro-stress'){WealthProUI.ui.stress=Number(e.target.value);const finance=WealthPro.finance(state.data),invest=WealthAnalytics.analyze(state.data).invest;document.getElementById('pro-stress-label').textContent=WealthProUI.ui.stress+'%';document.getElementById('pro-stress-total').textContent='NT$'+new Intl.NumberFormat('zh-TW',{maximumFractionDigits:0}).format(finance.net+invest*WealthProUI.ui.stress/100);document.getElementById('pro-stress-diff').textContent=(WealthProUI.ui.stress>0?'+':'−')+'NT$'+new Intl.NumberFormat('zh-TW',{maximumFractionDigits:0}).format(Math.abs(invest*WealthProUI.ui.stress/100))+' 相對現況';}
    if(e.target.id==='investment-search'){state.search=e.target.value;refreshResults();}
    if(e.target.id==='stress-price'){state.stressPrice=Number(e.target.value);refreshScenario();}
    if(e.target.id==='stress-fx'){state.stressFx=Number(e.target.value);refreshScenario();}
  });
  document.addEventListener('change',(e)=>{if(e.target.id==='import-json-input'){importJsonFile(e.target.files?.[0]);e.target.value='';}if(e.target.id==='history-import-input'){importHistoryExcel(e.target.files?.[0]);e.target.value='';}if(e.target.dataset.historyMonthKind==='bank'){state.bankHistoryMonth=e.target.value;render();}if(e.target.dataset.historyMonthKind==='holdings'){state.holdingsHistoryMonth=e.target.value;render();}if(e.target.id==='investment-sort'){state.sort=e.target.value;refreshResults();}if(e.target.id==='compare-owner-select'){startCompare(e.target.value);}if(e.target.id==='editor-kind')renderEditorFields(e.target.value,null);if(e.target.closest('#pro-form'))WealthProUI.onFieldChange(e.target,proCtx());});
  byId('edit-form').addEventListener('submit',saveEditor);
  byId('password-form').addEventListener('submit',changePassword);
  byId('edit-dialog').addEventListener('click',(e)=>{if(e.target.id==='edit-dialog')byId('edit-dialog').close();});
  byId('history-import-dialog').addEventListener('close',()=>{state.historyImportPlan=null;});
  document.addEventListener('submit',(e)=>{if(e.target.id==='pro-form'){WealthProUI.submit(e,proCtx());return;}if(e.target.id==='share-invite-form'){handleInviteSubmit(e);return;}if(e.target.id==='grant-config-form'){handleGrantConfig(e);return;}if(e.target.id==='fx-form'){e.preventDefault();const fd=new FormData(e.target);const usd=Number(fd.get('USD')),jpy=Number(fd.get('JPY'));if(!(usd>0&&jpy>0)){toast('請輸入大於零的有效匯率');return;}state.data.fxRates.USD=usd;state.data.fxRates.JPY=jpy;state.data=WealthPro.migrate(state.data);const task=persist();render();task.then(()=>toast('換算匯率已同步')).catch(()=>{});}});
  window.addEventListener('wealthdesk:session-expired',()=>{
    if(!state.user)return;
    state.user=null;state.data=null;state.cryptoKey=null;state.sharePrivateKey=null;
    WealthShares.reset();byId('view-root').replaceChildren();WealthAuth.showLogin();
    byId('auth-error').textContent='Session 已逾期，請重新登入。';
  });
  document.addEventListener('visibilitychange',async()=>{
    if(document.hidden||!state.user)return;
    if(['sharing','shared','compare','shared-detail','family'].includes(state.page)){
      try{
        await WealthShares.refresh();
        if(!state.user)return;
        if(state.page==='shared-detail'||state.page==='compare'){
          const old=state.page==='compare'?state.compareView:state.sharedView;
          const now=old&&WealthShares.latestMetadata(state.user.id,old.grant.id);
          if(!now||now.status!=='active'||now.expired||now.updatedAt!==old.grant.updatedAt){
            state.compareView=null;state.sharedView=null;state.page='shared';toast('共享授權或資料已更新，請重新讀取');
          }
        }
        render();
      }catch(e){toast('授權狀態更新失敗：'+e.message);}
    }
  });
  WealthAuth.setup(startSession);
})();
