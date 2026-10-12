/** WealthDesk v6 / Google Apps Script service.
 * Deploy as Web App: Execute as owner, access Anyone.
 * All private operations require a revocable application Session token.
 * Script properties: APP_SECRET (>=32 random chars); optional SPREADSHEET_ID,
 * ALLOW_REGISTRATION=true/false. Run setupWealthDesk() once.
 */
var WD_TABLES = {
  Users: ['id','email','name','salt','verifier','status','failedLogins','lockedUntil','createdAt','updatedAt'],
  Sessions: ['id','userId','tokenHash','createdAt','lastSeenAt','expiresAt','revokedAt'],
  Verifications: ['id','email','purpose','codeHash','createdAt','expiresAt','attempts','consumedAt'],
  Portfolios: ['userId','revision','checksum','partCount','updatedAt'],
  PortfolioChunks: ['userId','revision','part','content','createdAt'],
  ShareGrants: ['id','ownerId','viewerId','scope','allowExport','expiresAt','status','createdAt','updatedAt'],
  AuditLogs: ['id','actorId','action','targetId','at']
};
var WD_MAX_BODY = 2300000;
var WD_MAX_JSON = 1400000;
var WD_CHUNK_SIZE = 20000;
var WD_IDLE_MS = 30 * 60 * 1000;
var WD_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
var WD_PROOF_ITERATIONS = 310000;

function setupWealthDesk() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('APP_SECRET');
  if (!secret || secret.length < 32) throw new Error('請先到專案設定 > 指令碼屬性，新增 APP_SECRET（至少 32 個隨機字元）');
  var id = props.getProperty('SPREADSHEET_ID');
  var spreadsheet;
  if (id) spreadsheet = SpreadsheetApp.openById(id);
  else {
    spreadsheet = SpreadsheetApp.create('WealthDesk - Private Database');
    id = spreadsheet.getId();
    props.setProperty('SPREADSHEET_ID', id);
  }
  Object.keys(WD_TABLES).forEach(function (name) {
    var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    var headers = WD_TABLES[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  });
  Logger.log('WealthDesk database ID: ' + id);
  return id;
}

function doGet(e) {
  return wd_response({ok:true, data:{app:'WealthDesk',service:'GAS',status:'online',version:1}});
}
function doPost(e) {
  try {
    var text = e && e.postData && e.postData.contents || '';
    if (text.length > WD_MAX_BODY) wd_fail('PAYLOAD_TOO_LARGE','請求資料過大');
    var req = JSON.parse(text);
    if (!req || typeof req.action !== 'string' || req.action.length > 60) wd_fail('BAD_REQUEST','無效的 API 操作');
    return wd_response({ok:true,data:wd_dispatch(req)});
  } catch (err) {
    // GAS ContentService does not allow setting the HTTP status: use typed JSON errors.
    return wd_response({ok:false,error:{code:err.code || 'SERVER_ERROR',message:err.publicMessage || '服務暫時無法處理，請稍後再試'}});
  }
}
function wd_response(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
function wd_fail(code, message) {
  var err = new Error(message);err.code=code;err.publicMessage=message;throw err;
}
function wd_dispatch(r) {
  var open = {
    'auth.salt': wd_authSalt,
    'auth.register': wd_authRegister,
    'auth.verify': wd_authVerify,
    'auth.resend': wd_authResend,
    'auth.login': wd_authLogin,
    'auth.reset.request': wd_authResetRequest,
    'auth.reset.complete': wd_authResetComplete
  };
  if (Object.prototype.hasOwnProperty.call(open,r.action)) return open[r.action](r);
  var actor = wd_requireSession(r.token);
  var handlers = {
    'auth.me':function(){return wd_authPayload(actor, null);},
    'auth.logout':function(){return wd_logout(actor);},
    'auth.password':function(){return wd_authPassword(actor,r);},
    'portfolio.read':function(){return wd_readOwn(actor);},
    'portfolio.save':function(){return wd_saveOwn(actor,r);},
    'share.list':function(){return wd_shareList(actor);},
    'share.invite':function(){return wd_shareInvite(actor,r);},
    'share.respond':function(){return wd_shareRespond(actor,r);},
    'share.update':function(){return wd_shareUpdate(actor,r);},
    'share.revoke':function(){return wd_shareRevoke(actor,r);},
    'share.read':function(){return wd_shareRead(actor,r);}
  };
  if (!Object.prototype.hasOwnProperty.call(handlers,r.action)) wd_fail('NOT_FOUND','未知的 API 操作');
  return handlers[r.action]();
}
function wd_props() {return PropertiesService.getScriptProperties();}
function wd_secret() {
  var s=wd_props().getProperty('APP_SECRET');
  if(!s || s.length<32) wd_fail('SETUP_REQUIRED','GAS 尚未完成 APP_SECRET 設定');
  return s;
}
function wd_book() {
  var id=wd_props().getProperty('SPREADSHEET_ID');
  if (!id) wd_fail('SETUP_REQUIRED','GAS 尚未執行 setupWealthDesk');
  return SpreadsheetApp.openById(id);
}
function wd_sheet(name) {
  var s=wd_book().getSheetByName(name);
  if(!s) wd_fail('SETUP_REQUIRED','Google Sheets 缺少 '+name);
  return s;
}
function wd_rows(name) {
  var s=wd_sheet(name),count=s.getLastRow();
  if(count<2) return [];
  var headers=WD_TABLES[name],values=s.getRange(2,1,count-1,headers.length).getDisplayValues();
  return values.map(function(row,i){var obj={_row:i+2};headers.forEach(function(k,j){obj[k]=row[j];});return obj;});
}
function wd_put(name, obj, rowIndex) {
  var sheet=wd_sheet(name),headers=WD_TABLES[name],row=headers.map(function(k){
    var v=obj[k];return v==null?'':String(v);
  });
  var rowNo=rowIndex || sheet.getLastRow()+1;
  var range=sheet.getRange(rowNo,1,1,headers.length);
  range.setNumberFormat('@'); // IDs, dates, opaque hashes and JSON chunks are text.
  range.setValues([row]);
  return rowNo;
}
function wd_patch(name, entry, fields) {
  if(!entry) wd_fail('NOT_FOUND','資料不存在');
  return wd_put(name,Object.assign({},entry,fields),entry._row);
}
function wd_find(name,key,value) {return wd_rows(name).find(function(r){return String(r[key])===String(value);})||null;}
function wd_lock(fn) {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(25000)) wd_fail('BUSY','其他操作正在執行，請稍後重試');
  try {return fn();} finally {lock.releaseLock();}
}
function wd_hex(bytes) {return bytes.map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');}
function wd_sha(s) {return wd_hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8));}
function wd_hmac(s) {return wd_hex(Utilities.computeHmacSha256Signature(s,wd_secret(),Utilities.Charset.UTF_8));}
function wd_equal(a,b) {
  a=String(a||'');b=String(b||'');var n=Math.max(a.length,b.length),diff=a.length^b.length;
  for(var i=0;i<n;i++) diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return diff===0;
}
function wd_now() {return new Date().toISOString();}
function wd_today() {return Utilities.formatDate(new Date(),'Asia/Taipei','yyyy-MM-dd');}
function wd_id() {return Utilities.getUuid();}
function wd_email(x) {return String(x||'').trim().toLowerCase();}
function wd_emailOk(x) {return x.length<=140&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);}
function wd_saltOk(x) {return /^[A-Za-z0-9_-]{20,32}$/.test(String(x||''));}
function wd_proofOk(x) {return /^[0-9a-f]{64}$/.test(String(x||''));}
function wd_publicUser(u) {return {id:u.id,name:u.name,email:u.email,createdAt:u.createdAt};}
function wd_registered(email) {return wd_find('Users','email',email);}
function wd_passwordVerifier(salt,proof) {return wd_hmac('password:v1|'+salt+'|'+proof);}
function wd_issueSession(userId) {
  var now=Date.now(),raw=wd_hmac('token:v1|'+userId+'|'+wd_id()+'|'+wd_id()+'|'+wd_id()+'|'+now);
  wd_put('Sessions',{id:wd_id(),userId:userId,tokenHash:wd_hmac('session:v1|'+raw),createdAt:new Date(now).toISOString(),lastSeenAt:new Date(now).toISOString(),expiresAt:new Date(now+WD_ABSOLUTE_MS).toISOString(),revokedAt:''});
  return raw;
}
function wd_requireSession(token) {
  if(!/^[0-9a-f]{64}$/.test(String(token||''))) wd_fail('UNAUTHORIZED','登入已失效，請重新登入');
  var hash=wd_hmac('session:v1|'+token);
  var session=wd_find('Sessions','tokenHash',hash);
  if(!session || session.revokedAt) wd_fail('UNAUTHORIZED','登入已失效，請重新登入');
  var now=Date.now();
  if(Date.parse(session.expiresAt)<=now || Date.parse(session.lastSeenAt)+WD_IDLE_MS<=now) wd_fail('UNAUTHORIZED','Session 已逾期，請重新登入');
  var user=wd_find('Users','id',session.userId);
  if(!user || user.status!=='active') wd_fail('UNAUTHORIZED','帳號尚未通過驗證或已停用');
  if(now-Date.parse(session.lastSeenAt)>120000) wd_patch('Sessions',session,{lastSeenAt:new Date(now).toISOString()});
  return {user:user,session:session};
}
function wd_revokeSessions(userId) {
  wd_rows('Sessions').forEach(function(s){if(s.userId===userId&&!s.revokedAt)wd_patch('Sessions',s,{revokedAt:wd_now()});});
}
function wd_authPayload(actor, token) {
  var portfolio=wd_readOwn(actor);
  return {user:wd_publicUser(actor.user),token:token||null,portfolio:portfolio.data,revision:portfolio.revision};
}
function wd_rate(key,limit,seconds) {
  var cache=CacheService.getScriptCache(),cacheKey='wd:'+wd_sha(key).slice(0,50);
  var amount=Number(cache.get(cacheKey)||0);
  if(amount>=limit) wd_fail('RATE_LIMIT','操作過於頻繁，請稍後再試');
  cache.put(cacheKey,String(amount+1),seconds);
}
function wd_authSalt(r) {
  var email=wd_email(r.email);
  if(!wd_emailOk(email)) wd_fail('VALIDATION','Email 格式不正確');
  wd_rate('salt:'+email,30,600);
  var found=wd_registered(email);
  // Use a stable unknown-account salt, without revealing whether the account exists.
  return {salt:found ? found.salt : Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('unknown:'+email,wd_secret())).replace(/=+$/,'').slice(0,22),iterations:WD_PROOF_ITERATIONS};
}
function wd_authRegister(r) {
  var email=wd_email(r.email),name=String(r.name||'').trim(),salt=String(r.salt||''),proof=String(r.proof||'');
  if(wd_props().getProperty('ALLOW_REGISTRATION')==='false') wd_fail('FORBIDDEN','目前未開放新帳號註冊');
  if(!wd_emailOk(email)||name.length<2||name.length>36||/[<>\x00-\x1f]/.test(name)||!wd_saltOk(salt)||!wd_proofOk(proof)) wd_fail('VALIDATION','註冊資訊格式不正確');
  wd_rate('signup:'+email,3,3600);
  var created=wd_lock(function(){
    if(wd_registered(email)) wd_fail('CONFLICT','此 Email 已註冊，請登入或使用重設密碼');
    var time=wd_now();
    wd_put('Users',{id:wd_id(),email:email,name:name,salt:salt,verifier:wd_passwordVerifier(salt,proof),status:'pending',failedLogins:0,lockedUntil:'',createdAt:time,updatedAt:time});
    return true;
  });
  if(created) wd_sendVerification(email,'verify');
  return {verificationRequired:true,email:email};
}
function wd_makeCode() {
  // 8-digit code. UUID-derived randomness is not a guaranteed CSPRNG;
  // the server secret HMAC hides predictable input. Rotate APP_SECRET if exposed.
  var h=wd_hmac('otp|'+wd_id()+'|'+wd_id()+'|'+Date.now());
  return String(parseInt(h.slice(0,12),16)%100000000).padStart(8,'0');
}
function wd_sendVerification(email,purpose) {
  wd_rate('mail:'+email+':'+purpose,5,3600);
  var code=wd_makeCode(),now=wd_now(),expires=new Date(Date.now()+10*60000).toISOString();
  wd_lock(function(){
    wd_rows('Verifications').filter(function(x){return x.email===email&&x.purpose===purpose&&!x.consumedAt;}).forEach(function(x){wd_patch('Verifications',x,{consumedAt:now});});
    wd_put('Verifications',{id:wd_id(),email:email,purpose:purpose,codeHash:wd_hmac('otp:'+purpose+'|'+email+'|'+code),createdAt:now,expiresAt:expires,attempts:0,consumedAt:''});
  });
  var title=purpose==='verify'?'WealthDesk 註冊信箱驗證碼':'WealthDesk 密碼重設驗證碼';
  MailApp.sendEmail({to:email,subject:title,body:'你的 WealthDesk 驗證碼：'+code+'\n\n10 分鐘內有效。若非本人操作，請忽略這封信。\n\n請勿轉寄驗證碼。'});
}
function wd_verifyCode(email,purpose,code) {
  if(!/^\d{8}$/.test(String(code||''))) wd_fail('VALIDATION','請輸入 8 位數驗證碼');
  var record=wd_rows('Verifications').filter(function(x){return x.email===email&&x.purpose===purpose&&!x.consumedAt;}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);})[0];
  if(!record||Date.parse(record.expiresAt)<Date.now()) wd_fail('EXPIRED','驗證碼已到期，請重新寄送');
  if(Number(record.attempts)>=5) wd_fail('RATE_LIMIT','驗證碼嘗試次數過多，請重新寄送');
  wd_patch('Verifications',record,{attempts:String(Number(record.attempts)+1)});
  if(!wd_equal(record.codeHash,wd_hmac('otp:'+purpose+'|'+email+'|'+code))) wd_fail('VALIDATION','驗證碼不正確');
  wd_patch('Verifications',record,{consumedAt:wd_now(),attempts:String(Number(record.attempts)+1)});
}
function wd_authVerify(r) {
  var email=wd_email(r.email);
  wd_rate('verify:'+email,15,600);
  return wd_lock(function(){
    var user=wd_registered(email);
    if(!user||user.status!=='pending') wd_fail('VALIDATION','此帳號不需要驗證或尚未註冊');
    wd_verifyCode(email,'verify',r.code);
    wd_patch('Users',user,{status:'active',updatedAt:wd_now()});
    var token=wd_issueSession(user.id);
    return wd_authPayload({user:Object.assign({},user,{status:'active'})},token);
  });
}
function wd_authResend(r) {
  var email=wd_email(r.email),u=wd_registered(email);
  if(u&&u.status==='pending') wd_sendVerification(email,'verify');
  return {sent:true};
}
function wd_authLogin(r) {
  var email=wd_email(r.email),proof=String(r.proof||'');
  if(!wd_emailOk(email)||!wd_proofOk(proof)) wd_fail('VALIDATION','帳號或密碼不正確');
  wd_rate('login:'+email,25,600);
  return wd_lock(function(){
    var u=wd_registered(email),now=Date.now();
    if(!u) wd_fail('UNAUTHORIZED','帳號或密碼不正確');
    if(u.lockedUntil&&Date.parse(u.lockedUntil)>now) wd_fail('RATE_LIMIT','登入失敗次數過多，請稍後重試');
    if(!wd_equal(u.verifier,wd_passwordVerifier(u.salt,proof))){
      var attempts=Number(u.failedLogins||0)+1;
      wd_patch('Users',u,{failedLogins:attempts>=5?'0':String(attempts),lockedUntil:attempts>=5?new Date(now+15*60000).toISOString():''});
      wd_fail('UNAUTHORIZED','帳號或密碼不正確');
    }
    if(u.status==='pending') wd_fail('VERIFY_REQUIRED','請先完成 Email 驗證');
    if(u.status!=='active') wd_fail('FORBIDDEN','帳號已停用');
    wd_patch('Users',u,{failedLogins:0,lockedUntil:''});
    var token=wd_issueSession(u.id);
    return wd_authPayload({user:u},token);
  });
}
function wd_authResetRequest(r) {
  var email=wd_email(r.email);
  if(!wd_emailOk(email)) wd_fail('VALIDATION','Email 格式不正確');
  wd_rate('reset:'+email,4,3600);
  var u=wd_registered(email);
  if(u&&u.status==='active') wd_sendVerification(email,'reset');
  return {sent:true}; // Never reveal whether an account exists.
}
function wd_authResetComplete(r) {
  var email=wd_email(r.email),salt=String(r.salt||''),proof=String(r.proof||'');
  if(!wd_emailOk(email)||!wd_saltOk(salt)||!wd_proofOk(proof)) wd_fail('VALIDATION','新密碼格式不正確');
  wd_rate('reset-code:'+email,10,600);
  return wd_lock(function(){
    var u=wd_registered(email);
    if(!u||u.status!=='active') wd_fail('VALIDATION','無法重設密碼');
    wd_verifyCode(email,'reset',r.code);
    wd_patch('Users',u,{salt:salt,verifier:wd_passwordVerifier(salt,proof),failedLogins:0,lockedUntil:'',updatedAt:wd_now()});
    wd_revokeSessions(u.id);
    wd_audit(u.id,'password_reset',u.id);
    return {changed:true};
  });
}
function wd_authPassword(actor,r) {
  var proof=String(r.currentProof||''),salt=String(r.newSalt||''),newProof=String(r.newProof||'');
  if(!wd_proofOk(proof)||!wd_saltOk(salt)||!wd_proofOk(newProof)) wd_fail('VALIDATION','密碼格式不正確');
  return wd_lock(function(){
    var u=wd_registered(actor.user.email);
    if(!wd_equal(u.verifier,wd_passwordVerifier(u.salt,proof))) wd_fail('UNAUTHORIZED','目前密碼不正確');
    wd_patch('Users',u,{salt:salt,verifier:wd_passwordVerifier(salt,newProof),updatedAt:wd_now()});
    wd_revokeSessions(u.id);
    wd_audit(u.id,'password_changed',u.id);
    return {changed:true};
  });
}
function wd_logout(actor) {
  wd_lock(function(){wd_patch('Sessions',actor.session,{revokedAt:wd_now()});});
  return {loggedOut:true};
}
function wd_blank() {
  return {meta:{appName:'WealthDesk',asOf:wd_today(),baseCurrency:'TWD',analyticsVersion:6,note:'這是你在雲端的私人資產資料。'},fxRates:{TWD:1,USD:31.6,JPY:0.218},bankAccounts:[],assets:[],transactions:[],holdings:[],history:[],activity:[],cashFlows:[],liabilities:[],goals:[],performanceEvents:[]};
}
function wd_readOwn(actor) {return wd_readPortfolio(actor.user.id);}
function wd_readPortfolio(userId) {
  var meta=wd_find('Portfolios','userId',userId);
  if(!meta) return {revision:0,data:wd_blank()};
  var pieces=wd_rows('PortfolioChunks').filter(function(x){return x.userId===userId&&Number(x.revision)===Number(meta.revision);}).sort(function(a,b){return Number(a.part)-Number(b.part);});
  if(pieces.length!==Number(meta.partCount)) wd_fail('CORRUPTED','資產儲存分段缺漏，請聯繫管理員從備份復原');
  var encoded=pieces.map(function(p){return String(p.content||'').replace(/^b:/,'');}).join('');
  var json=Utilities.newBlob(Utilities.base64DecodeWebSafe(encoded)).getDataAsString('UTF-8');
  if(!wd_equal(wd_sha(json),meta.checksum)) wd_fail('CORRUPTED','資產資料校驗失敗，請聯繫管理員');
  return {revision:Number(meta.revision),data:JSON.parse(json)};
}
function wd_validatePortfolio(candidate) {
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)) wd_fail('VALIDATION','資產 JSON 格式不正確');
  var fields=['bankAccounts','holdings','history','activity','assets','transactions','cashFlows','liabilities','goals','performanceEvents'];
  fields.forEach(function(f){if(!Array.isArray(candidate[f])||candidate[f].length>12000)wd_fail('VALIDATION',f+' 資料格式或筆數無效');});
  if(!candidate.fxRates||typeof candidate.fxRates!=='object') wd_fail('VALIDATION','缺少匯率資料');
  ['USD','JPY'].forEach(function(c){if(!(Number(candidate.fxRates[c])>0)||!Number.isFinite(Number(candidate.fxRates[c]))) wd_fail('VALIDATION','匯率不正確');});
  fields.filter(function(f){return f!=='history';}).forEach(function(f){
    var seen={};candidate[f].forEach(function(item){
      if(!item||typeof item!=='object'||!String(item.id||'').trim()||String(item.id).length>150) wd_fail('VALIDATION',f+' 的資料識別碼不正確');
      if(seen[item.id]) wd_fail('VALIDATION',f+' 有重複識別碼');seen[item.id]=true;
    });
  });
  var ids={};candidate.bankAccounts.forEach(function(b){
    if(!b.bank||!b.accountName||!['TWD','USD','JPY'].includes(b.currency)||!Number.isFinite(Number(b.balance))||Number(b.balance)<0||/[<>]/.test(String(b.bank)+String(b.accountName)))wd_fail('VALIDATION','銀行資料不正確');ids[b.id]=b;
  });
  candidate.assets.forEach(function(a){
    if(!a.symbol||!a.name||!['tw_stock','us_stock','fund'].includes(a.type)||!['TWD','USD','JPY'].includes(a.currency)||!Number.isFinite(Number(a.currentPrice))||Number(a.currentPrice)<0||/[<>]/.test(String(a.name)+String(a.symbol)+String(a.broker||'')))wd_fail('VALIDATION','投資標的資料不正確');
  });
  candidate.cashFlows.forEach(function(f){
    if(!['income','expense'].includes(f.kind)||!(Number(f.amount)>0)||!['TWD','USD','JPY'].includes(f.currency)||f.bankId&&!ids[f.bankId])wd_fail('VALIDATION','現金流資料不正確');
  });
  candidate.liabilities.forEach(function(d){if(!Number.isFinite(Number(d.balance))||Number(d.balance)<0)wd_fail('VALIDATION','負債資料不正確');});
  candidate.goals.forEach(function(g){if(!Number.isFinite(Number(g.targetTwd))||Number(g.targetTwd)<0)wd_fail('VALIDATION','目標資料不正確');});
  candidate.meta=Object.assign({},candidate.meta||{},{asOf:wd_today(),baseCurrency:'TWD'});
  candidate.fxRates.TWD=1;
  // Validates chronological buys, sells, dividends, positions, FX and bank links.
  try {return WealthPro.migrate(candidate);} catch(err){wd_fail('VALIDATION',String(err.message||'交易流水資料不正確').slice(0,200));}
}
function wd_saveOwn(actor,r) {
  return wd_lock(function(){
    var meta=wd_find('Portfolios','userId',actor.user.id),current=meta?Number(meta.revision):0;
    if(!Number.isInteger(Number(r.revision))||Number(r.revision)!==current) wd_fail('CONFLICT','其他裝置已更新資產，請重新登入或重新載入後再編輯，避免覆蓋資料');
    var json=JSON.stringify(wd_validatePortfolio(r.data));
    if(json.length>WD_MAX_JSON) wd_fail('PAYLOAD_TOO_LARGE','資產資料超過 GAS 儲存上限，請先匯出備份');
    var rev=current+1,now=wd_now(),encoded=Utilities.base64EncodeWebSafe(json,Utilities.Charset.UTF_8),parts=[];
    for(var i=0;i<encoded.length;i+=WD_CHUNK_SIZE)parts.push(encoded.slice(i,i+WD_CHUNK_SIZE));
    parts.forEach(function(piece,index){wd_put('PortfolioChunks',{userId:actor.user.id,revision:rev,part:index,content:'b:'+piece,createdAt:now});});
    // Commit pointer last, after all immutable chunks have been written.
    wd_put('Portfolios',{userId:actor.user.id,revision:rev,partCount:parts.length,checksum:wd_sha(json),updatedAt:now},meta&&meta._row);
    wd_audit(actor.user.id,'portfolio_saved',String(rev));
    return {revision:rev,updatedAt:now};
  });
}
function wd_audit(actorId,action,targetId) {
  wd_put('AuditLogs',{id:wd_id(),actorId:actorId,action:action,targetId:targetId,at:wd_now()});
}
function wd_scope(scope) {
  if(!['summary','investments','full'].includes(String(scope))) wd_fail('VALIDATION','共享範圍不正確');
  return scope;
}
function wd_expiry(expires) {
  if(!expires) return '';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(expires))||Date.parse(expires+'T23:59:59+08:00')<Date.now()) wd_fail('VALIDATION','共享到期日不正確');
  return expires;
}
function wd_expired(g) {return !!(g.expiresAt&&Date.parse(g.expiresAt+'T23:59:59+08:00')<Date.now());}
function wd_grantPublic(g,users) {
  var owner=users.find(function(x){return x.id===g.ownerId;});
  var viewer=users.find(function(x){return x.id===g.viewerId;});
  var labels={summary:'僅資產總覽',investments:'投資及統計',full:'全部資產（唯讀）'};
  var statusLabels={pending:'等待接受',active:'共享中',declined:'已拒絕',revoked:'已撤銷'};
  var expired=wd_expired(g);
  return {id:g.id,ownerId:g.ownerId,viewerId:g.viewerId,scope:g.scope,scopeLabel:labels[g.scope],allowExport:g.allowExport==='true',expiresAt:g.expiresAt||null,status:g.status,createdAt:g.createdAt,updatedAt:g.updatedAt,lastSharedAt:g.updatedAt,expired:expired,statusLabel:expired?'已到期':statusLabels[g.status],ownerName:owner?owner.name:'已移除使用者',ownerEmail:owner?owner.email:'',viewerName:viewer?viewer.name:'已移除使用者',viewerEmail:viewer?viewer.email:''};
}
function wd_shareList(actor) {
  var me=actor.user.id,grants=wd_rows('ShareGrants'),users=wd_rows('Users');
  var incoming=grants.filter(function(x){return x.viewerId===me;}).map(function(g){return wd_grantPublic(g,users);}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);});
  var outgoing=grants.filter(function(x){return x.ownerId===me;}).map(function(g){return wd_grantPublic(g,users);}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);});
  var indexed={},events=wd_rows('AuditLogs').filter(function(e){return e.action.indexOf('share_')===0;}).reverse().filter(function(e){var g=grants.find(function(x){return x.id===e.targetId;});if(!g||!(g.ownerId===me||g.viewerId===me))return false;indexed[e.targetId]=g;return true;}).slice(0,14).map(function(e){var g=indexed[e.targetId],owner=users.find(function(x){return x.id===g.ownerId;}),viewer=users.find(function(x){return x.id===g.viewerId;});return {id:e.id,type:e.action.replace(/^share_/,''),grantId:g.id,actorId:e.actorId,ownerId:g.ownerId,at:e.at,owner:owner?owner.name:'擁有者',viewer:viewer?viewer.name:'受邀者'};});
  return {incoming:incoming,outgoing:outgoing,events:events};
}
function wd_shareInvite(actor,r) {
  return wd_lock(function(){
    var owner=actor.user,viewer=wd_registered(wd_email(r.email)),scope=wd_scope(r.scope),expires=wd_expiry(r.expiresAt);
    if(!viewer||viewer.status!=='active')wd_fail('NOT_FOUND','請對方先註冊並完成 Email 驗證');
    if(viewer.id===owner.id)wd_fail('VALIDATION','不能共享給自己');
    if(wd_rows('ShareGrants').some(function(g){return g.ownerId===owner.id&&g.viewerId===viewer.id&&['pending','active'].includes(g.status)&&!wd_expired(g);}))wd_fail('CONFLICT','此帳號已有有效邀請');
    var time=wd_now(),g={id:wd_id(),ownerId:owner.id,viewerId:viewer.id,scope:scope,allowExport:!!r.allowExport,expiresAt:expires,status:'pending',createdAt:time,updatedAt:time};
    wd_put('ShareGrants',g);wd_audit(owner.id,'share_invited',g.id);
    return wd_grantPublic(g,wd_rows('Users'));
  });
}
function wd_shareRespond(actor,r) {
  return wd_lock(function(){
    var g=wd_find('ShareGrants','id',String(r.grantId||''));
    if(!g||g.viewerId!==actor.user.id||g.status!=='pending'||wd_expired(g))wd_fail('FORBIDDEN','沒有此邀請的操作權限');
    var status=r.accept===true?'active':'declined';wd_patch('ShareGrants',g,{status:status,updatedAt:wd_now()});
    wd_audit(actor.user.id,'share_'+(status==='active'?'accepted':'declined'),g.id);
    return {changed:true};
  });
}
function wd_shareUpdate(actor,r) {
  return wd_lock(function(){
    var g=wd_find('ShareGrants','id',String(r.grantId||''));
    if(!g||g.ownerId!==actor.user.id||!['active','pending'].includes(g.status)||wd_expired(g))wd_fail('FORBIDDEN','沒有此共享權限');
    wd_patch('ShareGrants',g,{scope:wd_scope(r.scope),expiresAt:wd_expiry(r.expiresAt),allowExport:!!r.allowExport,updatedAt:wd_now()});
    wd_audit(actor.user.id,'share_updated',g.id);return {changed:true};
  });
}
function wd_shareRevoke(actor,r) {
  return wd_lock(function(){
    var g=wd_find('ShareGrants','id',String(r.grantId||''));
    if(!g||g.ownerId!==actor.user.id||!['active','pending'].includes(g.status))wd_fail('FORBIDDEN','沒有撤銷權限');
    wd_patch('ShareGrants',g,{status:'revoked',updatedAt:wd_now()});
    wd_audit(actor.user.id,'share_revoked',g.id);return {revoked:true};
  });
}
function wd_project(data,scope) {
  var d=WealthPro.migrate(data),analytics=WealthAnalytics.analyze(d),fx=function(c){return c==='TWD'?1:Number(d.fxRates[c]||1);};
  var cash=d.bankAccounts.reduce(function(s,b){return s+Number(b.balance)*fx(b.currency);},0);
  var positions=d.holdings.map(function(h){return Object.assign({},h,{marketTwd:Number(h.quantity)*Number(h.currentPrice)*fx(h.currency),costTwd:Number(h.costTwd)||0});});
  var invest=positions.reduce(function(s,x){return s+x.marketTwd;},0),cost=positions.reduce(function(s,x){return s+x.costTwd;},0);
  var groups={cash:cash,tw_stock:0,us_stock:0,fund:0},currencies={};
  d.bankAccounts.forEach(function(b){currencies[b.currency]=(currencies[b.currency]||0)+Number(b.balance)*fx(b.currency);});
  positions.forEach(function(h){groups[h.type]=(groups[h.type]||0)+h.marketTwd;currencies[h.currency]=(currencies[h.currency]||0)+h.marketTwd;});
  var result={schema:1,scope:scope,asOf:d.meta.asOf,rollup:{totalTwd:cash+invest,cashTwd:cash,investTwd:invest,costTwd:cost,pnlTwd:invest-cost,roiPct:cost?(invest-cost)/cost*100:0,groups:groups,currencies:currencies,bankCount:d.bankAccounts.length,holdingCount:positions.length},history:analytics.history,fxRates:d.fxRates,updatedAt:wd_now()};
  if(scope==='investments'||scope==='full'){
    result.holdings=d.holdings;
    result.performanceEvents=d.performanceEvents;
    var ledger=WealthPro.reconcile(d);
    result.ledgerOverview={realizedTwd:ledger.realizedTwd,dividendsTwd:ledger.dividendsTwd,feesTwd:ledger.feesTwd};
  }
  if(scope==='full'){
    result.bankAccounts=d.bankAccounts.map(function(b){return Object.assign({},b,{accountMasked:'•••• ••••'});});
    result.activity=d.activity;
  }
  return result;
}
function wd_shareRead(actor,r) {
  return wd_lock(function(){
  var id=String(r.grantId||''),g=wd_find('ShareGrants','id',id);
  if(!g||g.viewerId!==actor.user.id||g.status!=='active'||wd_expired(g))wd_fail('FORBIDDEN','沒有查看授權，或邀請已過期／撤銷');
  if(r.forExport===true&&g.allowExport!=='true')wd_fail('FORBIDDEN','對方不允許匯出');
  var current=wd_readPortfolio(g.ownerId),result=wd_project(current.data,g.scope);
  // Re-check after data processing; concurrent owner revoke must never leak a newly fetched snapshot.
  var check=wd_find('ShareGrants','id',id);
  if(!check||check.status!=='active'||wd_expired(check)||check.updatedAt!==g.updatedAt||check.viewerId!==actor.user.id)wd_fail('FORBIDDEN','共享授權已變更，請重新讀取');
  wd_audit(actor.user.id,'share_read',id);
  return {grant:wd_grantPublic(check,wd_rows('Users')),data:result};
  });
}

/** Optional administrator maintenance: run monthly from Apps Script editor.
 * Retains the 5 latest committed portfolio revisions per user (including current).
 * Does not delete Users, ShareGrants or AuditLogs.
 */
function maintenanceWealthDesk() {
  return wd_lock(function(){
    var latest={};wd_rows('Portfolios').forEach(function(p){latest[p.userId]=Number(p.revision);});
    var now=Date.now(),week=7*24*60*60*1000;
    var obsoleteChunks=wd_rows('PortfolioChunks').filter(function(r){
      var v=Number(r.revision),head=latest[r.userId];
      return !Number.isFinite(v)||head==null||v>head||v<=head-5;
    }).map(function(r){return r._row;});
    var oldSessions=wd_rows('Sessions').filter(function(r){
      return (r.revokedAt&&Date.parse(r.revokedAt)<now-week) || Date.parse(r.expiresAt)<now-week;
    }).map(function(r){return r._row;});
    var oldCodes=wd_rows('Verifications').filter(function(r){
      return (r.consumedAt&&Date.parse(r.consumedAt)<now-week) || Date.parse(r.expiresAt)<now-week;
    }).map(function(r){return r._row;});
    wd_deleteRowsByIndex('PortfolioChunks',obsoleteChunks);
    wd_deleteRowsByIndex('Sessions',oldSessions);
    wd_deleteRowsByIndex('Verifications',oldCodes);
    return {deletedPortfolioChunks:obsoleteChunks.length,deletedSessions:oldSessions.length,deletedVerifications:oldCodes.length};
  });
}
function wd_deleteRowsByIndex(name,indices) {
  if(!indices.length)return;
  var sheet=wd_sheet(name),rows=indices.sort(function(a,b){return b-a;});
  // Deleting bottom-up preserves the row indices reported before deletion.
  var end=rows[0],start=end;
  function flush(){sheet.deleteRows(start,end-start+1);}
  for(var i=1;i<rows.length;i++){
    if(rows[i]===start-1)start=rows[i];
    else {flush();start=end=rows[i];}
  }
  flush();
}
