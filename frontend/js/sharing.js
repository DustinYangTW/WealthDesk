/** Cloud shared portfolio metadata cache; all authorization is evaluated on GAS. */
(() => {
 'use strict';
 const scopes={summary:'僅資產總覽',investments:'投資及統計',full:'全部資產（唯讀）'};
 let cache={incoming:[],outgoing:[],events:[]};
 function reset(){cache={incoming:[],outgoing:[],events:[]};}
 async function refresh(){cache=await WealthAPI.call('share.list');return cache;}
 function incoming(){return cache.incoming||[];}
 function outgoing(){return cache.outgoing||[];}
 function eventsFor(){return cache.events||[];}
 const latestMetadata=(_viewerId,id)=>incoming().find(g=>g.id===id)||null;
 async function invite(_ownerId,email,scope,expiresAt,_ownerData,allowExport=false){
   const item=await WealthAPI.call('share.invite',{email,scope,expiresAt,allowExport});await refresh();return item;
 }
 async function respond(_viewerId,grantId,accept){const result=await WealthAPI.call('share.respond',{grantId,accept});await refresh();return result;}
 async function revoke(_ownerId,grantId){const result=await WealthAPI.call('share.revoke',{grantId});await refresh();return result;}
 async function update(_ownerId,grantId,options){const result=await WealthAPI.call('share.update',{grantId,...options});await refresh();return result;}
 async function read(_viewerId,_privateKey,grantId,forExport=false){
   const result=await WealthAPI.call('share.read',{grantId,forExport});
   await refresh();return result;
 }
 function projectPortfolio(data,scope){
   // This local projection is ONLY used for my own dashboard family summary.
   const d=WealthPro.migrate(data),an=WealthAnalytics.analyze(d),fx=c=>Number(d.fxRates[c]||1);
   const cash=d.bankAccounts.reduce((s,b)=>s+Number(b.balance)*fx(b.currency),0);
   const invest=d.holdings.reduce((s,h)=>s+Number(h.quantity)*Number(h.currentPrice)*fx(h.currency),0);
   const cost=d.holdings.reduce((s,h)=>s+Number(h.costTwd||0),0);
   const groups={cash,tw_stock:0,us_stock:0,fund:0},currencies={};
   d.bankAccounts.forEach(b=>currencies[b.currency]=(currencies[b.currency]||0)+b.balance*fx(b.currency));
   d.holdings.forEach(h=>{const v=h.quantity*h.currentPrice*fx(h.currency);groups[h.type]=(groups[h.type]||0)+v;currencies[h.currency]=(currencies[h.currency]||0)+v;});
   return {scope,rollup:{totalTwd:cash+invest,cashTwd:cash,investTwd:invest,costTwd:cost,pnlTwd:invest-cost,roiPct:cost?(invest-cost)/cost*100:0,groups,currencies,bankCount:d.bankAccounts.length,holdingCount:d.holdings.length},history:an.history};
 }
 window.WealthShares={scopes,reset,refresh,incoming,outgoing,eventsFor,invite,respond,revoke,update,read,latestMetadata,projectPortfolio};
})();
