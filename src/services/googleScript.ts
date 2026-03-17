export const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

export interface ScriptResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function fetchFromScript(action: string, payload?: any): Promise<ScriptResponse> {
  if (!SCRIPT_URL) {
    console.warn("VITE_GOOGLE_SCRIPT_URL is not set.");
    return { success: false, error: "No Script URL configured." };
  }
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action, payload }),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });
    return await response.json();
  } catch (error) {
    console.error("Error fetching from script:", error);
    throw error;
  }
}

// Local Storage Keys
const LOGS_KEY = 'attendance_logs';
const SCHEDULE_KEY = 'schedule_items';
const QUEUE_KEY = 'offline_sync_queue';

// --- Local Data Management ---

export function getLocalLogs(): any[] {
  return JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
}

export function saveLocalLogs(logs: any[]) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  window.dispatchEvent(new Event('localDataChanged'));
}

export function getLocalSchedule(): any[] {
  return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]');
}

export function saveLocalSchedule(schedule: any[]) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  window.dispatchEvent(new Event('localDataChanged'));
}

// --- Queue Management ---

export function queueOperation(action: string, payload: any) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ action, payload, id: Date.now().toString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event('queueChanged'));
}

export function getUnsyncedCount() {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  return queue.length;
}

export async function syncQueue() {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (queue.length === 0) return 0;

  let syncedCount = 0;
  const remainingQueue = [];

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
  return syncedCount;
}

// --- API Methods ---

export async function fetchAllData() {
  try {
    const res = await fetchFromScript('getAllData');
    if (res.success && res.data) {
      if (res.data.logs) saveLocalLogs(res.data.logs);
      if (res.data.schedule) saveLocalSchedule(res.data.schedule);
    }
  } catch (error) {
    console.error("Failed to fetch all data", error);
  }
}

export function addLog(log: any) {
  const logs = getLocalLogs();
  const newLog = { ...log, id: log.id || Date.now().toString() };
  logs.push(newLog);
  saveLocalLogs(logs);
  queueOperation('addLog', newLog);
  if (navigator.onLine) syncQueue();
}

export function updateLog(id: string, log: any) {
  const logs = getLocalLogs();
  const index = logs.findIndex(l => l.id === id);
  if (index !== -1) {
    logs[index] = { ...logs[index], ...log };
    saveLocalLogs(logs);
    queueOperation('updateLog', { id, ...log });
    if (navigator.onLine) syncQueue();
  }
}

export function deleteLog(id: string) {
  const logs = getLocalLogs();
  saveLocalLogs(logs.filter(l => l.id !== id));
  queueOperation('deleteLog', { id });
  if (navigator.onLine) syncQueue();
}

export function addScheduleItem(item: any) {
  const schedule = getLocalSchedule();
  const newItem = { ...item, id: item.id || Date.now().toString() };
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
  queueOperation('deleteScheduleItem', { id });
  if (navigator.onLine) syncQueue();
}

export function resetSchedule(defaultItems: any[]) {
  const itemsWithIds = defaultItems.map(item => ({ ...item, id: item.id || Date.now().toString() + Math.random().toString() }));
  saveLocalSchedule(itemsWithIds);
  queueOperation('resetSchedule', { items: itemsWithIds });
  if (navigator.onLine) syncQueue();
}
