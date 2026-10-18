// 將 apiUrl 改成正式的 Google Apps Script Web App /exec URL。
// 這裡只能放公開設定，絕不能放 APP_SECRET 或管理員密碼。
window.WEALTHDESK_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycby0IHcxMYryb2ts58td2lwdlSTn0o68x3ZD8zxNnbR3hDn4p1p_nbJxxhuSQzjw-LqoYw/exec',
  timeoutMs: 30000
};
