export const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

export interface ScriptResponse {
  success: boolean;
  data?: any;
  error?: string;
}

let hasWarnedMissingUrl = false;

export async function fetchFromScript(action: string, payload?: any): Promise<ScriptResponse> {
  if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
    if (!hasWarnedMissingUrl) {
      console.warn("VITE_GOOGLE_SCRIPT_URL is not set or still has placeholder. Data will only be saved locally.");
      hasWarnedMissingUrl = true;
    }
    return { success: false, error: "No Script URL configured." };
  }
  
  const cleanUrl = SCRIPT_URL.replace(/^["']|["']$/g, '').trim();

  try {
    const response = await fetch(cleanUrl, {
      method: 'POST',
      body: JSON.stringify({ action, payload }),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      mode: 'cors',
      redirect: 'follow'
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`Script error response (${response.status}):`, text);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      console.error(`Script returned failure for action ${action}:`, data.error);
    } else {
      console.log(`Action ${action} success:`, data.data);
    }
    return data;
  } catch (error) {
    console.error(`Error fetching from script (action: ${action}):`, error);
    throw error;
  }
}

// Local Storage Keys
const LOGS_KEY = 'attendance_logs';
const SCHEDULE_KEY = 'schedule_items';
const QUEUE_KEY = 'offline_sync_queue';

const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// --- Local Data Management ---

export function getLocalLogs(): any[] {
  const raw = localStorage.getItem(LOGS_KEY);
  if (!raw) return [];

  let logs: any[] = [];
  try {
    logs = JSON.parse(raw);
    if (!Array.isArray(logs)) logs = [];
  } catch (e) {
    logs = [];
  }

  // Deduplicate IDs if any exist
  const seen = new Set();
  let changed = false;
  const validLogs = logs.filter((log: any) => {
    if (!log || typeof log !== 'object') return false;
    if (!log.id || seen.has(log.id)) {
      log.id = generateId();
      changed = true;
    }
    seen.add(log.id);
    return true;
  });

  if (changed) {
    localStorage.setItem(LOGS_KEY, JSON.stringify(validLogs));
  }
  return validLogs;
}

export function saveLocalLogs(logs: any[]) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  window.dispatchEvent(new Event('localDataChanged'));
}

export function getLocalSchedule(): any[] {
  const raw = localStorage.getItem(SCHEDULE_KEY);
  if (!raw) return [];
  
  let schedule: any[] = [];
  try {
    schedule = JSON.parse(raw);
    if (!Array.isArray(schedule)) schedule = [];
  } catch (e) {
    schedule = [];
  }

  // Filter out invalid items and deduplicate IDs
  const seen = new Set();
  let changed = false;
  const validSchedule = schedule.filter((item: any) => {
    if (!item || typeof item !== 'object') return false;
    if (!item.id || seen.has(item.id)) {
      item.id = generateId();
      changed = true;
    }
    seen.add(item.id);
    return true;
  });

  if (changed) {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(validSchedule));
  }
  return validSchedule;
}

export function saveLocalSchedule(schedule: any[]) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  window.dispatchEvent(new Event('localDataChanged'));
}

// --- Queue Management ---

export function queueOperation(action: string, payload: any) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ action, payload, id: generateId() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event('queueChanged'));
}

export function getUnsyncedCount() {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  return queue.length;
}

let isSyncing = false;

export async function syncQueue() {
  if (isSyncing) return 0;
  
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (queue.length === 0) return 0;

  isSyncing = true;
  let syncedCount = 0;
  const remainingQueue = [];

  try {
    for (const item of queue) {
      try {
        const res = await fetchFromScript(item.action, item.payload);
        if (res.success) {
          syncedCount++;
        } else {
          remainingQueue.push(item);
        }
      } catch (e) {
        remainingQueue.push(item);
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    window.dispatchEvent(new Event('queueChanged'));
  } finally {
    isSyncing = false;
  }
  
  return syncedCount;
}

// --- API Methods ---

export async function initializeSheet() {
  if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_SCRIPT_ID')) return;
  
  const logHeaders = ['ID', 'Name', 'Phone', 'Company', 'Title', 'Reason', 'Timestamp', 'Author UID', 'Card Image URL'];
  const scheduleHeaders = ['ID', 'Day', 'Start Time', 'End Time', 'Title', 'Speaker', 'Subject', 'Category'];
  
  try {
    const res = await fetchFromScript('setupHeaders', { logHeaders, scheduleHeaders });
    return res.success;
  } catch (error) {
    console.error("Failed to setup headers", error);
    return false;
  }
}

export async function fetchAllData() {
  if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_SCRIPT_ID')) return;
  
  try {
    const res = await fetchFromScript('getAllData');
    if (res.success && res.data) {
      console.log("Successfully fetched data from script:", res.data);
      
      if (res.data.logs && Array.isArray(res.data.logs)) {
        // Skip header row if it exists
        const firstRow = res.data.logs[0];
        const isHeader = firstRow && Array.isArray(firstRow) && 
          (String(firstRow[0]).toLowerCase() === 'id' || String(firstRow[1]).toLowerCase() === 'name');
        const logsData = isHeader ? res.data.logs.slice(1) : res.data.logs;
        
        const mappedLogs = logsData.map((item: any) => {
          if (Array.isArray(item)) {
            let phone = String(item[2] || '');
            if (phone.startsWith("'")) {
              phone = phone.substring(1);
            }
            let ts = Number(item[6]);
            if (isNaN(ts)) ts = new Date(item[6]).getTime();
            if (isNaN(ts)) ts = Date.now();
            
            return {
              id: item[0] || generateId(),
              name: String(item[1] || ''),
              phone: phone,
              company: String(item[3] || ''),
              title: String(item[4] || ''),
              reason: String(item[5] || ''),
              timestamp: ts,
              authorUid: String(item[7] || 'local-user'),
              cardImageUrl: String(item[8] || ''),
              synced: 1
            };
          }
          
          // Helper to get value case-insensitively and ignoring spaces
          const getVal = (key: string) => {
            if (item[key] !== undefined) return item[key];
            
            const targetKey = key.toLowerCase().replace(/\s/g, '');
            for (const k in item) {
              if (k.toLowerCase().replace(/\s/g, '') === targetKey) {
                return item[k];
              }
            }
            return '';
          };

          let phone = String(getVal('phone'));
          if (phone.startsWith("'")) {
            phone = phone.substring(1);
          }
          
          let tsVal = getVal('timestamp');
          let ts = typeof tsVal === 'number' ? tsVal : new Date(tsVal).getTime();
          if (isNaN(ts)) ts = Date.now();

          return { 
            id: getVal('id') || generateId(),
            name: String(getVal('name')),
            phone: phone,
            company: String(getVal('company')),
            title: String(getVal('title')),
            reason: String(getVal('reason')),
            timestamp: ts,
            authorUid: String(getVal('authorUid') || 'local-user'),
            cardImageUrl: String(getVal('cardImageUrl') || getVal('Card Image URL') || getVal('column9') || ''),
            synced: 1
          };
        });
        saveLocalLogs(mappedLogs);
      }
      
      if (res.data.schedule && Array.isArray(res.data.schedule)) {
        // Skip header row if it exists
        const scheduleData = res.data.schedule[0] && res.data.schedule[0][0] === 'ID' ? res.data.schedule.slice(1) : res.data.schedule;

        const formatTime = (val: any) => {
          if (!val) return '';
          const str = String(val);
          // If it's a full ISO string with the 1899 date, extract just the time
          if (str.includes('1899-12-30')) {
            try {
              const date = new Date(str);
              const h = date.getHours().toString().padStart(2, '0');
              const m = date.getMinutes().toString().padStart(2, '0');
              return `${h}:${m}`;
            } catch (e) {
              return str;
            }
          }
          return str;
        };

        // Robust mapping in case data comes as arrays (rows) instead of objects
        const mappedSchedule = scheduleData.map((item: any) => {
          if (Array.isArray(item)) {
            const categoryValue = item[7] ? String(item[7]).toLowerCase().trim() : '';
            return {
              id: item[0] || generateId(),
              day: Number(item[1]) || 1,
              startTime: formatTime(item[2]),
              endTime: formatTime(item[3]),
              title: String(item[4] || ''),
              speaker: String(item[5] || ''),
              subject: String(item[6] || ''),
              category: (categoryValue === 'closing' || categoryValue === 'activity') ? (categoryValue as 'activity' | 'closing') : 'activity'
            };
          }
          
          const getVal = (key: string) => {
            if (item[key] !== undefined) return item[key];
            const targetKey = key.toLowerCase().replace(/\s/g, '');
            for (const k in item) {
              if (k.toLowerCase().replace(/\s/g, '') === targetKey) {
                return item[k];
              }
            }
            return '';
          };

          const categoryValue = getVal('category') ? String(getVal('category')).toLowerCase().trim() : 'activity';
          return {
            id: getVal('id') || generateId(),
            day: Number(getVal('day')) || 1,
            startTime: formatTime(getVal('startTime')),
            endTime: formatTime(getVal('endTime')),
            title: String(getVal('title')),
            speaker: String(getVal('speaker')),
            subject: String(getVal('subject')),
            category: (categoryValue === 'closing' || categoryValue === 'activity') ? (categoryValue as 'activity' | 'closing') : 'activity'
          };
        });
        saveLocalSchedule(mappedSchedule);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to fetch all data", error);
    return false;
  }
}

export async function fetchImageBase64FromDrive(url: string) {
  const res = await fetchFromScript('fetchImageBase64', { url });
  if (res.success && res.data) {
    return res.data as { base64: string, mimeType: string };
  }
  throw new Error(res.error || "Failed to fetch image");
}

export function addLog(log: any) {
  const logs = getLocalLogs();
  const newLog = { ...log, id: log.id || generateId() };
  
  // Create a copy for local display without the heavy image data to save localStorage space
  const displayLog = { ...newLog };
  delete displayLog.cardImageBase64;
  delete displayLog.cardImageMimeType;
  
  logs.push(displayLog);
  saveLocalLogs(logs);
  
  // Queue the full log including the image for syncing to the backend
  const payloadLog = { ...newLog };
  if (payloadLog.phone && typeof payloadLog.phone === 'string' && !payloadLog.phone.startsWith("'")) {
    payloadLog.phone = "'" + payloadLog.phone;
  }
  queueOperation('addLog', payloadLog);
  if (navigator.onLine) syncQueue();
}

export function updateLog(id: string, log: any) {
  const logs = getLocalLogs();
  const index = logs.findIndex(l => l.id === id);
  if (index !== -1) {
    logs[index] = { ...logs[index], ...log };
    saveLocalLogs(logs);
    
    const payloadLog = { id, ...log };
    if (payloadLog.phone && typeof payloadLog.phone === 'string' && !payloadLog.phone.startsWith("'")) {
      payloadLog.phone = "'" + payloadLog.phone;
    }
    queueOperation('updateLog', payloadLog);
    if (navigator.onLine) syncQueue();
  }
}

export function deleteLog(id: string) {
  const logs = getLocalLogs();
  saveLocalLogs(logs.filter(l => l.id !== id));
  queueOperation('deleteLog', id);
  if (navigator.onLine) syncQueue();
}

export function addScheduleItem(item: any) {
  const schedule = getLocalSchedule();
  const newItem = { ...item, id: item.id || generateId() };
  schedule.push(newItem);
  saveLocalSchedule(schedule);
  queueOperation('addScheduleItem', newItem);
  if (navigator.onLine) syncQueue();
}

export function updateScheduleItem(id: string, item: any) {
  const schedule = getLocalSchedule();
  const index = schedule.findIndex(s => s.id === id);
  if (index !== -1) {
    schedule[index] = { ...schedule[index], ...item };
    saveLocalSchedule(schedule);
    queueOperation('updateScheduleItem', { id, ...item });
    if (navigator.onLine) syncQueue();
  }
}

export function deleteScheduleItem(id: string) {
  const schedule = getLocalSchedule();
  saveLocalSchedule(schedule.filter(s => s.id !== id));
  queueOperation('deleteScheduleItem', id);
  if (navigator.onLine) syncQueue();
}

export function resetSchedule(defaultItems: any[]) {
  const itemsWithIds = defaultItems.map(item => ({ ...item, id: item.id || generateId() }));
  saveLocalSchedule(itemsWithIds);
  queueOperation('resetSchedule', itemsWithIds);
  if (navigator.onLine) syncQueue();
}
