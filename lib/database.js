import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'database.json');

let isWriting = false;
const writeQueue = [];

export async function readDB() {
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const defaultData = { users: {}, groups: {}, settings: {} };
      await writeDB(defaultData);
      return defaultData;
    }
    console.error('Error reading database:', error);
    throw error;
  }
}

export async function writeDB(data) {
  writeQueue.push(data);
  if (isWriting) return;
  
  isWriting = true;
  while (writeQueue.length > 0) {
    const currentData = writeQueue.shift();
    try {
      // Simple lock to prevent race conditions.
      await fs.writeFile(dbPath, JSON.stringify(currentData, null, 2));
    } catch (error) {
      console.error('Error writing to database:', error);
    }
  }
  isWriting = false;
}