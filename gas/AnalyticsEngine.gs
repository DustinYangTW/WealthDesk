/* WealthDesk Analytics v2: pure computations; independent of DOM and chart rendering. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WealthAnalytics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CATEGORIES = ['cash','tw_stock','us_stock','fund'];
  const NAMES = {cash:'銀行存款',tw_stock:'台股 / ETF',us_stock:'美股 / ETF',fund:'基金'};
  const amount = n => Number.isFinite(Number(n)) ? Number(n) : 0;
  const sum = (list, fn) => list.reduce((acc,item) => acc + fn(item), 0);
  const round = n => Math.round(n * 100) / 100;
  const percentage = (a,b) => b ? a/b*100 : 0;
  function ageDays(day, asOf) {
    const from = Date.parse(`${day}T00:00:00Z`), to = Date.parse(`${asOf}T00:00:00Z`);
    return Number.isFinite(from) && Number.isFinite(to) ? Math.max(0, Math.round((to-from)/86400000)) : null;
  }
  function bucketAge(days){ if(days===null)return 'unknown'; if(days<180)return 'under6'; if(days<365)return 'under12'; if(days<730)return 'under24'; return 'over24'; }
  function aggregate(entries, getKey, getValue) {
    const table = new Map();
    entries.forEach(entry => { const key=getKey(entry); table.set(key,(table.get(key)||0)+getValue(entry)); });
    return [...table].map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
  }
  function analyze(data) {
    const fx = currency => currency === 'TWD' ? 1 : amount(data.fxRates?.[currency]);
    const asOf = data.meta?.asOf || '2026-10-10';
    const banks = (data.bankAccounts||[]).map(b => ({...b,valueTwd:amount(b.balance)*fx(b.currency),institution:b.bank}));
    const holdings = (data.holdings||[]).map(h => {
      const costTwd=h.costTwd!==undefined?amount(h.costTwd):amount(h.quantity)*amount(h.avgCost)*fx(h.currency);
      const valueTwd=amount(h.quantity)*amount(h.currentPrice)*fx(h.currency);
      const pnlTwd=valueTwd-costTwd;
      const days=ageDays(h.entryDate,asOf);
      return {...h,costTwd,valueTwd,pnlTwd,roiPct:percentage(pnlTwd,costTwd),daysHeld:days,ageBucket:bucketAge(days)};
    });
    const cash=sum(banks,b=>b.valueTwd),invest=sum(holdings,h=>h.valueTwd),cost=sum(holdings,h=>h.costTwd),pnl=invest-cost,total=cash+invest;
    const groups=CATEGORIES.map(key=>{
      const records=key==='cash'?banks:holdings.filter(h=>h.type===key);
      const valueTwd=sum(records,r=>r.valueTwd);
      const costTwd=key==='cash'?null:sum(records,r=>r.costTwd);
      return {key,name:NAMES[key],valueTwd,costTwd,pnlTwd:key==='cash'?null:valueTwd-costTwd,roiPct:key==='cash'?null:percentage(valueTwd-costTwd,costTwd),weightPct:percentage(valueTwd,total),count:records.length};
    });
    const currencies=aggregate([...banks,...holdings],x=>x.currency,x=>x.valueTwd).map(x=>({...x,weightPct:percentage(x.value,total)}));
    const institutions=aggregate([...banks,...holdings],x=>x.institution||x.broker||'未設定',x=>x.valueTwd).map(x=>({...x,weightPct:percentage(x.value,total)}));
    const positionsByValue=[...holdings].sort((a,b)=>b.valueTwd-a.valueTwd);
    const gainers=[...holdings].sort((a,b)=>b.pnlTwd-a.pnlTwd);
    const losers=[...holdings].sort((a,b)=>a.pnlTwd-b.pnlTwd);
    const profitable=holdings.filter(h=>h.pnlTwd>0).length, losing=holdings.filter(h=>h.pnlTwd<0).length,flat=holdings.length-profitable-losing;
    const topPositionWeight=percentage(positionsByValue[0]?.valueTwd||0,invest);
    const top3Weight=percentage(sum(positionsByValue.slice(0,3),h=>h.valueTwd),invest);
    const foreignExposure=sum([...banks,...holdings].filter(x=>x.currency!=='TWD'),x=>x.valueTwd);
    const currencyWeight=percentage(foreignExposure,total);
    const institutionTopWeight=institutions[0]?.weightPct||0;
    const ages={under6:0,under12:0,under24:0,over24:0,unknown:0};holdings.forEach(h=>ages[h.ageBucket]++);
    const validAges=holdings.filter(h=>h.daysHeld!==null);
    const averageHoldDays=validAges.length?Math.round(sum(validAges,h=>h.daysHeld)/validAges.length):null;
    const risks=[];
    if(topPositionWeight>=25)risks.push({level:'attention',label:'個股集中',detail:`最大持倉占投資市值 ${topPositionWeight.toFixed(1)}%；單一標的波動影響較高。`});
    else risks.push({level:'normal',label:'單一持倉',detail:`最大持倉占投資市值 ${topPositionWeight.toFixed(1)}%。`});
    if(top3Weight>=55)risks.push({level:'attention',label:'前三大持倉集中',detail:`前三大持倉合計 ${top3Weight.toFixed(1)}%，可進一步檢視重複市場曝險。`});
    else risks.push({level:'normal',label:'前三大持倉',detail:`前三大持倉占比 ${top3Weight.toFixed(1)}%。`});
    if(currencyWeight>=40)risks.push({level:'attention',label:'外幣曝險',detail:`外幣資產占金融資產 ${currencyWeight.toFixed(1)}%，匯率波動會影響台幣計價總值。`});
    else risks.push({level:'normal',label:'外幣曝險',detail:`外幣資產占總資產 ${currencyWeight.toFixed(1)}%。`});
    if(total && cash/total<0.15)risks.push({level:'attention',label:'流動性觀察',detail:`銀行存款占 ${percentage(cash,total).toFixed(1)}%；須另外依個人支出評估備用金。`});
    else risks.push({level:'normal',label:'現金水位',detail:`銀行存款占總金融資產 ${percentage(cash,total).toFixed(1)}%。`});
    if(institutionTopWeight>=40)risks.push({level:'attention',label:'機構集中',detail:`最大往來機構占總資產 ${institutionTopWeight.toFixed(1)}%，可檢查單一機構存放規模。`});
    const rawHistory=Array.isArray(data.history)?data.history.filter(x=>/^\d{4}-\d{2}$/.test(x.month) && Number.isFinite(Number(x.totalTwd))).sort((a,b)=>a.month.localeCompare(b.month)):[];
    const latestMonth=String(asOf).slice(0,7);
    const snapshot=rawHistory.map(r=>({...r,totalTwd:amount(r.totalTwd),netFlowTwd:Number.isFinite(Number(r.netFlowTwd)) && r.netFlowTwd!==null && r.netFlowTwd!==undefined ? Number(r.netFlowTwd):null}));
    const currentSnapshot={month:latestMonth,totalTwd:total,netFlowTwd:null,cashTwd:cash,twStockTwd:groups[1].valueTwd,usStockTwd:groups[2].valueTwd,fundTwd:groups[3].valueTwd};
    if(snapshot.length && snapshot.at(-1).month===latestMonth){const prev=snapshot.at(-1);snapshot[snapshot.length-1]={...prev,...currentSnapshot,netFlowTwd:prev.netFlowTwd};}
    else if(!snapshot.length || snapshot.at(-1).month<latestMonth){snapshot.push(currentSnapshot);}
    const history=snapshot.map((point,i)=>{
      const before=i?snapshot[i-1]:null;
      const delta=before?point.totalTwd-before.totalTwd:null;
      const valuation=before && point.netFlowTwd!==null?delta-point.netFlowTwd:null;
      return {...point,deltaTwd:delta,valuationTwd:valuation,valuationPct:before && valuation!==null?percentage(valuation,before.totalTwd):null};
    });
    return {asOf,banks,holdings,total,cash,invest,cost,pnl,roiPct:percentage(pnl,cost),groups,currencies,institutions,positionsByValue,gainers,losers,profitable,losing,flat,winRatePct:percentage(profitable,holdings.length),topPositionWeight,top3Weight,foreignExposure,currencyWeight,institutionTopWeight,ages,averageHoldDays,risks,history};
  }
  function periodStats(result, period='6') {
    const n=period==='all'?Math.max(0,result.history.length-1):Math.max(1,parseInt(period,10)||6);
    const list=result.history.slice(-(n+1));
    const start=list[0],end=list.at(-1),months=list.slice(1);
    const delta=start&&end?end.totalTwd-start.totalTwd:0;
    const flowsAvailable=months.length>0&&months.every(m=>m.netFlowTwd!==null);
    const netFlowTwd=flowsAvailable?sum(months,m=>m.netFlowTwd):null;
    const valuationTwd=flowsAvailable?delta-netFlowTwd:null;
    const valPct=flowsAvailable?percentage(valuationTwd,start.totalTwd):null;
    return {list,months,monthCount:months.length,deltaTwd:delta,growthPct:start?percentage(delta,start.totalTwd):0,netFlowTwd,valuationTwd,valPct,flowsAvailable,startTotal:start?.totalTwd||0,endTotal:end?.totalTwd||0};
  }
  return {analyze,periodStats,ageDays,percentage,CATEGORIES,NAMES};
});
