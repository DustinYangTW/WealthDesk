# WealthDesk v6｜GitHub Pages + Google Apps Script + Google Sheets

以原始 WealthDesk v6 的 **HTML / CSS / JavaScript** 為基礎，將原本瀏覽器內的帳號、共享和資料儲存改成 GAS API。保留銀行、台美股、基金、交易流水、加權平均成本、績效、XIRR/TWR、收支、負債、財務目標、資產共享與 A/B 比較等既有介面及計算。

**狀態：程式與自動化模擬測試已完成；尚未部署到你的 GitHub Pages / GAS，亦尚未通過真實 GAS 網站跨網域端對端測試。** 請先以測試帳號驗證，再投入正式金融資料。

## 1. 交付內容

```text
WealthDesk_v6_GitHubPages_GAS/
├── index.html                ← GitHub Pages 根頁面
├── frontend/
│   ├── css/                  ← 按用途拆分的頁面樣式
│   ├── js/                   ← 設定、API、登入、共享、UI 與計算引擎
│   ├── data/                 ← 參考 JSON；正式登入不自動灌入假資料
│   └── DEPLOY_FRONTEND.txt   ← 前端部署與目錄說明
├── gas/                      ← 複製檔案內容至你的 Apps Script 專案
│   ├── Backend.gs            ← Web App API、Session、權限、Sheets
│   ├── PortfolioEngine.gs    ← 原 v6 交易計算與驗證
│   ├── AnalyticsEngine.gs    ← 原 v6 分析計算
│   └── appsscript.json       ← GAS V8、時區及最少必要授權範圍
├── tests/
│   ├── test_gas.cjs          ← 模擬 GAS 資料儲存、跨帳號權限
│   ├── test_engine.cjs       ← 投資計算驗證
│   └── test_browser_gas.py  ← 模擬瀏覽器 UI（非正式 GAS）
└── README.md
```

> 靜態頁面不包含 GOOGLE 密鑰、`APP_SECRET`、資料庫存取密碼。`frontend/js/config.js` 的 GAS Web App URL 是公開 API 位址，不是密鑰。

## 2. 先部署 GAS 後端

1. 前往 <https://script.google.com/> 建立**新的獨立 Apps Script 專案**，命名為 `WealthDesk API`。
2. 在編輯器中建立 3 個程式碼檔案，名稱分別為 `PortfolioEngine`、`AnalyticsEngine`、`Backend`；完整貼上 `gas/` 中對應 `.gs` 的內容。檔案名稱只供編輯器辨識，這三個檔案屬於同一 GAS 專案，因此能互相存取函式。
3. 開啟「專案設定」，啟用**在編輯器中顯示 `appsscript.json` 資訊清單檔案**；以交付包 `gas/appsscript.json` 的內容取代原資訊清單。若不熟悉覆寫 manifest，可保留 Apps Script 自動偵測 OAuth 範圍，但請確認試算表與寄送郵件權限。
4. 同一個「專案設定 → 指令碼屬性」新增：

   | 屬性 | 值 | 用途 |
   |---|---|---|
   | `APP_SECRET` | **至少 32 個隨機字元**，建議 64 位十六進位亂數 | 密碼驗證值加密簽章、Session、OTP 的 HMAC 密鑰 |
   | `ALLOW_REGISTRATION` | `true` | 開放帳號註冊（預設也開放）。日後可設 `false` 關閉新註冊 |
   | `SPREADSHEET_ID` | **不需要先設** | 初始化函式會建立資料庫並自動填入 |

   `APP_SECRET` 可以使用可信的密碼管理工具生成 64 字元亂數，或在已安裝 OpenSSL 的電腦執行 `openssl rand -hex 32`。不要把此值寫進 JS、GitHub 或公開文件。
5. 從 GAS 編輯器上方函式選單選 `setupWealthDesk`，按**執行**，並使用你自己的 Google 帳號授權試算表存取及寄送 Email。第一次執行會建立私有 Google Spreadsheet，名稱為 `WealthDesk - Private Database`，並建立 7 張工作表。如果已設定 `SPREADSHEET_ID`，則使用該資料庫。請確認執行成功。
6. 點選「部署 → 新增部署作業 → 網頁應用程式」：
   - 執行身分：**我（部署者）**。
   - 誰可以存取：**任何人（Anyone）**。這只允許請求進入 API；私人資料仍由程式強制驗證 Session。
   - 複製正式 **`/exec`** 網址；不要使用開發測試用 `/dev` 網址。
7. 瀏覽器開啟 `https://script.google.com/macros/s/你的部署ID/exec`，應可看到 JSON，包含 `"status":"online"`。這只是健康檢查，不代表登入及前端呼叫都已正常。

**重要：** 修改 GAS `.gs` 後請**更新既有部署作業到新的版本**；只儲存 GAS 程式碼不一定會立即更新現有 `/exec` 網頁應用程式。

### GAS 工作表

| Sheet | 內容 |
|---|---|
| `Users` | Email、名稱、salt、HMAC 密碼驗證值、停用/鎖定狀態 |
| `Sessions` | Token HMAC、userId、發行/最後活動/到期時間、撤銷時間 |
| `Verifications` | 信箱驗證及重設密碼的一次性驗證碼雜湊與失效時間 |
| `Portfolios` | 使用者的最新資產修訂版本、校驗碼、分段數 |
| `PortfolioChunks` | 資產 JSON 經 Base64 編碼後分段儲存，避免單一儲存格超限 |
| `ShareGrants` | 資料擁有者、受邀者、共享範圍、匯出權限、到期/撤銷 |
| `AuditLogs` | 關鍵寫入及共享事件稽核 |

**資料庫採「每個使用者一份完整資產 JSON 快照 + 修訂版號」**，不是銀行、股票、交易一筆一列的全正規化資料庫。此選擇可以忠實保留 v6 既有資料格式，快速完成 GitHub Pages ↔ GAS 整合；如未來需數十萬筆交易或多人同時編輯同帳號，應升級資料模型/資料庫。

## 3. 再部署 GitHub Pages 前端

1. 以文字編輯器開啟 `frontend/js/config.js`。
2. 設定 `apiUrl`，例如：

   ```js
   window.WEALTHDESK_CONFIG = {
     apiUrl: 'https://script.google.com/macros/s/你的部署ID/exec',
     timeoutMs: 30000
   };
   ```

3. 將專案根目錄的 `index.html` 與整個 `frontend/` 資料夾一起提交到 GitHub repository 根目錄；不要只上傳 `frontend/` 裡面的檔案，因為頁面會從 `frontend/css/` 和 `frontend/js/` 載入資源。
4. GitHub repository → Settings → Pages → Build and deployment：選 `Deploy from a branch`，Branch `main`、Folder `/(root)`；或選擇自己的 Pages 既有部署流程。若使用自訂發布流程，需保留 `index.html` 與 `frontend/` 的相對目錄結構。
5. 開啟 `https://你的帳號.github.io/你的repo/`；登入頁應出現「登入 / 註冊」，不會自動灌入示範帳號或假資產。
6. 註冊測試 Email（建議先建立 A、B 兩個信箱），到信箱收取 8 位數驗證碼，驗證並登入。
7. 在 A 建立一個銀行帳戶/投資項目，重新整理頁面確認資料仍在；B 註冊後，由 A 寄送共享邀請給 B，B 接受後可查看並比較，但不可修改 A 的資料。

**既有 v6 資料移轉**：先在舊 v6 系統「匯出完整 JSON」，再於新版「資料與設定 → 匯入 JSON」上傳。原本由舊版 `localStorage` AES-GCM 加密的資料無法直接被 GAS 自動讀取或解密；務必透過舊系統匯出明文 JSON 後再匯入新帳號。`frontend/data/mock-data.json` 只供示範和測試使用，不會自動載入到真實使用者。

## 4. 功能、權限和 Session

| 使用情境 | 動作 | GAS 處理 |
|---|---|---|
| 註冊 | Email、顯示名稱、密碼 | 建立待驗證帳號，寄送 8 位數一次性驗證碼 |
| 驗證 Email | 輸入驗證碼 | 驗證碼 10 分鐘有效、單碼嘗試次數限制；啟用帳號 |
| 登入 | Email + 密碼 | 前端 WebCrypto PBKDF2 衍生 32-byte password proof；GAS 用 APP_SECRET HMAC 比對，發出 Session |
| 保持登入 | 每次 API 攜帶 Session Token | GAS 從 Session 查出 userId，檢查使用者與逾時、撤銷；不得由前端自行指定帳號 |
| 儲存資產 | 更新銀行、交易、收支、匯率等 | GAS 驗證 Session，只寫入本人 portfolio；版本不同則拒絕，避免跨裝置覆蓋 |
| 共享邀請 | 指定另一位已註冊 Email | 由擁有者建立邀請、受邀者接受；單向唯讀 |
| 查看共享 | 三種權限：摘要 / 投資 / 完整 | GAS 再次檢查讀取者與授權，伺服器過濾可見資料 |
| 撤銷共享 | 擁有者取消 | 後續 API 讀取拒絕；無法撤回已下載或截圖的資料 |
| 改密碼 / 重設 | 原密碼或 Email OTP | 所有既有 Session 撤銷 |
| 登出 | Session 撤銷 | 伺服器端失效；前端清除當前分頁 Session |

Session：**閒置 30 分鐘到期、絕對有效時間 8 小時、允許多裝置登入**。前端只把 Session Token 存在瀏覽器 `sessionStorage`（同一分頁重整仍可恢復），不把密碼或 `APP_SECRET` 存到網頁。

> 前端的 PBKDF2 輸出屬於**密碼等價憑證**，知道該輸出仍可能登入，因此必須永遠透過 HTTPS 傳輸，不應視為零知識密碼協定。密碼驗證已做 PBKDF2 加鹽與伺服器 HMAC，但尚未經過正式安全稽核。

## 5. API 規格

所有正式操作透過 GAS `/exec` 的 `POST`，本文使用 `text/plain;charset=UTF-8` 包住 JSON，避免一般 `application/json` 引起 CORS preflight；**避開 preflight 不代表保證 CORS 一定成功**。GAS 的 Content Service 還會重新導向到 Google 的 `googleusercontent.com`；請以你自己的 Pages 網址驗證瀏覽器實際接收結果。

範例請求（僅格式示意，前端已自動執行）：

```json
{"action":"auth.salt","email":"alice@example.com"}
```

成功格式：

```json
{"ok":true,"data":{"salt":"...","iterations":310000}}
```

錯誤格式：

```json
{"ok":false,"error":{"code":"UNAUTHORIZED","message":"登入已失效，請重新登入"}}
```

需要登入的請求會包含 `token`；例如 `{"action":"portfolio.save","token":"...","revision":1,"data":{...}}`。GAS Content Service 無法像一般框架自由指定 HTTP 狀態碼，**請依回應中的 `ok` / `error.code` 判斷成功失敗**。

路由：

```text
auth.salt         auth.register       auth.verify
auth.resend       auth.login          auth.me
auth.logout       auth.password       auth.reset.request
auth.reset.complete
portfolio.read    portfolio.save
share.list        share.invite        share.respond
share.update      share.revoke        share.read
```

## 6. 驗收測試（尚未連到你的真實 GAS）

在有 Node.js 的電腦，從交付包根目錄執行：

```bash
node tests/test_gas.cjs
node tests/test_engine.cjs
```

`tests/test_gas.cjs` 使用模擬 Google Sheets / MailApp / LockService 執行真實 `gas/*.gs` 邏輯：註冊/驗證、Token 有效性、不同帳號資料隔離、版本衝突、共享範圍與撤銷、偽造 userId、重設密碼與登出。`tests/test_engine.cjs` 驗證平均成本、交易、銀行連動、TWR/XIRR 等原版計算。

可選：已安裝 Playwright 及 Chromium 的環境，可執行 `python tests/test_browser_gas.py`。此測試使用模擬 API 顯示原有桌面、手機畫面，**不能代替實際 GitHub Pages → GAS 的瀏覽器端對端連線測試**。

建議上線前人工逐項驗收：新註冊、OTP 郵件、正常/錯誤登入、修改密碼及舊 Session 失效、跨裝置資料保存、交易買賣/回沖、A/B 邀請及拒絕、三種共享權限、撤銷及到期、多裝置同時修改衝突、斷網時的資料匯出備份。

## 7. 保養、備份、安全限制

- **重要：先使用測試資料。** 這是首次改造的自訂認證系統，未進行正式安全滲透測試、對真實 Google Apps Script 寄信/配額與跨網域行為的驗收。
- **試算表不是端對端加密**：Google Spreadsheet 及部署者帳號可讀到資產資料；請勿把整張表格分享給一般使用者。公開 GitHub Pages 網頁不能存放 API 管理密鑰或金融機構登入憑證。
- **資料為手動維護**：不會自動同步真實銀行或券商資訊，也不會自動取得正式市場報價。投資計算結果取決於你填寫的交易、價格與匯率。
- **GAS 有服務配額限制**：使用 Google Sheets / MailApp、短時間大量註冊、儲存過大的 JSON，都會受到執行時間和配額影響。GAS API 目前限制單份資產序列化 JSON 約 140 萬字元；一般個人使用應足夠，但大規模資料庫不適合此架構。
- **定期備份**：建議每週使用「資料與設定 → 匯出 JSON」，並利用 Google Sheets 版本記錄 / Google Drive 複製整份試算表。JSON 本身含金融隱私，請加密保存。
- **維護分段紀錄**：在 GAS 編輯器手動執行 `maintenanceWealthDesk()`，可清除每位使用者超過最新五個已提交版本的舊分段，以及超過 7 天的過期 Session/驗證碼。首次操作前先複製試算表備份；此函式不刪 Users、ShareGrants 或 AuditLogs。
- **並行寫入**：單次快照保存用 `LockService` + 修訂版號 + 最後提交 pointer 降低覆蓋風險；Google Sheets 不是完整交易型資料庫，服務中斷、配額和人工修改仍可能造成不一致。
- **傳輸安全**：嚴禁使用 `fetch(..., {mode:'no-cors'})` 冒充解決 CORS，它會阻止前端取得 JSON。也不要改用 JSONP 傳輸私人資料或憑證。
- **前端安全**：限制 JavaScript 來源的 CSP 已配置，Session 儲存在 `sessionStorage`，但在受 XSS 影響的頁面，資料與 Token 仍有外洩風險；必須持續保持依賴、安全性及程式碼審查。

## 8. 變更與可擴充方向

本版優先保持原 UI 與原計算引擎，已取消原 `auth.js` 的本機 AES 帳號與原 `sharing.js` 的單機加密快照。**跨帳號權限改由 GAS 控管**。保存採完整 portfolio JSON 以便最快交付與支援舊資料匯入。未來若需大量併發、極高資料量、正式高敏感資料保護或銀行直連，需另行評估經審查的身份服務、伺服器資料庫、密鑰管理及稽核需求。
