/**
 * LINE Task Reminder for Google Apps Script
 * スプレッドシートのタスクの期日をチェックして、LINEで通知するライブラリ
 */

// 列名の定数定義
const COLUMN_NAMES = {
  DEADLINE: '終了予定日',
  STATUS: 'ステータス', 
  TASK_NAME: '小項目',
  COMPLETED_STATUS: '完了'
};

// LINE Bot のチャンネルアクセストークン
// スクリプトプロパティから取得（プロジェクト設定 > スクリプトプロパティで設定）
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('channel_access_token');

// 送信先の配列
// - ユーザーID: 'U'で始まる（例: Uxxxxxxxxxxxxxxxxxxxxx）
// - グループID: 'C'で始まる（例: Cxxxxxxxxxxxxxxxxxxxxx）
// - トークルームID: 'R'で始まる（例: Rxxxxxxxxxxxxxxxxxxxxx）
const DESTINATIONS = PropertiesService.getScriptProperties().getProperty('destinations') 
  ? PropertiesService.getScriptProperties().getProperty('destinations').split(',')
  : ['YOUR_USER_OR_GROUP_ID_HERE'];

// デフォルトのシート設定（スプレッドシートIDや設定が渡されない場合に使用）
const DEFAULT_SPREADSHEET_ID = null;
const DEFAULT_TARGET_SHEETS = [
  { name: 'シート1', headerRow: 1 }
];

// 日付かどうかを判定する関数
function isValidDate_(value) {
  // Dateオブジェクトの場合
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  
  // 日付っぽいオブジェクトの場合（GASで時々発生）
  if (value && typeof value === 'object' && typeof value.getTime === 'function') {
    return !isNaN(value.getTime());
  }
  
  // 文字列の場合は日付に変換を試みる
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return !isNaN(parsed.getTime());
  }
  
  return false;
}

// 日付の時刻部分を0時0分0秒に正規化する関数
function normalizeTime_(date) {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

// メイン関数（引数でカスタマイズ可能）
function checkDeadlinesAndNotify(spreadsheetId = null, targetSheets = null) {
  // スプレッドシートの取得（引数がない場合はアクティブなスプレッドシート）
  const ss = spreadsheetId 
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss) {
    console.error('スプレッドシートが見つかりません');
    return;
  }
  
  // シート設定の取得（引数がない場合はデフォルト設定）
  const sheetsToCheck = targetSheets || DEFAULT_TARGET_SHEETS;
  
  const today = normalizeTime_(new Date());  // 今日の0時0分0秒
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);

  let upcomingItems = [];  // 期限が近づいているタスク
  let overdueItems = [];   // 期限切れのタスク
  
  // 各シートをチェック
  sheetsToCheck.forEach(sheetConfig => {
    try {
      const sheet = ss.getSheetByName(sheetConfig.name);
      if (!sheet) {
        console.log(`シート「${sheetConfig.name}」が見つかりません`);
        return;
      }
      
      const data = sheet.getDataRange().getValues();
      const headers = data[sheetConfig.headerRow - 1];  // 配列インデックスに変換
      
      // 列見出しのインデックスを取得
      const endDateIndex = headers.indexOf(COLUMN_NAMES.DEADLINE);
      const itemIndex = headers.indexOf(COLUMN_NAMES.TASK_NAME);
      const statusIndex = headers.indexOf(COLUMN_NAMES.STATUS);
      
      if (endDateIndex === -1 || itemIndex === -1) {
        console.log(`シート「${sheetConfig.name}」に必要な列が見つかりません`);
        return;
      }

      // データ行をチェック（ヘッダー行以降をスキップ）
      for (let i = sheetConfig.headerRow; i < data.length; i++) {
        const endDate = data[i][endDateIndex];
        const item = data[i][itemIndex];
        const status = statusIndex !== -1 ? data[i][statusIndex] : '';

        // 日付と小項目が存在し、ステータスが「完了」以外の場合のみ処理
        if (endDate && item && isValidDate_(endDate) && status !== COLUMN_NAMES.COMPLETED_STATUS) {
          const endDateNormalized = normalizeTime_(endDate);  // 終了予定日の時刻をリセット

          const itemData = {
            sheet: sheetConfig.name,
            item: item,
            date: Utilities.formatDate(endDateNormalized, 'JST', 'yyyy/MM/dd'),
            rawDate: endDateNormalized
          };
          
          // 期限切れかどうかチェック
          if (endDateNormalized < today) {
            overdueItems.push(itemData);
          } else if (endDateNormalized <= sevenDaysLater) {
            upcomingItems.push(itemData);
          }
        }
      }
    } catch (e) {
      console.error(`シート「${sheetConfig.name}」の処理中にエラーが発生しました: ${e}`);
    }
  });
  
  // 通知対象がある場合はLINEに送信
  if (upcomingItems.length > 0 || overdueItems.length > 0) {
    sendLineMessage_(upcomingItems, overdueItems);
  }
}



// LINE Messaging APIでメッセージを送信する関数
function sendLineMessage_(upcomingItems, overdueItems) {
  let messageText = '📅 タスク期限通知\n';
  messageText += '━━━━━━━━━━━━━━━\n';
  
  // 期限切れタスクがある場合
  if (overdueItems.length > 0) {
    messageText += '\n🚨 【期限切れタスク】\n';
    messageText += '────────────────\n';
    
    // 日付でソート（古い順）
    overdueItems.sort((a, b) => a.rawDate - b.rawDate);
    
    overdueItems.forEach(item => {
      messageText += `\n📋 シート: ${item.sheet}\n`;
      messageText += `📌 小項目: ${item.item}\n`;
      messageText += `❌ 期日: ${item.date} (期限切れ)\n`;
      messageText += '------------------------';
    });
    
    messageText += `\n\n⚠️ ${overdueItems.length} 件のタスクが期限切れです\n`;
  }
  
  // 期限が近づいているタスクがある場合
  if (upcomingItems.length > 0) {
    if (overdueItems.length > 0) {
      messageText += '\n━━━━━━━━━━━━━━━\n';
    }
    
    messageText += '\n⏰ 【期限が近いタスク】\n';
    messageText += '────────────────\n';
    
    // 日付でソート（近い順）
    upcomingItems.sort((a, b) => a.rawDate - b.rawDate);
    
    upcomingItems.forEach(item => {
      messageText += `\n📋 シート: ${item.sheet}\n`;
      messageText += `📌 小項目: ${item.item}\n`;
      messageText += `📅 期日: ${item.date}\n`;
      messageText += '------------------------';
    });
    
    messageText += `\n\n📊 ${upcomingItems.length} 件のタスクが7日以内に期限を迎えます\n`;
  }
  
  // 合計
  const totalCount = overdueItems.length + upcomingItems.length;
  messageText += `\n━━━━━━━━━━━━━━━\n`;
  messageText += `📝 合計: ${totalCount} 件のタスク`;
  
  // 各宛先に送信
  DESTINATIONS.forEach(destination => {
    const payload = {
      to: destination,
      messages: [{
        type: 'text',
        text: messageText
      }]
    };
    
    const options = {
      'method': 'post',
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
      },
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };
    
    try {
      const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
      const responseCode = response.getResponseCode();
      
      if (responseCode === 200) {
        console.log(`宛先 ${destination} へのメッセージ送信成功`);
      } else {
        console.error(`宛先 ${destination} への送信失敗。レスポンスコード: ${responseCode}`);
        console.error('レスポンス: ' + response.getContentText());
      }
    } catch (e) {
      console.error(`宛先 ${destination} への送信中にエラー: ${e}`);
    }
  });
}

// 手動実行用の関数（テスト用）
function testNotification() {
  checkDeadlinesAndNotify();
}

// Webhook処理関数（ユーザーID/グループID取得用）
function doPost(e) {
  // リクエスト内容を解析
  const json = JSON.parse(e.postData.contents);
  const events = json.events;
  
  events.forEach(event => {
    // メッセージイベントの場合
    if (event.type === 'message' && event.message.type === 'text') {
      const source = event.source;
      const replyToken = event.replyToken;
      
      let responseText = '';
      
      // 送信元の種類に応じてIDを取得
      if (source.type === 'user') {
        console.log('User ID:', source.userId);
        responseText = `あなたのユーザーIDは:\n${source.userId}`;
      } else if (source.type === 'group') {
        console.log('Group ID:', source.groupId);
        responseText = `このグループのIDは:\n${source.groupId}`;
      } else if (source.type === 'room') {
        console.log('Room ID:', source.roomId);
        responseText = `このトークルームのIDは:\n${source.roomId}`;
      }
      
      // 返信用のペイロード
      const payload = {
        replyToken: replyToken,
        messages: [{
          type: 'text',
          text: responseText
        }]
      };
      
      const options = {
        'method': 'post',
        'headers': {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
        },
        'payload': JSON.stringify(payload)
      };
      
      try {
        UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', options);
      } catch (error) {
        console.error('返信エラー:', error);
      }
    }
  });
  
  // LINE Platformへの応答
  return ContentService.createTextOutput(JSON.stringify({'content': 'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}
