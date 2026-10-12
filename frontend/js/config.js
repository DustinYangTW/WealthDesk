// 將 apiUrl 改成正式的 Google Apps Script Web App /exec URL。
// 這裡只能放公開設定，絕不能放 APP_SECRET 或管理員密碼。
window.WEALTHDESK_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbxb5-AWbyMek2j6h09Zs7XPKHP0i5YYGErli0Uxc42686sR4jeilhpMO3GnPSgAyIG3SA/exec',
  timeoutMs: 30000
};
