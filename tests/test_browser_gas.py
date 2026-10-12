"""Browser UI smoke test using inlined assets, simulated crypto and simulated GAS.
This checks the interface; tests/test_gas.cjs separately exercises the actual service logic.
"""
from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out_dir=Path(__file__).resolve().parent/'_screenshots'
out_dir.mkdir(exist_ok=True)
source=(root/'index.html').read_text(encoding='utf-8')
# The CSP is kept in deployed HTML; inline mock assets require disabling CSP only here.
source=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',source)
source=re.sub(r'<link rel="stylesheet" href="([\w/-]+\.css)"\s*/>',lambda m:'<style>\n'+(root/m.group(1)).read_text(encoding='utf-8')+'\n</style>',source)
source=re.sub(r'<script src="([\w/-]+\.js)"></script>',lambda m:'<script>\n'+("window.WEALTHDESK_CONFIG={apiUrl:'https://script.google.com/macros/s/mocktest/exec',timeoutMs:30000};" if m.group(1).endswith('/config.js') else (root/m.group(1)).read_text(encoding='utf-8').replace('</script','<\\/script'))+'\n</script>',source)
users={'id':'user-A','name':'測試帳號','email':'alpha@example.com','createdAt':'2026-10-10T00:00:00Z'}
seed=json.loads((root/'frontend/data/mock-data.json').read_text(encoding='utf-8'))
mock_script=r'''
<script>
// Test-only crypto shim for opaque about:blank. Never include in the deliverable HTML.
Object.defineProperty(window,'crypto',{configurable:true,value:{
  getRandomValues(arr){for(let i=0;i<arr.length;i++)arr[i]=(i*41+13)%256;return arr},
  subtle:{async importKey(){return {}},async deriveBits(){return new Uint8Array(32).fill(24).buffer}}
}});
window.WEALTHDESK_CONFIG={apiUrl:'https://script.google.com/macros/s/mocktest/exec',timeoutMs:30000};
let testRevision=1,sharedTest=[];
window.fetch=async(_url,init)=>{
  let r=JSON.parse(init.body),data=null;
  const user=TEST_USER,portfolio=TEST_DATA;
  if(r.action==='auth.salt') data={salt:'MDEyMzQ1Njc4OWFiY2RlZg',iterations:310000};
  else if(r.action==='auth.login')data={user,token:'a'.repeat(64),portfolio,revision:testRevision};
  else if(r.action==='auth.me')data={user,portfolio,revision:testRevision};
  else if(r.action==='share.list')data={incoming:[],outgoing:sharedTest,events:[]};
  else if(r.action==='share.invite'){
    const g={id:'grant1',ownerId:user.id,ownerName:user.name,viewerName:'帳號 B',viewerEmail:r.email,
      scope:r.scope,scopeLabel:'全部資產（唯讀）',allowExport:false,expiresAt:null,status:'pending',statusLabel:'等待接受',
      createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z',lastSharedAt:'2026-10-10T00:00:00Z',expired:false};
    sharedTest.push(g);data=g;
  }
  else if(r.action==='portfolio.save')data={revision:++testRevision};
  else data={};
  return {ok:true,json:async()=>({ok:true,data})};
};
</script>
'''
mock_script=mock_script.replace('TEST_USER',json.dumps(users,ensure_ascii=False)).replace('TEST_DATA',json.dumps(seed,ensure_ascii=False,separators=(',',':')))
source=source.replace('<body>', '<body>'+mock_script,1)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 desktop=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 issues=[]
 desktop.on('pageerror',lambda e:issues.append(str(e)))
 desktop.set_content(source,wait_until='load')
 desktop.locator('#auth-email').fill('alpha@example.com')
 desktop.locator('#auth-password').fill('StrongPass123!')
 desktop.locator('#auth-submit').click()
 desktop.locator('#app-shell').wait_for(state='visible',timeout=15000)
 assert desktop.get_by_text('測試帳號的資產中心').count() >= 1
 desktop.screenshot(path=str(out_dir/'screenshot_desktop.png'),full_page=True)
 desktop.locator('[data-page="sharing"]').first.click()
 desktop.locator('#share-invite-email').fill('friend@example.com')
 desktop.locator('#share-invite-form button[type="submit"]').click()
 desktop.get_by_text('帳號 B').first.wait_for(timeout=15000)
 desktop.screenshot(path=str(out_dir/'screenshot_sharing.png'),full_page=True)
 desktop.locator('[data-page="settings"]').first.click()
 desktop.get_by_text('GAS 雲端帳號').wait_for(timeout=10000)
 assert not issues,issues
 mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 mobile.set_content(source,wait_until='load')
 mobile.locator('#auth-email').fill('alpha@example.com')
 mobile.locator('#auth-password').fill('StrongPass123!')
 mobile.locator('#auth-submit').click()
 mobile.locator('#app-shell').wait_for(state='visible',timeout=15000)
 mobile.screenshot(path=str(out_dir/'screenshot_mobile.png'),full_page=True)
 assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+4')
 print('PASS browser: dashboard, shared invite, settings, mobile viewport, no JavaScript errors')
 browser.close()
