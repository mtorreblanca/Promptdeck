const STORAGE_KEY = "prompt-evaluator:history";
const MAX_ENTRIES = 200;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable — history just won't persist this session
  }
}

export function appendHistoryEntry(entries, entry) {
  const next = [entry, ...entries].slice(0, MAX_ENTRIES);
  saveHistory(next);
  return next;
}

export function clearHistory() {
  saveHistory([]);
  return [];
}
