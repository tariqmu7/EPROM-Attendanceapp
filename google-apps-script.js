/**
 * Google Apps Script for EPROM Attendance System
 * 
 * Instructions:
 * 1. Go to https://script.google.com/ and create a new project.
 * 2. Paste this code into Code.gs.
 * 3. Click "Deploy" -> "New deployment".
 * 4. Select type: "Web app".
 * 5. Execute as: "Me".
 * 6. Who has access: "Anyone".
 * 7. Click "Deploy" and authorize the script.
 * 8. Copy the "Web app URL" and set it as VITE_GOOGLE_SCRIPT_URL in your .env file.
 */

const SHEET_NAME_LOGS = 'Logs';
const SHEET_NAME_SCHEDULE = 'Schedule';

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Setup Logs Sheet
  let logsSheet = ss.getSheetByName(SHEET_NAME_LOGS);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(SHEET_NAME_LOGS);
    logsSheet.appendRow(['id', 'name', 'phone', 'company', 'title', 'reason', 'timestamp', 'authorUid', 'cardImageUrl']);
  }
  
  // Setup Schedule Sheet
  let scheduleSheet = ss.getSheetByName(SHEET_NAME_SCHEDULE);
  if (!scheduleSheet) {
    scheduleSheet = ss.insertSheet(SHEET_NAME_SCHEDULE);
    scheduleSheet.appendRow(['id', 'day', 'startTime', 'endTime', 'title', 'speaker', 'subject', 'category']);
  }
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload;
    
    let result = null;
    
    switch (action) {
      case 'getAllData':
        result = {
          logs: getLogs(),
          schedule: getSchedule()
        };
        break;
      case 'addLog':
        addLog(payload);
        break;
      case 'updateLog':
        updateLog(payload);
        break;
      case 'deleteLog':
        deleteLog(payload.id);
        break;
      case 'addScheduleItem':
        addScheduleItem(payload);
        break;
      case 'updateScheduleItem':
        updateScheduleItem(payload);
        break;
      case 'deleteScheduleItem':
        deleteScheduleItem(payload.id);
        break;
      case 'resetSchedule':
        resetSchedule(payload.items);
        break;
      case 'fetchImageBase64':
        result = fetchImageBase64(payload.url);
        break;
      default:
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Logs ---

function fetchImageBase64(url) {
  try {
    const match = url.match(/[-\w]{25,}/);
    if (!match) throw new Error("Invalid Drive URL");
    const fileId = match[0];
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    return {
      base64: Utilities.base64Encode(blob.getBytes()),
      mimeType: blob.getContentType()
    };
  } catch (e) {
    throw new Error("Failed to fetch image: " + e.toString());
  }
}

function getLogs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_LOGS);
  if (!sheet) throw new Error("Sheet '" + SHEET_NAME_LOGS + "' not found.");
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const logs = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const log = {};
    for (let j = 0; j < row.length; j++) {
      const header = headers[j] || `column${j+1}`;
      log[header] = row[j];
    }
    logs.push(log);
  }
  return logs;
}

function addLog(log) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_LOGS);
  let imageUrl = log.cardImageUrl || '';
  
  if (log.cardImageBase64) {
    try {
      const folderName = "Attendance_Card_Images";
      const folders = DriveApp.getFoldersByName(folderName);
      let folder;
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      
      const base64Data = log.cardImageBase64.includes(',') ? log.cardImageBase64.split(',')[1] : log.cardImageBase64;
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), log.cardImageMimeType || 'image/jpeg', 'card_' + log.id + '.jpg');
      const file = folder.createFile(blob);
      imageUrl = file.getUrl();
    } catch (e) {
      console.error("Error saving image: " + e.toString());
    }
  }
  
  const headersRange = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()));
  const headers = headersRange.getValues()[0];
  
  if (headers.length === 0 || (headers.length === 1 && headers[0] === '')) {
    // Empty sheet, use default columns
    sheet.appendRow([
      log.id, log.name, log.phone || '', log.company || '', log.title || '', log.reason || '', log.timestamp, log.authorUid || '', imageUrl
    ]);
    return;
  }
  
  const rowData = new Array(headers.length).fill('');
  const logMap = {
    'id': log.id,
    'name': log.name,
    'phone': log.phone || '',
    'company': log.company || '',
    'title': log.title || '',
    'reason': log.reason || '',
    'timestamp': log.timestamp,
    'authoruid': log.authorUid || '',
    'cardimageurl': imageUrl,
    'card image url': imageUrl
  };
  
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).toLowerCase().replace(/\s/g, '');
    if (logMap[header] !== undefined) {
      rowData[i] = logMap[header];
    }
  }
  
  sheet.appendRow(rowData);
}

function updateLog(log) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_LOGS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  
  let imageUrl = log.cardImageUrl || '';
  
  if (log.cardImageBase64) {
    try {
      const folderName = "Attendance_Card_Images";
      const folders = DriveApp.getFoldersByName(folderName);
      let folder;
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      
      const base64Data = log.cardImageBase64.includes(',') ? log.cardImageBase64.split(',')[1] : log.cardImageBase64;
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), log.cardImageMimeType || 'image/jpeg', 'card_' + log.id + '.jpg');
      const file = folder.createFile(blob);
      imageUrl = file.getUrl();
    } catch (e) {
      console.error("Error saving image: " + e.toString());
    }
  }

  let idColIndex = -1;
  let imageColIndex = -1;
  for (let j = 0; j < headers.length; j++) {
    const headerStr = String(headers[j]).toLowerCase().replace(/\s/g, '');
    if (headerStr === 'id') idColIndex = j;
    if (headerStr === 'cardimageurl' || headerStr === 'card image url') imageColIndex = j;
  }
  
  if (idColIndex === -1) idColIndex = 0; // Fallback to first column
  if (imageColIndex === -1) imageColIndex = 8; // Fallback to 9th column

  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIndex] === log.id) {
      if (!imageUrl && data[i].length > imageColIndex) {
        imageUrl = data[i][imageColIndex];
      }
      
      const rowData = [...data[i]]; // Copy existing row
      const logMap = {
        'id': log.id,
        'name': log.name,
        'phone': log.phone || '',
        'company': log.company || '',
        'title': log.title || '',
        'reason': log.reason || '',
        'timestamp': log.timestamp,
        'authoruid': log.authorUid || '',
        'cardimageurl': imageUrl,
        'card image url': imageUrl
      };
      
      for (let j = 0; j < headers.length; j++) {
        const header = String(headers[j]).toLowerCase().replace(/\s/g, '');
        if (logMap[header] !== undefined) {
          rowData[j] = logMap[header];
        }
      }
      
      // If no headers, fallback to default order
      if (headers.length === 0 || (headers.length === 1 && headers[0] === '')) {
        sheet.getRange(i + 1, 1, 1, 9).setValues([[
          log.id, log.name, log.phone || '', log.company || '', log.title || '', log.reason || '', log.timestamp, log.authorUid || '', imageUrl
        ]]);
      } else {
        sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      }
      break;
    }
  }
}

function deleteLog(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_LOGS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  
  let idColIndex = -1;
  for (let j = 0; j < headers.length; j++) {
    const headerStr = String(headers[j]).toLowerCase().replace(/\s/g, '');
    if (headerStr === 'id') {
      idColIndex = j;
      break;
    }
  }
  if (idColIndex === -1) idColIndex = 0; // Fallback to first column

  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIndex] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

// --- Schedule ---

function getSchedule() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_SCHEDULE);
  if (!sheet) throw new Error("Sheet '" + SHEET_NAME_SCHEDULE + "' not found.");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const schedule = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    for (let j = 0; j < headers.length; j++) {
      item[headers[j]] = row[j];
    }
    schedule.push(item);
  }
  return schedule;
}

function addScheduleItem(item) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_SCHEDULE);
  sheet.appendRow([
    item.id, item.day, item.startTime, item.endTime, item.title, item.speaker, item.subject
  ]);
}

function updateScheduleItem(item) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_SCHEDULE);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === item.id) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([[
        item.id, item.day, item.startTime, item.endTime, item.title, item.speaker, item.subject
      ]]);
      break;
    }
  }
}

function deleteScheduleItem(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_SCHEDULE);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function resetSchedule(items) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_SCHEDULE);
  // Clear everything except headers
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  if (items && items.length > 0) {
    const rows = items.map(item => [
      item.id, item.day, item.startTime, item.endTime, item.title, item.speaker, item.subject
    ]);
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }
}
