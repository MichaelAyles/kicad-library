type Persistence = {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
};

export const persistence: Persistence = {
  setItem(key, value) {
    return window.persistentStorage.setItem(key, value);
  },
  getItem(key) {
    return window.persistentStorage.getItem(key);
  },
  removeItem(key) {
    return window.persistentStorage.removeItem(key);
  },
  clear() {
    return window.persistentStorage.clear();
  },
};