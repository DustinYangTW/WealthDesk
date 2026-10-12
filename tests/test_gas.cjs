const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
const crypto=require('node:crypto');
const root=require('node:path').join(__dirname,'..');
const mails=[]; const properties=new Map([['APP_SECRET','e2e-test-very-long-random-key-123456789012345678']]);
const store=new Map(),cache=new Map();
class Sheet{
 constructor(name){this.name=name;this.cells=[];}
 getLastRow(){return this.cells.length;}
 deleteRows(start,count){this.cells.splice(start-1,count);}
 setFrozenRows(){}
 getRange(r,c,h,w){const target=this;return {
  setNumberFormat(){return this;},
  setValues(matrix){for(let i=0;i<h;i++){const row=target.cells[r-1+i]||[];for(let j=0;j<w;j++)row[c-1+j]=String(matrix[i][j]);target.cells[r-1+i]=row;}return this;},
  getDisplayValues(){return Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>String(target.cells[r-1+i]?.[c-1+j]??'')));}
 };}
}
class Book{
 constructor(id){this.id=id;this.sheets=new Map();}
 getId(){return this.id;}
 getSheetByName(n){return this.sheets.get(n)||null;}
 insertSheet(n){const s=new Sheet(n);this.sheets.set(n,s);return s;}
}
const mock={
 SpreadsheetApp:{create(name){const b=new Book('DB-ONE');store.set(b.id,b);return b;},openById(id){if(!store.has(id))throw Error('missing sheet');return store.get(id);}},
 PropertiesService:{getScriptProperties(){return {getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,String(v))};}},
 LockService:{getScriptLock(){return {tryLock(){return true;},releaseLock(){}};}},
 CacheService:{getScriptCache(){return {get:key=>cache.get(key)||null,put:(key,value)=>cache.set(key,value)};}},
 MailApp:{sendEmail:args=>mails.push(args)},
 Utilities:{
  getUuid:()=>crypto.randomUUID(),
  DigestAlgorithm:{SHA_256:'sha256'},
  Charset:{UTF_8:'utf8'},
  computeDigest:(_alg,str)=>[...crypto.createHash('sha256').update(str,'utf8').digest()],
  computeHmacSha256Signature:(str,key)=>[...crypto.createHmac('sha256',Buffer.from(key)).update(str).digest()],
  base64EncodeWebSafe:str=>Buffer.from(str,'utf8').toString('base64url'),
  base64DecodeWebSafe:str=>[...Buffer.from(str,'base64url')],
  newBlob:bytes=>({getDataAsString:()=>Buffer.from(bytes).toString('utf8')}),
  formatDate:()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})
 },
 ContentService:{MimeType:{JSON:'json'},createTextOutput(t){return {text:t,setMimeType(){return this;}};}},
 Logger:{log(){}},console,
};
const context=vm.createContext(mock);
for(const file of ['PortfolioEngine.gs','AnalyticsEngine.gs','Backend.gs']){
 vm.runInContext(fs.readFileSync(`${root}/gas/${file}`,'utf8'),context,{filename:file});
}
context.setupWealthDesk();
function request(action,fields={},token=''){
 const result=JSON.parse(context.doPost({postData:{contents:JSON.stringify({action,token,...fields})}}).text);
 return result;
}
function ok(action,fields={},token=''){
 const r=request(action,fields,token);assert.equal(r.ok,true,`${action}: ${JSON.stringify(r)}`);return r.data;
}
function denied(action,fields,token,code){const r=request(action,fields,token);assert.equal(r.ok,false,`${action} unexpectedly allowed`);if(code)assert.equal(r.error.code,code);}
const salt=Buffer.from('0123456789abcdef').toString('base64url');
const proof=crypto.pbkdf2Sync('StrongPass123!',Buffer.from(salt,'base64url'),310000,32,'sha256').toString('hex');
const userA='a@example.com',userB='b@example.com';
for(const [email,name] of [[userA,'測試 A'],[userB,'測試 B']]){
 ok('auth.register',{email,name,salt,proof});
 const code=mails.at(-1).body.match(/\d{8}/)[0];
 const verified=ok('auth.verify',{email,code});assert.ok(verified.token);
}
const A=ok('auth.login',{email:userA,proof}),B=ok('auth.login',{email:userB,proof});
assert.notEqual(A.user.id,B.user.id);
const loginTokenA=A.token,loginTokenB=B.token;
const sample=JSON.parse(fs.readFileSync(`${root}/frontend/data/mock-data.json`,'utf8'));
const saved=ok('portfolio.save',{revision:0,data:sample},loginTokenB);assert.equal(saved.revision,1);
const owned=ok('portfolio.read',{},loginTokenB);assert.equal(owned.data.holdings.length,11);assert.equal(owned.revision,1);
assert.equal(ok('portfolio.read',{},loginTokenA).data.bankAccounts.length,0);
denied('portfolio.save',{revision:0,data:sample},loginTokenB,'CONFLICT');
const listB=ok('share.invite',{email:userA,scope:'summary',allowExport:false},loginTokenB);
assert.equal(listB.status,'pending');
denied('share.read',{grantId:listB.id},loginTokenA,'FORBIDDEN');
denied('share.respond',{grantId:listB.id,accept:true},loginTokenB,'FORBIDDEN');
ok('share.respond',{grantId:listB.id,accept:true},loginTokenA);
let shared=ok('share.read',{grantId:listB.id},loginTokenA);
assert.ok(shared.data.rollup.totalTwd>0);
assert.equal('holdings' in shared.data,false);
assert.equal('bankAccounts' in shared.data,false);
denied('share.read',{grantId:listB.id,forExport:true},loginTokenA,'FORBIDDEN');
// Trying to save B assets from A with forged userId only updates A's own portfolio.
const forged=ok('portfolio.save',{revision:0,userId:B.user.id,data:sample},loginTokenA);
assert.equal(forged.revision,1);assert.equal(ok('portfolio.read',{},loginTokenB).revision,1);
denied('share.update',{grantId:listB.id,scope:'full'},loginTokenA,'FORBIDDEN');
ok('share.update',{grantId:listB.id,scope:'investments',allowExport:true},loginTokenB);
shared=ok('share.read',{grantId:listB.id},loginTokenA);
assert.equal(shared.data.holdings.length,11);
assert.equal('bankAccounts' in shared.data,false);
assert.equal(ok('share.read',{grantId:listB.id,forExport:true},loginTokenA).data.holdings.length,11);
ok('share.update',{grantId:listB.id,scope:'full',allowExport:true},loginTokenB);
shared=ok('share.read',{grantId:listB.id},loginTokenA);
assert.equal(shared.data.bankAccounts.length,5);
assert.ok(shared.data.bankAccounts.every(b=>b.accountMasked==='•••• ••••'));
ok('share.revoke',{grantId:listB.id},loginTokenB);
denied('share.read',{grantId:listB.id},loginTokenA,'FORBIDDEN');
const reset=ok('auth.reset.request',{email:userB});assert.equal(reset.sent,true);
const resetCode=mails.at(-1).body.match(/\d{8}/)[0];
const newSalt=Buffer.from('abcdefghijklmnop').toString('base64url');
const newProof=crypto.pbkdf2Sync('NewPass123!',Buffer.from(newSalt,'base64url'),310000,32,'sha256').toString('hex');
ok('auth.reset.complete',{email:userB,code:resetCode,salt:newSalt,proof:newProof});
denied('portfolio.read',{},loginTokenB,'UNAUTHORIZED');
const reopened=ok('auth.login',{email:userB,proof:newProof});assert.equal(reopened.user.id,B.user.id);
ok('auth.logout',{},reopened.token);
denied('portfolio.read',{},reopened.token,'UNAUTHORIZED');
const maintenance=context.maintenanceWealthDesk();
assert.ok(maintenance.deletedPortfolioChunks>=0);
assert.equal(ok('portfolio.read',{},loginTokenA).revision,1);
console.log('PASS GAS 40+ assertions: email verify, sessions, portfolio save/CAS, shared read scopes, revoke, forged owner, reset & logout');
