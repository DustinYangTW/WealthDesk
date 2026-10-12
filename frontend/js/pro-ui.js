/* WealthDesk v6 UI: full transaction ledger, investment performance, cashflow,
 * liabilities, financial goals, risk dashboard, and peer performance comparison.
 * Depends on WealthPro and the v5 account/share infrastructure.
 */
(function(root){
 'use strict';
 const P=root.WealthPro;
 const ui={tradeFilter:'all',flowFilter:'all',perfPeriod:'all',stress:-10,modal:null};
 const fmt=(x,d=0)=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number(x)||0);
 const nt=x=>`NT$${fmt(x)}`;
 const signed=x=>`${x>=0?'+':'−'}${nt(Math.abs(x))}`;
 const pr=x=>x===null||x===undefined||!Number.isFinite(Number(x))?'—':`${x>0?'+':''}${fmt(x,2)}%`;
 const money=(x,c)=>`${c==='USD'?'US$':c==='TWD'?'NT$':c+' '}${fmt(x,c==='TWD'?0:2)}`;
 const esc=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
 const dates=x=>String(x||'').replaceAll('-','/');
 const label={buy:'買進',sell:'賣出',dividend:'現金股利／配息',split:'股票拆併',income:'收入',expense:'支出',credit:'信用卡',loan:'信貸／貸款',mortgage:'房貸',other:'其他',tw_stock:'台股／ETF',us_stock:'美股／ETF',fund:'基金'};
 const labels=(key)=>label[key]||key;
 const uid=(prefix)=>`${prefix}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;
 const panel=(title,sub,content,extra='')=>`<section class="panel wd6-panel"><div class="panel-inner"><div class="wd6-section-head"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${extra}</div>${content}</div></section>`;
 const badge=(v)=>`<span class="wd6-badge">${esc(v)}</span>`;
 const empty=(a,b)=>`<div class="wd6-empty"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`;
 const metric=(title,value,sub,kind='')=>`<div class="wd6-kpi ${kind}"><span>${esc(title)}</span><strong class="sensitive num">${value}</strong><small>${sub}</small></div>`;
 const progress=(a,b,color='blue')=>`<div class="wd6-bartrack"><i class="wd6-bar ${color}" style="width:${Math.min(100,Math.max(0,(b?100*a/b:0))).toFixed(2)}%"></i></div>`;
 const header=(title,desc,actions='')=>`<div class="page-heading wd6-heading"><div><div class="eyebrow">WEALTH INTELLIGENCE / V6</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div><div class="page-actions">${actions}<span class="demo-pill">● CLOUD DATA</span></div></div>`;
 const action=(name,title,variant='outline-btn')=>`<button type="button" data-action="${name}" class="${variant}">${title}</button>`;
 function lineChart(series,options={}){
   if(!series||!series.length||!series.some(s=>s.points?.length>=2))return empty('無法繪製圖表','請至少建立兩筆估值資料');
   const w=920,h=275,pl=68,pr=22,pt=22,pb=40;
   const all=series.flatMap(s=>s.points.map(p=>Number(p.y)).filter(Number.isFinite));
   if(!all.length)return empty('目前沒有有效數值','請補上正確的資料');
   let min=Math.min(...all),max=Math.max(...all);
   if(min===max){min-=Math.max(1,Math.abs(min)*.05);max+=Math.max(1,Math.abs(max)*.05);}
   const pad=(max-min)*.13;min-=pad;max+=pad;
   const count=Math.max(...series.map(s=>s.points.length));
   const xx=i=>pl+(w-pl-pr)*i/Math.max(1,count-1);
   const yy=y=>pt+(h-pt-pb)*(max-y)/(max-min);
   const grid=[0,1,2,3,4].map(i=>{const y=pt+(h-pt-pb)*i/4,val=max-(max-min)*i/4;return `<line x1="${pl}" x2="${w-pr}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e6ebf4" stroke-dasharray="3 5"/><text x="${pl-12}" y="${(y+4).toFixed(1)}" fill="#8b98aa" text-anchor="end" font-size="12">${options.money?fmt(val/10000,0)+'萬':fmt(val,0)}</text>`;}).join('');
   const paths=series.map((s,k)=>{const pts=s.points.map((p,i)=>`${xx(i).toFixed(2)},${yy(p.y).toFixed(2)}`).join(' ');const color=s.color||['#5067e7','#21aa9c','#f0b569'][k%3];
     return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3.1" stroke-linejoin="round" stroke-linecap="round"/>${s.points.map((p,i)=>`<circle cx="${xx(i)}" cy="${yy(p.y)}" r="3.6" fill="white" stroke="${color}" stroke-width="2"><title>${esc(p.label||p.date||'')}：${options.money?nt(p.y):fmt(p.y,2)}</title></circle>`).join('')}`;
   }).join('');
   const points=series[0].points;
   const ticks=points.filter((p,i)=>i===0||i===points.length-1||i%Math.max(1,Math.ceil(points.length/6))===0).map(p=>{const i=points.indexOf(p);return `<text x="${xx(i)}" y="${h-11}" text-anchor="middle" font-size="12" fill="#8b98aa">${esc((p.date||p.label||'').slice(5).replace('-','/'))}</text>`;}).join('');
   return `<div class="wd6-plot"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(options.title||'歷史數值曲線')}" preserveAspectRatio="xMidYMid meet">${grid}${paths}${ticks}</svg><div class="wd6-plot-legends">${series.map(s=>`<span><i style="background:${s.color||'#5067e7'}"></i>${esc(s.name)}</span>`).join('')}</div></div>`;
 }
 function overview(data){
   const fn=P.finance(data),ledger=P.reconcile(data),perf=P.performance(data.performanceEvents),warn=P.alerts(data);
   const net=metric('金融淨資產',nt(fn.net),`金融資產 ${nt(fn.gross)} − 負債 ${nt(fn.liabilities.total)}`);
   const realised=metric('已實現交易損益',signed(ledger.realizedTwd),`不含配息；交易費與賣出稅已計入`,ledger.realizedTwd>=0?'good':'bad');
   const savings=metric('記錄期間收支差額',signed(fn.cashFlows.net),`收入 ${nt(fn.cashFlows.income)} · 支出 ${nt(fn.cashFlows.expense)}`);
   const t=metric('投資 TWR',pr(perf.available?perf.twrPct:null),perf.available?`${dates(perf.start)} 至 ${dates(perf.end)}`:'尚無足夠估值與資金流');
   return `<div class="wd6-overview"><div class="wd6-inline-header"><div><div class="eyebrow">FINANCIAL HEALTH</div><h2>財富健檢摘要</h2><p>從交易流水、債務及收支重新整理你的金融淨資產</p></div><button class="outline-btn" data-page="risks">風險與目標 →</button></div><div class="wd6-kpis">${net}${realised}${savings}${t}</div>${panel('本月值得注意','根據假資料與預設門檻自動產生，並非理財建議',`<div class="wd6-alerts">${warn.slice(0,3).map(x=>`<div class="wd6-alert ${x.level}"><strong>${esc(x.title)}</strong><p>${esc(x.description)}</p></div>`).join('')}</div>`)}<div class="wd6-next-actions"><button data-page="trades">查看交易明細 →</button><button data-page="performance">查看績效與 XIRR →</button><button data-page="cashflow">查看資金流向 →</button></div></div>`;
 }
 function trades(data){
   const ledger=P.reconcile(data),list=[...data.transactions].sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id))).filter(x=>ui.tradeFilter==='all'||x.action===ui.tradeFilter);
   const fxCur=id=>data.assets.find(a=>a.id===id)?.currency||'TWD';
   const table=list.length?`<div class="wd6-scroll"><table class="wd6-table"><thead><tr><th>日期與項目</th><th>類型</th><th class="align-r">數量</th><th class="align-r">成交價／股息</th><th class="align-r">費用與稅</th><th class="align-r">交易匯率</th><th>結算</th><th></th></tr></thead><tbody>${list.map(t=>{
     const a=data.assets.find(x=>x.id===t.assetId)||{},c=fxCur(t.assetId);
     const val=t.action==='dividend'?money(t.amount,c):t.action==='split'?`${fmt(t.ratio,4)} 倍`:money(t.price,c);
     return `<tr><td><div class="wd6-stack"><strong>${esc(a.symbol||'未知標的')}</strong><span>${dates(t.date)} · ${esc(a.name||'')}</span></div></td><td><span class="wd6-type ${t.action}">${labels(t.action)}</span></td><td class="align-r num">${t.action==='buy'||t.action==='sell'?fmt(t.quantity,4):'—'}</td><td class="align-r num sensitive">${val}</td><td class="align-r num sensitive">${money(Number(t.fee||0)+Number(t.tax||0),c)}</td><td class="align-r num">${fmt(t.fxRate,4)}</td><td>${t.cashApplied?badge('銀行已連動'):badge('未連動銀行')}</td><td><button class="wd6-small-link danger" data-action="pro-delete-trade" data-id="${esc(t.id)}">刪除</button></td></tr>`;
   }).join('')}</tbody></table></div>`:empty('此分類還沒有交易','按新增交易建立買進、賣出或股息紀錄');
   const groups=ledger.positions.filter(p=>p.buyCount||p.sellCount||p.dividendsTwd).sort((a,b)=>b.realizedTwd-a.realizedTwd);
   return `<div class="content wd6-content">${header('完整交易流水','逐筆保留交易日期、數量、成交價、當日匯率與費用；使用加權平均法推導剩餘成本。',`${action('pro-open-asset','＋ 新標的買進','outline-btn')}${action('pro-open-trade','＋ 新增交易','primary-btn')}`)}
   <div class="wd6-kpis">${metric('已實現賣出損益',signed(ledger.realizedTwd),'依移動平均成本扣除賣出費稅')}${metric('股息與配息淨額',signed(ledger.dividendsTwd),'已扣除股息費用與預扣稅')}${metric('累計交易費稅',nt(ledger.feesTwd),'所有交易的手續費與交易稅')}${metric('交易紀錄',String(data.transactions.length)+' 筆',`${ledger.positions.length} 檔投資標的` )}</div>
   ${panel('所有交易紀錄','新增或刪除交易會重新計算持倉、已實現損益與平均成本。',`<div class="wd6-filterbar">${[['all','全部'],['buy','買進'],['sell','賣出'],['dividend','股息'],['split','拆併股']].map(([k,v])=>`<button data-action="pro-trade-filter" data-filter="${k}" aria-pressed="${ui.tradeFilter===k}" class="${ui.tradeFilter===k?'active':''}">${v}</button>`).join('')}<span>${list.length} 筆結果</span></div>${table}<p class="wd6-footnote">當交易選擇結算銀行時，新增買進會扣除銀行餘額、賣出與股息會增加餘額；刪除紀錄將回沖。從舊版匯入的期初持倉不會重複扣減銀行餘額。禁止超額賣出。歷史成交價與匯率請自行確認。</p>`,`${action('pro-export-trades','匯出交易 CSV')}`)}
   ${panel('各標的已實現貢獻','依成交日匯率換算台幣；含交易與配息，未實現損益另計',`<div class="wd6-contribution">${groups.map(p=>`<div class="wd6-contrib-row"><div><strong>${esc(p.symbol)}</strong><small>買進 ${p.buyCount} · 賣出 ${p.sellCount}</small></div><span class="num ${p.realizedTwd>=0?'gain':'loss'}">${signed(p.realizedTwd)}</span><span class="num gain">配息 ${nt(p.dividendsTwd)}</span></div>`).join('')||empty('沒有交易','尚無可分析的標的')}</div>`)}</div>`;
 }
 function perfStats(data){const ev=data.performanceEvents||[],view=ev;
   if(ui.perfPeriod==='all')return P.performance(view);
   const take=Math.min(view.length,Number(ui.perfPeriod)+1),rows=view.slice(-take);
   if(rows.length<2)return P.performance([]);
   return P.performance(view,{start:rows[0].date,end:rows.at(-1).date});
 }
 function performancePage(data){
   const p=perfStats(data),all=P.performance(data.performanceEvents),l=P.reconcile(data);
   const a=WealthAnalytics.analyze(data),match=all.available&&Math.abs(all.endValueTwd-a.invest)<Math.max(20,a.invest*.005);
   const valuationRows=[...(data.performanceEvents||[])].sort((a,b)=>b.date.localeCompare(a.date));
   return `<div class="content wd6-content">${header('投資績效中心','交易損益、股息與資金流分開統計；XIRR 年化衡量資金時點，TWR 連結每個估值子期間。',`${action('pro-open-valuation','＋ 記錄估值','primary-btn')}`)}
   <div class="wd6-filter-wrap"><span>投資績效期間</span><div class="wd6-filterbar">${[['all','全部期間'],['3','最近 3 區間'],['6','最近 6 區間']].map(([k,v])=>`<button data-action="pro-perf-period" data-period="${k}" aria-pressed="${ui.perfPeriod===k}" class="${ui.perfPeriod===k?'active':''}">${v}</button>`).join('')}</div></div>
   <div class="wd6-kpis">${metric('時間加權報酬 TWR',pr(p.available?p.twrPct:null),p.available?`${p.periods} 個有估值的子期間`:'缺少估值資料')}${metric('資金加權報酬 XIRR',pr(p.available?p.xirrPct:null),'年化值 · 依實際日期與外部資金流')}${metric('年化 TWR',pr(p.available?p.annualTwrPct:null),'依首末估值日換算')}${metric('期間最大回撤',pr(p.available?p.maxDrawdownPct:null),'根據已提供的績效估值節點')}
   </div>${!p.available?`<div class="wd6-notice warning">${esc(p.reason||'此區間估值不足，無法計算績效')}。請從「記錄估值」補齊估值事件。</div>`:''}
   ${!match?`<div class="wd6-notice warning">目前持倉估值 ${nt(a.invest)} 與最後績效快照 ${all.available?nt(all.endValueTwd):'未建立'} 不一致。TWR／XIRR 為既有快照期間的結果，新增交易後請更新最後估值，避免誤當現況績效。</div>`:`<div class="wd6-notice success">最後一筆績效快照已與目前投資部位市值對齊。</div>`}
   ${panel('已扣除資金流影響的績效曲線','以每段期末估值／期初估值連乘，起點 100；與單純「總資產成長」不同',p.available?lineChart([{name:'時間加權淨值指數',color:'#5167e7',points:p.index.map(t=>({date:t.date,y:t.index}))}],{title:'TWR 累計指數'}):empty('沒有可靠的投資績效線','估值與外部淨入金資料不足'))}
   <div class="wd6-split">${panel('實現與未實現損益','成本法與歷史交易換算，不等於 XIRR',`<div class="wd6-statlist"><div><span>未實現部位損益</span><strong class="num ${a.pnl>=0?'gain':'loss'} sensitive">${signed(a.pnl)}</strong></div><div><span>已實現賣出損益</span><strong class="num ${l.realizedTwd>=0?'gain':'loss'} sensitive">${signed(l.realizedTwd)}</strong></div><div><span>股息／配息淨收入</span><strong class="num gain sensitive">${signed(l.dividendsTwd)}</strong></div><div><span>交易手續費與稅</span><strong class="num sensitive">${nt(l.feesTwd)}</strong></div><div><span>合計損益（避免重複加減費用）</span><strong class="num sensitive">${signed(a.pnl+l.realizedTwd+l.dividendsTwd)}</strong></div></div><p class="wd6-footnote">未實現成本包含買進費用；已實現損益已扣賣出費稅；股息採扣稅後淨額，因此此處不會再次扣減總費用。</p>`)}
   ${panel('績效公式與資料品質','XIRR/TWR 必須有估值與外部投入，交易本身不等於外部資金流',`<div class="wd6-formula"><strong>TWR</strong><span>Π（各區間期末入金前市值 ÷ 期初入金後市值） − 1</span><strong>XIRR</strong><span>以實際交易日間隔計算，使投資投入與期末價值淨現值為 0 的年化報酬</span><strong>外部資金流</strong><span>只有投資帳戶的入金／出金才算；買賣股票、收股息都屬帳戶內部活動</span></div><p class="wd6-footnote">估值紀錄必須正確登錄外部資金流，以及交易時點的入金前估值；缺少該時點估值時，嚴格 TWR 無法重建。最大回撤只涵蓋已記錄節點，無法代表日內最大回撤。</p>`)}</div>
   ${panel('投資帳戶估值與外部資金流','每個事件需記錄「外部資金進出前」的淨值；正數為入金、負數為出金',`<div class="wd6-scroll"><table class="wd6-table"><thead><tr><th>估值日期</th><th class="align-r">入金前投資帳戶淨值</th><th class="align-r">外部淨入金</th><th>備註</th><th></th></tr></thead><tbody>${valuationRows.map(v=>`<tr><td>${dates(v.date)}</td><td class="align-r num sensitive">${nt(v.beforeValueTwd)}</td><td class="align-r num sensitive ${Number(v.externalFlowTwd)>=0?'gain':'loss'}">${signed(v.externalFlowTwd||0)}</td><td>${esc(v.note||'—')}</td><td><button data-action="pro-delete-valuation" data-id="${esc(v.id)}" class="wd6-small-link danger">刪除</button></td></tr>`).join('')}</tbody></table></div>${valuationRows.length?'':empty('尚無估值快照','新增投資帳戶估值即可使用績效計算')}`,`${action('pro-export-valuations','估值 CSV')}`)}</div>`;
 }
 function cashflowPage(data){
   const f=P.finance(data),rows=f.cashFlows.rows.filter(x=>ui.flowFilter==='all'||x.kind===ui.flowFilter),l=f.liabilities;
   const categories=f.cashFlows.categories;
   const amounts=f.cashFlows.series.slice(-7);
   const max=Math.max(1,...amounts.map(x=>Math.max(x.income,x.expense)));
   return `<div class="content wd6-content">${header('負債與現金流','收入、生活支出、銀行結算與債務分開紀錄，建立完整的金融淨資產視圖。',`${action('pro-open-flow','＋ 記錄收支','outline-btn')}${action('pro-open-liability','＋ 新增負債','primary-btn')}`)}
   <div class="wd6-kpis">${metric('金融總資產',nt(f.gross),'銀行存款＋投資市值')}${metric('金融負債',nt(l.total),`${l.rows.length} 筆債務`,'bad')}${metric('金融淨資產',nt(f.net),'金融總資產−負債')}${metric('可支應月數',f.runwayMonths===null?'—':`${fmt(f.runwayMonths,1)} 個月`,'依有記錄月份平均生活支出估計')}</div>
   <div class="wd6-split">${panel('按月收入／支出趨勢','僅彙總手動記錄的收支，並非從銀行交易自動讀取',amounts.length?`<div class="wd6-monthbars">${amounts.map(m=>`<div class="wd6-monthcol"><div class="wd6-vbars"><span class="in" title="收入 ${nt(m.income)}" style="height:${m.income/max*100}%"></span><span class="out" title="支出 ${nt(m.expense)}" style="height:${m.expense/max*100}%"></span></div><small>${esc(m.month.slice(5))}月</small></div>`).join('')}</div><div class="wd6-month-legend"><span><i class="inc"></i>收入</span><span><i class="exp"></i>支出</span></div>`:empty('沒有現金流','新增第一筆收入或支出'))}
   ${panel('支出分類排行','了解資金主要使用項目與占比',`<div class="wd6-category-list">${categories.map(x=>`<div class="wd6-cat"><div><strong>${esc(x.name)}</strong><span class="num sensitive">${nt(x.value)} · ${fmt(x.weight,1)}%</span></div>${progress(x.weight,100,'teal')}</div>`).join('')||empty('尚無支出','先建立支出流水')}</div>`)}</div>
   ${panel('金融負債明細','可管理信用卡、信貸、房貸等；金融淨資產會直接扣除未償金額',`<div class="wd6-scroll"><table class="wd6-table"><thead><tr><th>借款名稱</th><th>類型／機構</th><th class="align-r">未償本金</th><th class="align-r">年利率</th><th class="align-r">每月還款</th><th>操作</th></tr></thead><tbody>${l.rows.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(labels(x.category))} · ${esc(x.institution)}</td><td class="align-r num sensitive">${nt(x.twd)}</td><td class="align-r num">${fmt(x.annualRatePct,2)}%</td><td class="align-r num sensitive">${money(x.monthlyPayment,x.currency)}</td><td><button class="wd6-small-link" data-action="pro-edit-liability" data-id="${esc(x.id)}">編輯</button> <button class="wd6-small-link danger" data-action="pro-delete-liability" data-id="${esc(x.id)}">刪除</button></td></tr>`).join('')}</tbody></table></div>${l.rows.length?'':empty('沒有金融負債','可以記錄房貸、信貸或信用卡未繳款')}<div class="wd6-kvfoot"><span>每月預計還款</span><strong class="num sensitive">${nt(l.monthlyPayments)}</strong></div>`) }
   ${panel('收入與支出流水','可選擇是否同步更新指定銀行餘額；刪除時會自動反向回沖',`<div class="wd6-filterbar">${[['all','全部'],['income','收入'],['expense','支出']].map(([k,v])=>`<button class="${ui.flowFilter===k?'active':''}" aria-pressed="${ui.flowFilter===k}" data-action="pro-flow-filter" data-filter="${k}">${v}</button>`).join('')}<span>${rows.length} 筆</span></div><div class="wd6-scroll"><table class="wd6-table"><thead><tr><th>日期與項目</th><th>分類</th><th class="align-r">金額 (TWD)</th><th>是否連動銀行</th><th></th></tr></thead><tbody>${rows.map(t=>`<tr><td><div class="wd6-stack"><strong>${esc(t.description||labels(t.kind))}</strong><span>${dates(t.date)}</span></div></td><td><span class="wd6-type ${t.kind}">${esc(t.category||labels(t.kind))}</span></td><td class="align-r num sensitive ${t.kind==='income'?'gain':'loss'}">${t.kind==='income'?'+':'−'}${nt(t.twd)}</td><td>${t.bankApplied?'已連動':'不連動'}</td><td><button class="wd6-small-link danger" data-action="pro-delete-flow" data-id="${esc(t.id)}">刪除</button></td></tr>`).join('')}</tbody></table></div>${rows.length?'':empty('沒有符合條件的資料','請調整分類或新增流水')}`,`${action('pro-export-flows','收支 CSV')}`)}
   <div class="wd6-notice">注意：薪資與支出流水是管理統計，不會自行追溯銀行歷史；當你選擇「同步更新銀行餘額」才會套用當筆增減。銀行內部轉帳不應當收入／支出重複計算。</div></div>`;
 }
 function riskGoalPage(data){
   const fin=P.finance(data),a=WealthAnalytics.analyze(data),p=P.performance(data.performanceEvents),alerts=P.alerts(data);
   const stress=fin.gross+a.invest*ui.stress/100;
   const goalElements=(data.goals||[]).map(g=>{
     const base=g.base==='cash'?fin.cash:g.base==='invest'?a.invest:fin.net;
     const projection=P.goalForecast(g,base);
     const completion=g.targetTwd>0?Math.max(0,Math.min(100,base/g.targetTwd*100)):0;
     return `<div class="wd6-goal"><div class="wd6-goal-top"><div><span class="wd6-label">${esc(g.base==='cash'?'現金目標':g.base==='invest'?'投資目標':'金融淨資產')}</span><h3>${esc(g.name)}</h3></div><div><button data-action="pro-edit-goal" data-id="${esc(g.id)}" class="wd6-small-link">編輯</button><button data-action="pro-delete-goal" data-id="${esc(g.id)}" class="wd6-small-link danger">刪除</button></div></div><div class="wd6-goal-fig"><strong class="num sensitive">${nt(base)}</strong><span class="num">目標 ${nt(g.targetTwd)}</span></div>${progress(completion,100,'purple')}<div class="wd6-goal-foot"><span>已達成 ${fmt(completion,1)}%</span><span>${projection.months===null?'依假設 50 年內無法達標':projection.months===0?'已達標':`模擬約 ${projection.months} 個月達標`}</span></div><p class="wd6-footnote">每月投入 ${nt(g.monthlyContribution)} · 假設年報酬 ${fmt(g.annualReturnPct,2)}% · 不代表未來保證報酬。${g.targetDate?'希望日期 '+dates(g.targetDate):''}</p></div>`;
   }).join('');
   const max=Math.max(1,...a.positionsByValue.slice(0,5).map(x=>x.valueTwd));
   return `<div class="content wd6-content">${header('風險與財務目標','把「多少資產」延伸為集中度、流動性、回撤、壓力情境及達標時間。',`${action('pro-open-goal','＋ 新增財務目標','primary-btn')}`)}
   <div class="wd6-kpis">${metric('最大單一持倉',`${fmt(a.topPositionWeight,1)}%`,'占全部投資市值')}${metric('前三大集中度',`${fmt(a.top3Weight,1)}%`,'前三大部位占比')}${metric('外幣資產比重',`${fmt(a.currencyWeight,1)}%`,'以 TWD 換算後比較')}${metric('區間最大回撤',pr(p.available?p.maxDrawdownPct:null),'基於已有績效估值節點')}</div>
   <div class="wd6-split">${panel('持股集中度','前五大持倉的台幣市值',`<div class="wd6-category-list">${a.positionsByValue.slice(0,5).map(x=>`<div class="wd6-cat"><div><strong>${esc(x.symbol)} · ${esc(x.name)}</strong><span class="num sensitive">${nt(x.valueTwd)}</span></div>${progress(x.valueTwd,max,'blue')}</div>`).join('')||empty('沒有投資部位','新增交易建立第一個部位')}</div>`)}
   ${panel('智能風險觀察','使用固定門檻作提示，不是財務診斷',`<div class="wd6-alerts">${alerts.map(x=>`<div class="wd6-alert ${x.level}"><strong>${esc(x.title)}</strong><p>${esc(x.description)}</p></div>`).join('')}</div>`)}</div>
   ${panel('市場壓力測試','假設所有投資部位同步漲跌，銀行存款及負債不變。',`<div class="wd6-stress"><div><label for="pro-stress">投資市場統一變化 <strong id="pro-stress-label">${ui.stress>0?'+':''}${ui.stress}%</strong></label><input id="pro-stress" type="range" min="-40" max="30" step="1" value="${ui.stress}"/><div class="wd6-stress-marks"><span>−40%</span><span>0%</span><span>+30%</span></div></div><div class="wd6-stress-out"><small>模擬金融淨資產</small><strong class="num sensitive" id="pro-stress-total">${nt(stress-fin.liabilities.total)}</strong><span class="num ${ui.stress>=0?'gain':'loss'}" id="pro-stress-diff">${signed(a.invest*ui.stress/100)} 相對現況</span></div></div><p class="wd6-footnote">只是假設敏感度，不包含標的相關性、融資槓桿、股息、稅負或匯率波動；不得視為損失上限。</p>`)}
   ${panel('我的財務目標','可設定目標金額、每月投入與假設報酬率，依月複利進行情境模擬',`<div class="wd6-goal-grid">${goalElements||empty('尚無財務目標','新增目標即可顯示進度和模擬時間')}</div>`)}</div>`;
 }
 function comparePerformanceMarkup(own,peerData,scope){
   if(!peerData||!['investments','full'].includes(scope))return `<section class="panel wd6-panel"><div class="panel-inner"><h2>同期投資能力比較</h2><div class="wd6-notice warning">對方目前只授權資產總覽，沒有授權投資績效估值；無法比較雙方 TWR／XIRR。</div></div></section>`;
   const comparison=P.comparePerformance(own.performanceEvents,peerData.performanceEvents);
   if(!comparison.available)return panel('同期投資績效比較','必須在相同起迄日具備雙方估值與外部資金流',empty('缺少可比資料',comparison.reason));
   const {mine,peer,start,end}=comparison;
   return panel('真正的投資績效比較','相同起訖日期、各自外部資金流；比「總資產規模」更接近投資績效分析',`<div class="wd6-peer-head"><strong>${dates(start)} — ${dates(end)}</strong><span>雙方共有 ${mine.index.length}／${peer.index.length} 個估值節點，使用同一期起訖日</span></div>
     <div class="wd6-peer-kpis">${metric('我的 TWR',pr(mine.twrPct),'時間加權')}${metric('對方 TWR',pr(peer.twrPct),'時間加權')}${metric('TWR 差距',pr(comparison.twrGapPct),'差距單位為百分點')}${metric('我的／對方 XIRR',`${pr(mine.xirrPct)} / ${pr(peer.xirrPct)}`,'依各自資金流計算的年化值')}</div>
     ${lineChart([{name:'我的 TWR 指數',color:'#5167e7',points:mine.index.map(e=>({date:e.date,y:e.index}))},{name:'對方 TWR 指數',color:'#19a994',points:peer.index.map(e=>({date:e.date,y:e.index}))}],{title:'雙人投資績效指數'})}
     <p class="wd6-footnote">投資績效數據來自對方授權的估值摘要，不包含其銀行帳戶或交易流水。中間估值節點可能不同，曲線只呈現各自實際有記錄的節點；請勿以中途相同圖形位置理解為同一日比較。</p>`);
 }
 function render(page,ctx){switch(page){case'trades':return trades(ctx.data);case'performance':return performancePage(ctx.data);case'cashflow':return cashflowPage(ctx.data);case'risks':return riskGoalPage(ctx.data);default:return '';}}
 const field=(name,label,el,small='')=>`<div class="form-field"><label for="pro-${name}">${esc(label)}</label>${el}${small?`<small>${esc(small)}</small>`:''}</div>`;
 const inpt=(name,type,value='',attrs='')=>`<input id="pro-${name}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}/>`;
 const select=(name,options,value='')=>`<select id="pro-${name}" name="${name}">${options.map(([k,v])=>`<option value="${esc(k)}" ${String(value)===String(k)?'selected':''}>${esc(v)}</option>`).join('')}</select>`;
 const bankOptions=(data,currency)=>[['','不連動銀行餘額'],...data.bankAccounts.filter(b=>b.currency===currency).map(b=>[b.id,`${b.bank} · ${b.accountName} (${b.currency})`])];
 function open(kind,ctx,id=null){
   const data=ctx.data;
   const assetOptions=data.assets.filter(a=>data.holdings.some(h=>h.id===a.id)).concat(data.assets.filter(a=>!data.holdings.some(h=>h.id===a.id)))
     .map(a=>[a.id,`${a.symbol} · ${a.name} (${a.currency})`]);
   const now=data.meta?.asOf||new Date().toISOString().slice(0,10);
   const item=kind==='liability'?data.liabilities.find(x=>x.id===id):kind==='goal'?data.goals.find(x=>x.id===id):kind==='quote'?data.assets.find(x=>x.id===id):null;
   ui.modal={kind,id};let title='',content='';
   if(kind==='trade'){
     const first=data.assets[0],currency=first?.currency||'TWD';title='新增交易紀錄';
     content=assetOptions.length?`<div class="wd6-formgrid">${field('assetId','投資標的 *',select('assetId',assetOptions))}${field('action','交易類型 *',select('action',[['buy','買進'],['sell','賣出'],['dividend','現金股利／配息'],['split','股票拆併']]))}${field('date','交易日期 *',inpt('date','date',now,'required'))}${field('quantity','成交數量 *',inpt('quantity','number','1','min="0.000001" step="any" required'))}${field('price','每單位成交價 *',inpt('price','number',first?.currentPrice||100,'min="0.000001" step="any" required'))}${field('amount','現金股利／配息總額',inpt('amount','number','0','min="0" step="any"'))}${field('ratio','拆併股後數量倍率',inpt('ratio','number','2','min="0.000001" step="any"'))}${field('fee','手續費',inpt('fee','number','0','min="0" step="any"'))}${field('tax','交易稅／股息扣繳',inpt('tax','number','0','min="0" step="any"'))}${field('fxRate','交易日匯率 (1 原幣兌台幣) *',inpt('fxRate','number',data.fxRates[currency]||1,'min="0.000001" step="any" required'))}${field('bankId','結算銀行（選填）',select('bankId',bankOptions(data,currency)))}</div><p class="wd6-footnote">選擇銀行後會同步更新存款餘額；空白代表只登錄交易，不改現有銀行餘額。買進成本包含買進費用；賣出費稅列入已實現損益。</p>`:
       empty('尚無可交易標的','請先使用「新標的買進」建立第一筆紀錄');
   }else if(kind==='asset'){
     title='新標的首次買進';
     content=`<div class="wd6-formgrid">${field('symbol','股票代碼 / 基金識別 *',inpt('symbol','text','','required maxlength="24"'))}${field('name','標的名稱 *',inpt('name','text','','required maxlength="90"'))}${field('type','資產分類 *',select('type',[['tw_stock','台股／ETF'],['us_stock','美股／ETF'],['fund','基金']]))}${field('broker','券商／保管機構 *',inpt('broker','text','','required maxlength="80"'))}${field('currency','計價幣別 *',select('currency',[['TWD','台幣'],['USD','美元'],['JPY','日圓']],'TWD'))}${field('date','首次買進日期 *',inpt('date','date',now,'required'))}${field('quantity','買進數量 *',inpt('quantity','number','100','required min="0.000001" step="any"'))}${field('price','買進成交單價 *',inpt('price','number','100','required min="0.000001" step="any"'))}${field('currentPrice','目前參考報價 *',inpt('currentPrice','number','100','required min="0" step="any"'))}${field('fee','買進手續費',inpt('fee','number','0','min="0" step="any"'))}${field('fxRate','買進時匯率 *',inpt('fxRate','number','1','min="0.000001" step="any" required'))}</div><div class="wd6-notice">新標的會自動建立第一筆買進交易，往後的股數與成本皆由交易流水計算。</div>`;
   }else if(kind==='quote'){
     title=`更新報價 · ${item?.symbol||''}`;
     content=`<div class="wd6-formgrid">${field('name','標的名稱 *',inpt('name','text',item?.name||'','required maxlength="90"'))}${field('broker','券商 / 來源 *',inpt('broker','text',item?.broker||'','required'))}${field('currentPrice','目前參考價格 *',inpt('currentPrice','number',item?.currentPrice||0,'required min="0" step="any"'))}</div><p class="wd6-footnote">持有股數與平均成本由歷史交易自動推導。要調整股數、成本或已實現損益，請新增正確的買賣紀錄，不要在報價頁直接覆寫成本。</p>`;
   }else if(kind==='flow'){
     title='新增收入／支出流水';
     content=`<div class="wd6-formgrid">${field('kind','流水類型 *',select('kind',[['income','收入'],['expense','支出']]))}${field('date','日期 *',inpt('date','date',now,'required'))}${field('description','摘要 / 用途 *',inpt('description','text','','required maxlength="120"'))}${field('category','收支分類 *',select('category',[['薪資','薪資'],['年終','年終／獎金'],['其他收入','其他收入'],['食物','食物'],['房租','房租'],['交通','交通'],['生活','生活用品'],['旅遊','旅遊'],['保險','保險'],['醫療','醫療'],['其他','其他']]))}${field('currency','幣別 *',select('currency',[['TWD','台幣'],['USD','美元'],['JPY','日圓']]))}${field('amount','金額 *',inpt('amount','number','1000','required min="0.01" step="any"'))}${field('fxRate','事件當日匯率 *',inpt('fxRate','number','1','required min="0.000001" step="any"'))}${field('bankId','同步銀行餘額（選填）',select('bankId',bankOptions(data,'TWD')))}</div><p class="wd6-footnote">收入／支出屬外部收支，銀行之間的資金轉帳不應在此重複記為收入或支出。</p>`;
   }else if(kind==='liability'){
     title=id?'修改金融負債':'新增金融負債';const x=item||{};
     content=`<div class="wd6-formgrid">${field('name','負債名稱 *',inpt('name','text',x.name||'','required maxlength="90"'))}${field('institution','金融機構 *',inpt('institution','text',x.institution||'','required maxlength="60"'))}${field('category','負債類型 *',select('category',[['credit','信用卡'],['loan','信貸／貸款'],['mortgage','房貸'],['other','其他']],x.category||'credit'))}${field('currency','幣別 *',select('currency',[['TWD','台幣'],['USD','美元'],['JPY','日圓']],x.currency||'TWD'))}${field('balance','未償本金 *',inpt('balance','number',x.balance??0,'required min="0" step="any"'))}${field('annualRatePct','年利率 (%)',inpt('annualRatePct','number',x.annualRatePct??0,'min="0" max="100" step="any"'))}${field('monthlyPayment','每月預計還款',inpt('monthlyPayment','number',x.monthlyPayment??0,'min="0" step="any"'))}${field('dueDate','下次／到期日',inpt('dueDate','date',x.dueDate||''))}</div>`;
   }else if(kind==='goal'){
     title=id?'調整財務目標':'新增財務目標';const g=item||{};
     content=`<div class="wd6-formgrid">${field('name','財務目標名稱 *',inpt('name','text',g.name||'','required maxlength="80"'))}${field('base','目前進度以何者為準 *',select('base',[['net','金融淨資產'],['cash','銀行存款'],['invest','投資市值']],g.base||'net'))}${field('targetTwd','目標金額 (TWD) *',inpt('targetTwd','number',g.targetTwd||3000000,'required min="1" step="any"'))}${field('monthlyContribution','每月投入金額',inpt('monthlyContribution','number',g.monthlyContribution??20000,'min="0" step="any"'))}${field('annualReturnPct','假設年報酬率 (%)',inpt('annualReturnPct','number',g.annualReturnPct??4,'min="-95" max="100" step="any"'))}${field('targetDate','希望達成日期',inpt('targetDate','date',g.targetDate||''))}</div><p class="wd6-footnote">僅使用固定的月度複利假設，沒有通膨、稅務與市場波動模型。</p>`;
   }else if(kind==='valuation'){
     title='記錄投資帳戶估值';const last=data.performanceEvents.at(-1);
     content=`<div class="wd6-formgrid">${field('date','估值日期 *',inpt('date','date',now,'required'))}${field('beforeValueTwd','資金進出前投資帳戶淨值 (TWD) *',inpt('beforeValueTwd','number',last?.beforeValueTwd||0,'min="0" step="any" required'))}${field('externalFlowTwd','該時點外部資金流 (TWD)',inpt('externalFlowTwd','number','0','step="any"'))}${field('note','說明',inpt('note','text','','maxlength="160"'))}</div><div class="wd6-notice">TWR 假設外部入金／出金發生在這個估值時點之後：必須填寫入金「之前」的投資帳戶淨值。正數為存入投資帳戶，負數為提領。</div>`;
   }
   const modal=document.getElementById('pro-dialog');document.getElementById('pro-title').textContent=title;document.getElementById('pro-fields').innerHTML=content;
   document.getElementById('pro-error').textContent='';document.getElementById('pro-save-btn').disabled=kind==='trade'&&!assetOptions.length;
   document.getElementById('pro-form').dataset.kind=kind;
   modal.showModal();
   if(kind==='trade')updateTradeFields(ctx.data);
 }
 function updateTradeFields(data){
   const modal=document.getElementById('pro-dialog');if(!modal?.open)return;
   const form=document.getElementById('pro-form');if(form.dataset.kind!=='trade')return;
   const action=form.elements.action?.value,asset=data.assets.find(x=>x.id===form.elements.assetId?.value);
   const toggles={quantity:['buy','sell'],price:['buy','sell'],amount:['dividend'],ratio:['split']};
   Object.keys(toggles).forEach(k=>{const show=toggles[k].includes(action);const field=form.elements[k]?.closest('.form-field');if(field){field.hidden=!show;form.elements[k].required=show;}});
   const bank=form.elements.bankId;
   if(asset&&bank){const prior=bank.value;bank.innerHTML=bankOptions(data,asset.currency).map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('');if([...bank.options].some(x=>x.value===prior))bank.value=prior;
     const fx=form.elements.fxRate;if(fx&&form.dataset.assetPrev!==asset.id){fx.value=data.fxRates?.[asset.currency]||1;form.dataset.assetPrev=asset.id;}
     const price=form.elements.price;if(price&&form.dataset.pricePrev!==asset.id){price.value=asset.currentPrice;form.dataset.pricePrev=asset.id;}
   }
 }
 function onFieldChange(target,ctx){
   const form=target.closest('#pro-form');if(!form)return false;
   if(form.dataset.kind==='trade'&&['action','assetId'].includes(target.name)){updateTradeFields(ctx.data);return true;}
   if(form.dataset.kind==='asset'&&target.name==='currency')form.elements.fxRate.value=ctx.data.fxRates?.[target.value]||1;
   if(form.dataset.kind==='flow'&&target.name==='currency'){
     form.elements.fxRate.value=ctx.data.fxRates?.[target.value]||1;
     form.elements.bankId.innerHTML=bankOptions(ctx.data,target.value).map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('');
   }
   return true;
 }
 function mutateData(ctx,fn,message){
   try{const result=fn(P.migrate(ctx.data));ctx.onChange(result,message);return true;}catch(e){if(document.getElementById('pro-dialog')?.open)document.getElementById('pro-error').textContent=e.message;else ctx.toast(e.message);return false;}
 }
 function submit(e,ctx){
   e.preventDefault();const form=e.target;if(form.id!=='pro-form')return false;
   const fd=new FormData(form),x=Object.fromEntries(fd.entries()),{kind,id}=ui.modal||{};
   const val=k=>Number(x[k]),txt=k=>String(x[k]||'').trim();
   let success=false;
   try{
     if(kind==='trade'){
       const t={id:uid('trade'),assetId:txt('assetId'),action:txt('action'),date:txt('date'),quantity:val('quantity'),price:val('price'),amount:val('amount'),ratio:val('ratio'),fee:val('fee'),tax:val('tax'),fxRate:val('fxRate'),bankId:txt('bankId')};
       success=mutateData(ctx,d=>P.applyTransaction(d,t),'已新增交易，平均成本與損益已更新');
     }else if(kind==='asset'){
       success=mutateData(ctx,d=>{
         const a={id:uid('pos'),symbol:txt('symbol').toUpperCase(),name:txt('name'),type:txt('type'),broker:txt('broker'),currency:txt('currency'),currentPrice:val('currentPrice'),entryDate:txt('date')};
         if(!a.symbol||!a.name||!a.broker||!['TWD','USD','JPY'].includes(a.currency)||!['tw_stock','us_stock','fund'].includes(a.type))throw new Error('請輸入完整的標的名稱、分類及幣別');
         if(d.assets.some(z=>z.symbol===a.symbol&&z.broker===a.broker&&z.type===a.type))throw new Error('相同券商已有相同投資標的，請使用新增買進紀錄');
         d.assets.push(a);
         return P.applyTransaction(d,{id:uid('trade'),assetId:a.id,action:'buy',date:txt('date'),quantity:val('quantity'),price:val('price'),fee:val('fee'),tax:0,fxRate:val('fxRate'),bankId:''});
       },'已建立新投資標的及首次買進紀錄');
     }else if(kind==='quote'){
       success=mutateData(ctx,d=>P.updatePrice(d,id,val('currentPrice'),{name:txt('name'),broker:txt('broker')}),'已更新標的現價及參考資料');
     }else if(kind==='flow'){
       success=mutateData(ctx,d=>P.applyFlow(d,{id:uid('cashflow'),kind:txt('kind'),date:txt('date'),description:txt('description'),category:txt('category'),amount:val('amount'),currency:txt('currency'),fxRate:val('fxRate'),bankId:txt('bankId')}),'收支流水已新增');
     }else if(kind==='liability'){
       success=mutateData(ctx,d=>{
         if(!txt('name')||!txt('institution')||!Number.isFinite(val('balance'))||val('balance')<0||val('annualRatePct')<0||val('annualRatePct')>100||val('monthlyPayment')<0)throw new Error('請填寫有效的負債與金額');
         const obj={id:id||uid('debt'),name:txt('name'),institution:txt('institution'),category:txt('category'),currency:txt('currency'),balance:val('balance'),annualRatePct:val('annualRatePct'),monthlyPayment:val('monthlyPayment'),dueDate:txt('dueDate')};
         const idx=d.liabilities.findIndex(z=>z.id===id);if(idx>=0)d.liabilities[idx]=obj;else d.liabilities.push(obj);return d;
       },id?'負債已更新':'負債已新增');
     }else if(kind==='goal'){
       success=mutateData(ctx,d=>{
         if(!txt('name')||val('targetTwd')<=0||val('monthlyContribution')<0||val('annualReturnPct')<=-100||val('annualReturnPct')>100)throw new Error('請輸入有效的目標金額和報酬假設');
         const obj={id:id||uid('goal'),name:txt('name'),base:txt('base'),targetTwd:val('targetTwd'),monthlyContribution:val('monthlyContribution'),annualReturnPct:val('annualReturnPct'),targetDate:txt('targetDate')};
         const idx=d.goals.findIndex(z=>z.id===id);if(idx>=0)d.goals[idx]=obj;else d.goals.push(obj);return d;
       },id?'財務目標已更新':'財務目標已新增');
     }else if(kind==='valuation'){
       success=mutateData(ctx,d=>{
         if(!/^\d{4}-\d{2}-\d{2}$/.test(txt('date'))||txt('date')>d.meta.asOf||val('beforeValueTwd')<0||!Number.isFinite(val('beforeValueTwd'))||!Number.isFinite(val('externalFlowTwd')))throw new Error('請填寫有效日期、入金前淨值和外部資金流');
         if(d.performanceEvents.some(z=>z.date===txt('date')))throw new Error('同一日期已存在估值事件，請先移除後再新增');
         d.performanceEvents.push({id:uid('value'),date:txt('date'),beforeValueTwd:val('beforeValueTwd'),externalFlowTwd:val('externalFlowTwd'),note:txt('note')});
         d.performanceEvents.sort((a,b)=>a.date.localeCompare(b.date));return d;
       },'投資估值事件已新增');
     }
   }catch(err){document.getElementById('pro-error').textContent=err.message;return false;}
   if(success){const modal=document.getElementById('pro-dialog');modal.close();ui.modal=null;}
   return true;
 }
 function exportCsv(file,header,rows){
   const quote=x=>`"${String(x??'').replaceAll('"','""')}"`;
   const csv='\ufeff'+[header,...rows].map(r=>r.map(quote).join(',')).join('\r\n');
   const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=file;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
 }
 function handleAction(btn,ctx){const action=btn.dataset.action,id=btn.dataset.id;
   if(action==='pro-open-trade')open('trade',ctx);
   else if(action==='pro-open-asset')open('asset',ctx);
   else if(action==='pro-open-flow')open('flow',ctx);
   else if(action==='pro-open-liability')open('liability',ctx);
   else if(action==='pro-edit-liability')open('liability',ctx,id);
   else if(action==='pro-open-goal')open('goal',ctx);
   else if(action==='pro-edit-goal')open('goal',ctx,id);
   else if(action==='pro-open-valuation')open('valuation',ctx);
   else if(action==='pro-open-quote')open('quote',ctx,id);
   else if(action==='pro-close')document.getElementById('pro-dialog').close();
   else if(action==='pro-trade-filter'){ui.tradeFilter=btn.dataset.filter;ctx.render();}
   else if(action==='pro-flow-filter'){ui.flowFilter=btn.dataset.filter;ctx.render();}
   else if(action==='pro-perf-period'){ui.perfPeriod=btn.dataset.period;ctx.render();}
   else if(action==='pro-delete-trade'){
     if(confirm('確定刪除此交易？持倉與成本會依剩餘交易重新計算；如有連動銀行，也將反向回沖。'))mutateData(ctx,d=>P.removeTransaction(d,id),'已刪除交易');
   }else if(action==='pro-delete-flow'){
     if(confirm('確定刪除此收入／支出紀錄？若曾連動銀行，餘額將自動回沖。'))mutateData(ctx,d=>P.removeFlow(d,id),'現金流已刪除');
   }else if(action==='pro-delete-liability'){
     if(confirm('確定刪除此筆負債？'))mutateData(ctx,d=>{d.liabilities=d.liabilities.filter(x=>x.id!==id);return d;},'負債已刪除');
   }else if(action==='pro-delete-goal'){
     if(confirm('確定刪除此財務目標？'))mutateData(ctx,d=>{d.goals=d.goals.filter(x=>x.id!==id);return d;},'財務目標已刪除');
   }else if(action==='pro-delete-valuation'){
     if(confirm('刪除估值可能導致 TWR／XIRR 無法計算，確定繼續？'))mutateData(ctx,d=>{d.performanceEvents=d.performanceEvents.filter(x=>x.id!==id);return d;},'估值事件已刪除');
   }else if(action==='pro-export-trades'){
     const lookup=new Map(ctx.data.assets.map(a=>[a.id,a]));
     exportCsv('wealthdesk-trades.csv',['日期','標的','類型','數量','價格','股息金額','費用','稅','交易匯率','銀行是否連動'],ctx.data.transactions.map(t=>[t.date,lookup.get(t.assetId)?.symbol||'',labels(t.action),t.quantity||'',t.price||'',t.amount||'',t.fee||0,t.tax||0,t.fxRate,t.cashApplied?'是':'否']));
   }else if(action==='pro-export-flows')exportCsv('wealthdesk-cashflows.csv',['日期','收支','分類','說明','幣別','金額','當日匯率'],ctx.data.cashFlows.map(x=>[x.date,labels(x.kind),x.category,x.description,x.currency,x.amount,x.fxRate]));
   else if(action==='pro-export-valuations')exportCsv('wealthdesk-valuations.csv',['日期','入金前淨值TWD','外部入金TWD','備註'],ctx.data.performanceEvents.map(x=>[x.date,x.beforeValueTwd,x.externalFlowTwd,x.note]));
   return true;
 }
 function reset(){ui.tradeFilter='all';ui.flowFilter='all';ui.perfPeriod='all';ui.stress=-10;ui.modal=null;}
 root.WealthProUI={render,overview,comparePerformanceMarkup,open,submit,handleAction,onFieldChange,reset,ui};
})(typeof globalThis!=='undefined'?globalThis:this);
