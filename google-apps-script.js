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

const SHEET_NAME_LOGS = 'AttendanceLogs';
const SHEET_NAME_SCHEDULE = 'Schedule';

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Setup Logs Sheet
  let logsSheet = ss.getSheetByName(SHEET_NAME_LOGS);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(SHEET_NAME_LOGS);
    logsSheet.appendRow(['id', 'name', 'phone', 'company', 'title', 'reason', 'timestamp', 'authorUid']);
  }
  
  // Setup Schedule Sheet
  let scheduleSheet = ss.getSheetByName(SHEET_NAME_SCHEDULE);
  if (!scheduleSheet) {
    scheduleSheet = ss.insertSheet(SHEET_NAME_SCHEDULE);
    scheduleSheet.appendRow(['id', 'day', 'startTime', 'endTime', 'title', 'speaker', 'subject']);
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

function getLogs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_LOGS);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const logs = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const log = {};
    for (let j = 0; j < headers.length; j++) {
      log[headers[j]] = row[j];
    }
    logs.push(log);
  }
  return logs;
}

function addLog(log) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_LOGS);
  sheet.appendRow([
    log.id, log.name, log.phone || '', log.company || '', log.title || '', log.reason || '', log.timestamp, log.authorUid || ''
  ]);
}

function updateLog(log) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_LOGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === log.id) {
      sheet.getRange(i + 1, 1, 1, 8).setValues([[
        log.id, log.name, log.phone || '', log.company || '', log.title || '', log.reason || '', log.timestamp, log.authorUid || ''
      ]]);
      break;
    }
  }
}

function deleteLog(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_LOGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

// --- Schedule ---

function getSchedule() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_SCHEDULE);
  if (!sheet) return [];
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
