# 工作管理平台(MVP)

類似 monday.com 的看板/表格工作管理工具。技術棧:Next.js 16 + TypeScript + PostgreSQL + Prisma。

## 開發環境需求

- Node.js(已安裝於本機:`C:\Program Files\nodejs`)
- PostgreSQL(已安裝於本機:`C:\Program Files\PostgreSQL\17`,service 名稱 `postgresql-x64-17`)
- 資料庫:`hrapp_db`,帳號 `hrapp` / 密碼 `hrapp_dev_pw`(僅本機開發用,見 `.env`)

## 啟動開發伺服器

```bash
npm run dev
```

開啟 http://localhost:3000,會自動導向 `/login`。

### 預設帳號

- Email: `admin@example.com`
- 密碼: `admin1234`

如需新增更多使用者,可修改 `prisma/seed.ts` 後執行 `npx prisma db seed`,或直接在
`npx prisma studio` 中新增(密碼需用 bcrypt hash)。

## 常用指令

```bash
npm run dev          # 開發伺服器
npm run build        # 正式建置
npm run lint         # ESLint 檢查
npm test             # 執行單元測試(Vitest)
npx prisma studio    # 圖形化檢視/編輯資料庫
npx prisma migrate dev --name <name>   # 修改 schema 後建立新的 migration
```

## 已完成功能(MVP)

- 帳密登入(session cookie,7 天過期)
- 看板清單:新增/重新命名/刪除
- 看板內分組(Group):新增/重新命名/刪除/拖曳排序
- 表格檢視:新增/刪除項目、Inline 編輯儲存格
- 欄位型別:文字、狀態(彩色標籤)、人員、日期、數字
- 看板(Kanban)檢視:依狀態欄位分組顯示,拖曳卡片可改變狀態
- 項目子項目(subitem):任一項目可新增子項目,支援多層巢狀、展開/收合,
  刪除父項目會連帶刪除子項目
- 從 Excel/CSV 匯入工作事項:表格右上角「匯入」按鈕開啟精靈,支援上傳
  .csv/.xlsx/.xls 檔案,或貼上公開分享的 Google Sheet 連結(需設定為「知道
  連結的使用者」可檢視,否則會顯示錯誤訊息並建議改用上傳檔案)。可選擇要
  匯入的工作表、標題列、以及每一欄要對應成「項目名稱」「階層層級(建立子
  項目)」「現有欄位」或「新增欄位」。狀態欄位若遇到未知的標籤文字會自動
  新增對應的彩色選項。
- 項目留言:每個項目列旁的留言圖示可開啟留言串,多人可在項目下討論
- 站內通知:側邊欄使用者名稱旁的鈴鐺圖示,會在以下情況通知相關人員(指派人員 +
  board 擁有者,不含自己觸發的變動,每 30 秒自動更新未讀數):
  - 人員欄位新增指派某人時,通知被指派的人
  - 項目的狀態/數字/文字等欄位有變動時,通知該項目所有已指派的人
  - 有人在項目下留言時,通知該項目所有已指派的人

## 尚未實作(下一階段)

- Board 層級的權限/分享設定(目前所有登入使用者可看/改所有看板)
- Email 通知(目前只有站內通知,需要 SMTP 設定才能加 Email)
- 自動化規則引擎
- 儀表板/報表(含團隊工作量/人力負載總覽)
- 正式部署用的 Docker Compose(內部伺服器部署時再補上)
