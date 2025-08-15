# gas-task-reminder-for-line

LINEでタスクリマインダー機能を提供するGoogle Apps Scriptライブラリです。

## 特徴
- LINEユーザーのタスク管理機能
- 指定した時間でのリマインダー通知
- シンプルで直感的なインターフェイス
- Googleスプレッドシートとの連携

## セットアップ
1. [src/Code.js](src/Code.js) の内容をGoogle Apps Scriptプロジェクトにコピー
2. LINE Messaging APIのアクセストークンを設定
3. Webhook URLを設定
4. 必要に応じてGoogleスプレッドシートを準備

## 使い方
1. LINEボットを友達追加
2. タスクを登録
3. リマインダー時間を設定
4. 指定時間にリマインダー通知を受信

## 使用例

### 基本的な使用例
```javascript
// スプレッドシートから期限をチェックしてLINE通知
function checkTaskDeadlines() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const targetSheets = [
    { name: 'プロジェクト管理', headerRow: 1 },
    { name: 'タスク一覧', headerRow: 1 },
    { name: 'スケジュール', headerRow: 1 },
    { name: 'ToDo', headerRow: 1 },
  ];
  
  TaskReminderForLINE.checkDeadlinesAndNotify(spreadsheetId, targetSheets);
}
```

### トリガー設定
Google Apps Scriptのエディタで以下の手順でトリガーを設定：
1. 左メニューの「トリガー」をクリック
2. 「トリガーを追加」をクリック
3. 実行する関数: `checkTaskDeadlines`
4. イベントのソース: 時間主導型
5. 時間ベースのトリガーのタイプ: 日タイマー
6. 時刻: 午前9時〜10時（任意の時間）

## 開発
- `./build.sh -d`: ビルドしてデプロイ
- `./build.sh -c`: サーバーとの差分比較
- `./build.sh -s`: サーバーからローカルに同期

## ライセンス
MIT License