/* WealthDesk v6 — deterministic transaction / cashflow / performance engine.
 * No DOM, storage, or dependency. TWD base with trade-date FX on cost/proceeds.
 * Weighted-average basis per asset account, no shorts. Date-order deterministic.
 */
(function(root,factory){const out=factory();if(typeof module==='object'&&module.exports)module.exports=out;if(root)root.WealthPro=out;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const n=x=>Number(x)||0;
 const rnd=(x,d=2)=>Math.round((x+Number.EPSILON)*10**d)/10**d;
 const dateOk=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s))&&!Number.isNaN(Date.parse(String(s)+'T00:00:00Z'));
 const days=(a,b)=>(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000;
 const kinds=['buy','sell','dividend','split'];
 function assert(cond,msg){if(!cond)throw new Error(msg);}
 function legacyToLedger(data){
   data.assets=(data.holdings||[]).map(h=>({id:h.id,symbol:h.symbol,name:h.name,type:h.type,broker:h.broker,currency:h.currency,currentPrice:Number(h.currentPrice),entryDate:h.entryDate}));
   data.transactions=(data.holdings||[]).map(h=>({id:'opening-'+h.id,assetId:h.id,action:'buy',date:h.entryDate||data.meta?.asOf||'2026-10-10',quantity:Number(h.quantity),price:Number(h.avgCost),fee:0,tax:0,fxRate:Number(data.fxRates?.[h.currency]||1),bankId:'',cashApplied:false,origin:'opening'}));
   return data;
 }
 function migrate(input){
   const data=clone(input),asOf=data.meta?.asOf||'2026-10-10';
   data.meta={...data.meta,analyticsVersion:6};
   if(!Array.isArray(data.assets)||!Array.isArray(data.transactions))legacyToLedger(data);
   for(const [field,defaultValue] of Object.entries({cashFlows:[],liabilities:[],goals:[],performanceEvents:[],bankHistory:[],holdingsHistory:[]}))if(!Array.isArray(data[field]))data[field]=defaultValue;
   data.holdings=reconcile(data).holdings;
   return data;
 }
 function validateTransaction(data,t,ignoreId=null){
   assert(kinds.includes(t.action),'交易類型不正確');
   assert(dateOk(t.date),'請輸入有效交易日期');
   assert(t.date<=(data.meta?.asOf||'9999-12-31'),'不可建立未來日期的交易');
   const asset=(data.assets||[]).find(x=>x.id===t.assetId);assert(asset,'找不到該投資標的');
   assert(finite(+t.fxRate)&&+t.fxRate>0,'交易當日匯率必須大於 0');
   assert(finite(+t.fee)&&+t.fee>=0&&finite(+t.tax)&&+t.tax>=0,'費用與稅額不得為負數');
   if(t.action==='buy'||t.action==='sell'){
     assert(finite(+t.quantity)&&+t.quantity>0,'交易數量必須大於 0');
     assert(finite(+t.price)&&+t.price>0,'成交價格必須大於 0');
     if(t.action==='sell')assert(+t.quantity*+t.price>=+t.fee+ +t.tax,'賣出手續費與稅額不能超過成交總額');
   }
   if(t.action==='dividend')assert(finite(+t.amount)&&+t.amount>0&&+t.amount>=+t.fee+ +t.tax,'股息金額應大於費用與扣繳');
   if(t.action==='split')assert(finite(+t.ratio)&&+t.ratio>0,'拆併股比例必須大於 0');
   if(t.bankId){
     const bank=(data.bankAccounts||[]).find(x=>x.id===t.bankId);assert(bank,'結算銀行帳戶不存在');
     assert(bank.currency===asset.currency,'結算帳戶幣別必須與交易標的相同');
   }
   if(ignoreId)assert(t.id===ignoreId,'交易記錄 ID 不可變更');
 }
 function cashDelta(t){
   if(t.action==='buy')return -(n(t.quantity)*n(t.price)+n(t.fee)+n(t.tax));
   if(t.action==='sell')return n(t.quantity)*n(t.price)-n(t.fee)-n(t.tax);
   if(t.action==='dividend')return n(t.amount)-n(t.fee)-n(t.tax);
   return 0;
 }
 function sortedTransactions(transactions){return [...(transactions||[])].sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));}
 function reconcile(data){
   const assets=new Map((data.assets||[]).map(a=>[a.id,a]));
   const pos=new Map([...assets.keys()].map(k=>[k,{qty:0,basisNative:0,basisTwd:0,realizedTwd:0,dividendsTwd:0,feesTwd:0,buyCount:0,sellCount:0,firstDate:null}]));
   const normalized=sortedTransactions(data.transactions);
   for(const t of normalized){
     validateTransaction(data,t);
     const p=pos.get(t.assetId);assert(p,'交易引用不存在的標的');
     const qty=n(t.quantity),fx=n(t.fxRate),fees=n(t.fee)+n(t.tax);
     p.feesTwd+=fees*fx;
     if(t.action==='buy'){
       p.qty+=qty;p.basisNative+=qty*n(t.price)+fees;p.basisTwd+=(qty*n(t.price)+fees)*fx;
       p.buyCount++;p.firstDate=p.firstDate&&p.firstDate<t.date?p.firstDate:t.date;
     }else if(t.action==='sell'){
       assert(p.qty+1e-7>=qty,`「${assets.get(t.assetId).symbol}」${t.date} 賣出數量超過之前持有數量`);
       const proportion=Math.min(1,qty/p.qty),allocatedNative=p.basisNative*proportion,allocatedTwd=p.basisTwd*proportion;
       p.realizedTwd+=(qty*n(t.price)-fees)*fx-allocatedTwd;
       p.qty-=qty;p.basisNative-=allocatedNative;p.basisTwd-=allocatedTwd;p.sellCount++;
       if(p.qty<1e-7){p.qty=0;p.basisNative=0;p.basisTwd=0;}
     }else if(t.action==='dividend'){
       // Dividend is realized income, not a reduction of purchase basis.
       p.dividendsTwd+=(n(t.amount)-fees)*fx;
     }else if(t.action==='split'){
       assert(p.qty>0,`「${assets.get(t.assetId).symbol}」拆併股之前沒有持倉`);
       p.qty*=n(t.ratio);
     }
   }
   const holdings=[...pos].filter(([,p])=>p.qty>1e-8).map(([id,p])=>{
     const a=assets.get(id),currentFx=a.currency==='TWD'?1:n(data.fxRates?.[a.currency]);
     const avgCost=p.basisNative/p.qty;
     return {...a,quantity:rnd(p.qty,7),avgCost:rnd(avgCost,6),costTwd:rnd(p.basisTwd,4),avgCostTwd:rnd(p.basisTwd/p.qty,4),entryDate:p.firstDate||a.entryDate||'',realizedTwd:rnd(p.realizedTwd),dividendsTwd:rnd(p.dividendsTwd),valueTwd:rnd(p.qty*n(a.currentPrice)*currentFx)};
   });
   const all=[...pos].map(([id,p])=>({assetId:id,symbol:assets.get(id)?.symbol||'',...p}));
   const realized=all.reduce((a,x)=>a+x.realizedTwd,0),dividends=all.reduce((a,x)=>a+x.dividendsTwd,0),fees=all.reduce((a,x)=>a+x.feesTwd,0);
   return {holdings,positions:all,realizedTwd:rnd(realized),dividendsTwd:rnd(dividends),feesTwd:rnd(fees),tradeCount:normalized.filter(t=>t.action!=='split').length};
 }
 function applyTransaction(input,t){
   const data=migrate(input);assert(!data.transactions.some(x=>x.id===t.id),'交易 ID 不可重複');
   const entry={...t,fee:n(t.fee),tax:n(t.tax),bankId:t.bankId||'',cashApplied:!!t.bankId};
   validateTransaction(data,entry);
   data.transactions.push(entry);
   const report=reconcile(data); // validate all chronological sell constraints before any bank mutation
   if(entry.bankId){const bank=data.bankAccounts.find(b=>b.id===entry.bankId);bank.balance=rnd(n(bank.balance)+cashDelta(entry),6);assert(bank.balance>=-1e-7,'銀行餘額不足；請選擇不連動銀行或其他結算帳戶');}
   data.holdings=report.holdings;
   return data;
 }
 function removeTransaction(input,id){
   const data=migrate(input),old=data.transactions.find(t=>t.id===id);assert(old,'找不到交易');
   data.transactions=data.transactions.filter(t=>t.id!==id);
   const report=reconcile(data); // deleting an opening BUY may invalidate later SELL
   if(old.cashApplied&&old.bankId){const bank=data.bankAccounts.find(b=>b.id===old.bankId);assert(bank,'原結算帳戶已移除，無法安全回沖');bank.balance=rnd(n(bank.balance)-cashDelta(old),6);assert(bank.balance>=-1e-7,'回沖會使銀行餘額為負，請先調整銀行帳戶');}
   data.holdings=report.holdings;return data;
 }
 function updatePrice(input,id,price,updates={}){
   const data=migrate(input),asset=data.assets.find(x=>x.id===id);assert(asset,'找不到標的');
   assert(finite(+price)&&+price>=0,'現價不得為負');
   asset.currentPrice=+price;
   if(updates.name)asset.name=String(updates.name).trim();
   if(updates.broker)asset.broker=String(updates.broker).trim();
   data.holdings=reconcile(data).holdings;return data;
 }
 function validateFlow(data,t){
   assert(['income','expense'].includes(t.kind),'現金流類型錯誤');
   assert(dateOk(t.date),'請輸入有效日期');
   assert(t.date<=(data.meta?.asOf||'9999-12-31'),'不可建立未來現金流');
   assert(Number(t.amount)>0&&Number.isFinite(Number(t.amount)),'金額必須大於 0');
   assert(['TWD','USD','JPY'].includes(t.currency),'不支援此幣別');
   if(t.bankId){const b=data.bankAccounts.find(x=>x.id===t.bankId);assert(b&&b.currency===t.currency,'現金流銀行帳戶或幣別無效');}
 }
 function flowChange(t){return (t.kind==='income'?1:-1)*n(t.amount);}
 function applyFlow(input,flow){const d=migrate(input);validateFlow(d,flow);assert(!d.cashFlows.some(f=>f.id===flow.id),'流水編號重複');
   const f={...flow,amount:n(flow.amount),bankId:flow.bankId||'',bankApplied:!!flow.bankId,fxRate:n(flow.fxRate)||n(d.fxRates?.[flow.currency])||1};
   if(f.bankId){const b=d.bankAccounts.find(b=>b.id===f.bankId);b.balance=rnd(n(b.balance)+flowChange(f),6);assert(b.balance>=-1e-7,'銀行餘額不足');}
   d.cashFlows.push(f);return d;
 }
 function removeFlow(input,id){const d=migrate(input),f=d.cashFlows.find(x=>x.id===id);assert(f,'找不到現金流');
   if(f.bankApplied&&f.bankId){const b=d.bankAccounts.find(b=>b.id===f.bankId);assert(b,'原銀行帳戶不存在，無法回沖');b.balance=rnd(n(b.balance)-flowChange(f),6);assert(b.balance>=-1e-7,'刪除後銀行餘額不足');}
   d.cashFlows=d.cashFlows.filter(x=>x.id!==id);return d;
 }
 function cashflowStats(data){
   const fx=t=>n(t.fxRate)||n(data.fxRates?.[t.currency])||1;
   const rows=(data.cashFlows||[]).map(t=>({...t,twd:n(t.amount)*fx(t)}));
   const income=rows.filter(t=>t.kind==='income').reduce((s,t)=>s+t.twd,0),expense=rows.filter(t=>t.kind==='expense').reduce((s,t)=>s+t.twd,0);
   const groups=new Map(),months=new Map();
   rows.forEach(t=>{const m=t.date.slice(0,7);if(!months.has(m))months.set(m,{month:m,income:0,expense:0});months.get(m)[t.kind]+=t.twd;
     if(t.kind==='expense')groups.set(t.category||'其他',(groups.get(t.category||'其他')||0)+t.twd);
   });
   const series=[...months.values()].sort((a,b)=>a.month.localeCompare(b.month));
   const tail=series.slice(-6),monthlyExpense=tail.length?tail.reduce((s,m)=>s+m.expense,0)/tail.length:0;
   const categories=[...groups].map(([name,value])=>({name,value,weight:expense>0?value/expense*100:0})).sort((a,b)=>b.value-a.value);
   return {income:rnd(income),expense:rnd(expense),net:rnd(income-expense),monthlyExpense:rnd(monthlyExpense),series,categories,rows:rows.sort((a,b)=>b.date.localeCompare(a.date))};
 }
 function liabilities(data){
   const rows=(data.liabilities||[]).map(x=>({...x,twd:n(x.balance)*(x.currency==='TWD'?1:n(data.fxRates?.[x.currency]))}));
   const total=rows.reduce((s,x)=>s+x.twd,0),annualPayment=rows.reduce((s,x)=>s+n(x.monthlyPayment)*12*(x.currency==='TWD'?1:n(data.fxRates?.[x.currency])),0);
   return {rows,total:rnd(total),monthlyPayments:rnd(annualPayment/12)};
 }
 function finance(data){const a=typeof WealthAnalytics!=='undefined'?WealthAnalytics.analyze(data):null;
   const gross=a?a.total:(data.bankAccounts||[]).reduce((s,b)=>s+n(b.balance)*n(data.fxRates?.[b.currency]),0)+(data.holdings||[]).reduce((s,h)=>s+n(h.quantity)*n(h.currentPrice)*n(data.fxRates?.[h.currency]),0);
   const l=liabilities(data),cf=cashflowStats(data),cash=a?a.cash:(data.bankAccounts||[]).reduce((s,b)=>s+n(b.balance)*n(data.fxRates?.[b.currency]),0);
   return {gross,net:gross-l.total,cash,liabilities:l,cashFlows:cf,runwayMonths:cf.monthlyExpense>0?cash/cf.monthlyExpense:null,debtRatio:gross>0?l.total/gross*100:null};
 }
 function xirr(flows){
   if(!flows||flows.length<2)return null;
   const records=flows.filter(f=>dateOk(f.date)&&finite(Number(f.amount))).map(f=>({...f,amount:Number(f.amount)}));
   if(!records.some(x=>x.amount<0)||!records.some(x=>x.amount>0))return null;
   const origin=records.map(f=>f.date).sort()[0];
   const npv=r=>records.reduce((s,f)=>s+f.amount/Math.pow(1+r,days(origin,f.date)/365),0);
   let lo=-.9999,hi=1;
   let yl=npv(lo),yh=npv(hi);
   while(yl*yh>0&&hi<100000){hi=hi*2+1;yh=npv(hi);}
   if(!Number.isFinite(yl)||!Number.isFinite(yh)||yl*yh>0)return null;
   for(let i=0;i<180;i++){const mid=(lo+hi)/2,ym=npv(mid);if(Math.abs(ym)<1e-9)return rnd(mid*100,5);if(yl*ym<=0){hi=mid;yh=ym;}else{lo=mid;yl=ym;}}
   return rnd((lo+hi)/2*100,5);
 }
 function performance(events,opts={}){
   const all=[...(events||[])].filter(x=>dateOk(x.date)&&Number.isFinite(Number(x.beforeValueTwd))&&Number(x.beforeValueTwd)>=0&&Number.isFinite(Number(x.externalFlowTwd||0)))
     .sort((a,b)=>a.date.localeCompare(b.date));
   if(all.length<2)return {available:false,reason:'至少需要兩個估值時點（含資金進出當下的估值）'};
   const start=opts.start||all[0].date,end=opts.end||all.at(-1).date;
   const rows=all.filter(e=>e.date>=start&&e.date<=end);
   if(rows.length<2||rows[0].date!==start||rows.at(-1).date!==end)return {available:false,reason:'雙方缺少相同起迄日的估值'};
   let prior=n(rows[0].beforeValueTwd)+n(rows[0].externalFlowTwd),factor=1;
   if(!(prior>0))return {available:false,reason:'起始投資市值必須大於 0'};
   const index=[{date:rows[0].date,index:100,valueTwd:rows[0].beforeValueTwd}];
   for(const [i,e] of rows.entries()){
     if(i===0)continue;
     if(prior<=0)return {available:false,reason:'估值期間投資帳戶淨值歸零，無法連乘子期間報酬'};
     const value=n(e.beforeValueTwd);
     factor*=value/prior;
     index.push({date:e.date,index:rnd(factor*100,4),valueTwd:value});
     prior=value+n(e.externalFlowTwd);
   }
   const flows=[{date:rows[0].date,amount:-(n(rows[0].beforeValueTwd)+n(rows[0].externalFlowTwd))}];
   rows.slice(1,-1).forEach(e=>{if(n(e.externalFlowTwd)!==0)flows.push({date:e.date,amount:-n(e.externalFlowTwd)});});
   const last=rows.at(-1);
   flows.push({date:last.date,amount:n(last.beforeValueTwd)});
   let peak=100,mdd=0;
   index.forEach(p=>{peak=Math.max(peak,p.index);mdd=Math.min(mdd,(p.index/peak-1)*100);});
   const years=Math.max(1e-7,days(rows[0].date,last.date)/365),twr=(factor-1)*100;
   return {available:true,twrPct:rnd(twr,3),annualTwrPct:rnd((Math.pow(factor,1/years)-1)*100,3),xirrPct:xirr(flows),maxDrawdownPct:rnd(mdd,3),index,start:rows[0].date,end:last.date,periods:rows.length-1,startValueTwd:rows[0].beforeValueTwd,endValueTwd:last.beforeValueTwd,
     externalFlowTwd:rnd(rows.slice(1,-1).reduce((s,e)=>s+n(e.externalFlowTwd),0)),fundingFlows:flows};
 }
 function comparePerformance(mineEvents,peerEvents){
   const l=new Set((mineEvents||[]).map(x=>x.date)),r=new Set((peerEvents||[]).map(x=>x.date));
   const common=[...l].filter(x=>r.has(x)).sort();
   if(common.length<2)return {available:false,reason:'沒有兩個相同日期的估值點，不能計算可比績效'};
   const start=common[0],end=common.at(-1);
   const mine=performance(mineEvents,{start,end}),peer=performance(peerEvents,{start,end});
   if(!mine.available||!peer.available)return {available:false,reason:mine.reason||peer.reason||'資料不足'};
   return {available:true,mine,peer,start,end,twrGapPct:rnd(mine.twrPct-peer.twrPct,3),xirrGapPct:mine.xirrPct!==null&&peer.xirrPct!==null?rnd(mine.xirrPct-peer.xirrPct,3):null};
 }
 function goalForecast(goal,currentValue){
   const target=n(goal.targetTwd),principal=Math.max(0,n(currentValue)),monthly=n(goal.monthlyContribution),rate=n(goal.annualReturnPct)/100;
   if(target<=0)return {months:null,series:[],target,current:principal};
   const r=Math.pow(1+Math.max(-.95,rate),1/12)-1;let value=principal,hit=principal>=target?0:null;
   const series=[{month:0,value:rnd(value)}];
   for(let i=1;i<=600;i++){
     value=Math.max(0,value*(1+r)+monthly);
     if(i%12===0||i===1)series.push({month:i,value:rnd(value)});
     if(hit===null&&value>=target)hit=i;
   }
   return {months:hit,series,target,current:principal,after10:series.find(x=>x.month===120)?.value||0};
 }
 function alerts(data){
   const a=typeof WealthAnalytics!=='undefined'?WealthAnalytics.analyze(data):null,fn=finance(data),holdings=a?.holdings||[],flow=fn.cashFlows;
   const list=[];if(a?.topPositionWeight>=25)list.push({level:'warning',title:'單一持倉集中',description:`最大投資部位占比 ${rnd(a.topPositionWeight,1)}%，價格變動可能顯著影響投資組合。`});
   if(a?.currencyWeight>=40)list.push({level:'warning',title:'外幣曝險偏高',description:`外幣金融資產占比 ${rnd(a.currencyWeight,1)}%，匯率敏感度較高。`});
   if(fn.runwayMonths!==null&&fn.runwayMonths<6)list.push({level:'warning',title:'備用金不足六個月',description:`依已記錄的平均月支出，銀行餘額約能支付 ${rnd(fn.runwayMonths,1)} 個月。`});
   if(fn.debtRatio!==null&&fn.debtRatio>40)list.push({level:'warning',title:'負債比率較高',description:`金融負債相當於金融資產的 ${rnd(fn.debtRatio,1)}%。`});
   const perf=performance(data.performanceEvents);
   if(!perf.available)list.push({level:'info',title:'投資績效待補',description:'請新增投資帳戶估值與外部入金紀錄，才能計算 XIRR 與 TWR。'});
   if(!list.length)list.push({level:'ok',title:'目前未觸發門檻提醒',description:'本檢查依簡化風險門檻計算，並非保證沒有財務風險。'});
   return list;
 }
 return {migrate,legacyToLedger,reconcile,applyTransaction,removeTransaction,updatePrice,validateTransaction,cashDelta,applyFlow,removeFlow,cashflowStats,liabilities,finance,xirr,performance,comparePerformance,goalForecast,alerts,rnd};
});
