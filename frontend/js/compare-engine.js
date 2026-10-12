/* WealthDesk v5 — pure, read-only comparison computations. No DOM or storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WealthCompare=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const KEYS=['cash','tw_stock','us_stock','fund'];
  const LABELS={cash:'銀行存款',tw_stock:'台股 / ETF',us_stock:'美股 / ETF',fund:'基金'};
  const n=x=>Number.isFinite(Number(x))?Number(x):0;
  const pct=(a,b)=>b>0?a/b*100:null;
  const fixed=x=>Math.round(x*100)/100;
  const byMonth=list=>new Map((list||[]).filter(x=>/^\d{4}-\d{2}$/.test(x.month)&&Number.isFinite(Number(x.totalTwd))).map(x=>[x.month,{...x,totalTwd:n(x.totalTwd)}]));
  const histNormalized=(history,asOf,latest)=>{
    const map=byMonth(history);
    const month=String(asOf||'').slice(0,7);
    // The as-of month is a live snapshot. Respect the current account/holding edits.
    if(/^\d{4}-\d{2}$/.test(month)){
      const prev=map.get(month)||{month,netFlowTwd:null};
      map.set(month,{...prev,month,totalTwd:n(latest)});
    }
    return map;
  };
  function timeline(mineHist,peerHist,asOfMine,asOfPeer,mineTotal,peerTotal,period='6'){
    const left=histNormalized(mineHist,asOfMine,mineTotal),right=histNormalized(peerHist,asOfPeer,peerTotal);
    const common=[...left.keys()].filter(m=>right.has(m)).sort();
    const available=common.length;
    const lastMonth=common.at(-1);
    const months=period==='all'||!lastMonth?common:common.filter(month=>{
      const span=Math.max(1,Number.parseInt(period,10)||6);
      const [year,part]=lastMonth.split('-').map(Number);
      const cutoff=new Date(Date.UTC(year,part-1-span,1)).toISOString().slice(0,7);
      return month>=cutoff;
    });
    const baselineLeft=months.length?n(left.get(months[0]).totalTwd):null;
    const baselineRight=months.length?n(right.get(months[0]).totalTwd):null;
    const rows=months.map(month=>{
      const m=left.get(month),p=right.get(month);
      return {month,mine:m.totalTwd,peer:p.totalTwd, mineIndex:baselineLeft>0?fixed(m.totalTwd/baselineLeft*100):null,peerIndex:baselineRight>0?fixed(p.totalTwd/baselineRight*100):null,mineNetFlow:m.netFlowTwd??null,peerNetFlow:p.netFlowTwd??null};
    });
    const first=rows[0],last=rows.at(-1);
    const growth=(key)=>first&&last&&first[key]>0?fixed((last[key]-first[key])/first[key]*100):null;
    const flow=(key)=>{
      if(rows.length<2||rows.slice(1).some(r=>r[key]===null||!Number.isFinite(Number(r[key]))))return null;
      return fixed(rows.slice(1).reduce((s,r)=>s+Number(r[key]),0));
    };
    const mineFlow=flow('mineNetFlow'),peerFlow=flow('peerNetFlow');
    return {rows,available,commonStart:common[0]||null,commonEnd:common.at(-1)||null,
      mineGrowth:growth('mine'),peerGrowth:growth('peer'),
      mineFlow,peerFlow,
      mineValuation:mineFlow!==null&&first&&last?fixed(last.mine-first.mine-mineFlow):null,
      peerValuation:peerFlow!==null&&first&&last?fixed(last.peer-first.peer-peerFlow):null};
  }
  function stats(roll){
    if(!roll)throw new Error('沒有取得可比較的資產摘要');
    const total=n(roll.totalTwd),invest=n(roll.investTwd),cash=n(roll.cashTwd),cost=n(roll.costTwd),pnl=n(roll.pnlTwd);
    return {total,invest,cash,cost,pnl,roi:cost>0?fixed(pnl/cost*100):null,
      cashPct:pct(cash,total),investPct:pct(invest,total),foreignPct:pct(Object.entries(roll.currencies||{}).filter(([k])=>k!=='TWD').reduce((s,[,v])=>s+n(v),0),total),
      holdingsCount:n(roll.holdingCount),bankCount:n(roll.bankCount),
      groups:KEYS.map(key=>({key,label:LABELS[key],amount:n(roll.groups?.[key]),weight:pct(n(roll.groups?.[key]),total)})),
      currencies:Object.entries(roll.currencies||{}).map(([code,value])=>({code,value:n(value),weight:pct(n(value),total)})).sort((a,b)=>b.value-a.value)
    };
  }
  function ownRollup(data){
    const analysed=WealthAnalytics.analyze(data);
    const groups=Object.fromEntries(analysed.groups.map(x=>[x.key,x.valueTwd]));
    return {analysed,roll:{totalTwd:analysed.total,cashTwd:analysed.cash,investTwd:analysed.invest,costTwd:analysed.cost,pnlTwd:analysed.pnl,bankCount:analysed.banks.length,holdingCount:analysed.holdings.length,groups,currencies:Object.fromEntries(analysed.currencies.map(x=>[x.key,x.value]))}};
  }
  function computeHoldings(holdings,fxRates){
    const fx=currency=>currency==='TWD'?1:n(fxRates?.[currency]);
    return (holdings||[]).map(x=>{
      const cost=x.costTwd!==undefined?n(x.costTwd):n(x.quantity)*n(x.avgCost)*fx(x.currency),value=n(x.quantity)*n(x.currentPrice)*fx(x.currency);
      return {symbol:String(x.symbol||'').toUpperCase().trim(),name:String(x.name||''),type:x.type,currency:x.currency,quantity:n(x.quantity),avgCost:n(x.avgCost),valueTwd:value,costTwd:cost,pnlTwd:value-cost,roi:pct(value-cost,cost),entryDate:x.entryDate||''};
    }).sort((a,b)=>b.valueTwd-a.valueTwd);
  }
  function holdingsCompare(own,peer){
    const mine=computeHoldings(own.holdings,own.fxRates),theirs=computeHoldings(peer.holdings,peer.fxRates);
    const peerMap=new Map();
    theirs.forEach(h=>peerMap.set(`${h.type}:${h.symbol}`,h));
    const overlap=mine.map(h=>({mine:h,peer:peerMap.get(`${h.type}:${h.symbol}`)})).filter(x=>x.peer)
      .sort((a,b)=>(b.mine.valueTwd+b.peer.valueTwd)-(a.mine.valueTwd+a.peer.valueTwd));
    const maxPos=items=>items.length&&items.reduce((m,h)=>m.valueTwd>h.valueTwd?m:h).valueTwd||0;
    const concentration=items=>{
      const denom=items.reduce((s,h)=>s+h.valueTwd,0);
      return {top1:pct(maxPos(items),denom),top3:pct(items.slice(0,3).reduce((s,h)=>s+h.valueTwd,0),denom)};
    };
    return {mine,theirs,overlap,mineConcentration:concentration(mine),peerConcentration:concentration(theirs)};
  }
  function compare(ownData,shareData,period='6'){
    if(!ownData||!shareData||!shareData.rollup)throw new Error('缺少比較資料');
    const {analysed,roll}=ownRollup(ownData);
    const mine=stats(roll),peer=stats(shareData.rollup);
    const scope=shareData.scope;
    const holdings=scope==='investments'||scope==='full' ? holdingsCompare(ownData,shareData) : null;
    const trend=timeline(analysed.history,shareData.history,ownData.meta?.asOf,shareData.asOf,mine.total,peer.total,period);
    const entries=mine.groups.map(a=>{
      const b=peer.groups.find(x=>x.key===a.key);
      return {key:a.key,label:a.label,mine:a.amount,peer:b?.amount||0,minePct:a.weight,peerPct:b?.weight??null,weightGap:a.weight!==null&&b?.weight!==null?fixed(a.weight-b.weight):null};
    });
    const codes=[...new Set([...mine.currencies.map(x=>x.code),...peer.currencies.map(x=>x.code)])];
    const currencies=codes.map(code=>{
      const a=mine.currencies.find(x=>x.code===code),b=peer.currencies.find(x=>x.code===code);
      return {code,mine:a?.value||0,peer:b?.value||0,minePct:a?.weight??(mine.total?0:null),peerPct:b?.weight??(peer.total?0:null)};
    }).sort((a,b)=>b.mine+b.peer-(a.mine+a.peer));
    const gap=mine.total-peer.total;
    const insights=[];
    const cashGap=(mine.cashPct??0)-(peer.cashPct??0);
    if(mine.total>0&&peer.total>0)insights.push({label:'現金配置差異',text:`我的銀行存款占比${Math.abs(cashGap)<.05?'與對方接近':cashGap>0?'較對方高':'較對方低'}${Math.abs(cashGap).toFixed(1)} 個百分點。`});
    const foreignGap=(mine.foreignPct??0)-(peer.foreignPct??0);
    if(mine.total>0&&peer.total>0)insights.push({label:'外幣配置差異',text:`我的外幣資產比例${Math.abs(foreignGap)<.05?'與對方接近':foreignGap>0?'較對方高':'較對方低'}${Math.abs(foreignGap).toFixed(1)} 個百分點，匯率假設由各帳號資料決定。`});
    if(trend.rows.length>=2&&trend.mineGrowth!==null&&trend.peerGrowth!==null)insights.push({label:'同期資產變化',text:`同一觀察期間我的資產變動 ${trend.mineGrowth.toFixed(1)}%，對方 ${trend.peerGrowth.toFixed(1)}%；變動包含存提款，並非純投資績效。`});
    const valuationsMismatch=String(ownData.meta?.asOf||'')!==String(shareData.asOf||'');
    const fxDifferences=[...new Set([...Object.keys(ownData.fxRates||{}),...Object.keys(shareData.fxRates||{})])].filter(code=>code!=='TWD'&&n(ownData.fxRates?.[code])!==n(shareData.fxRates?.[code]));
    return {mine,peer,gap,relativeGap:peer.total>0?pct(gap,peer.total):null,trend,groups:entries,currencies,holdings,insights,scope,
      asOfMine:ownData.meta?.asOf||'',asOfPeer:shareData.asOf||'',valuationsMismatch,fxDifferences};
  }
  return {compare,timeline,stats,holdingsCompare,KEYS,LABELS};
});
