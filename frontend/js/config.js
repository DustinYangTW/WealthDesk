// 將 apiUrl 改成正式的 Google Apps Script Web App /exec URL。
// 這裡只能放公開設定，絕不能放 APP_SECRET 或管理員密碼。
window.WEALTHDESK_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbx59YKD9MGPHWbVdVMuV9D1Z6kogw8AWvfvDKzOT-j9F_SFYv1rTANorzVUDOvyDCGitQ/exec',
  timeoutMs: 30000
};
