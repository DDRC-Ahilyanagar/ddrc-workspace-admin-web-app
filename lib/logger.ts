import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'storage', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ddrc_api.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function writeLog(level: string, message: string, context: any = {}) {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const ctx = Object.keys(context).length > 0 
    ? JSON.stringify(context, null, 2) 
    : '';
  const line = `[${timestamp}] ${level}: ${message} ${ctx}\n`;
  fs.appendFile(LOG_FILE, line, 'utf8', () => {});
}

export const Logger = {
  info: (message: string, context: any = {}) => {
    writeLog('INFO', message, context);
    console.log(`[INFO] ${message}`, context);
  },
  error: (message: string, context: any = {}) => {
    writeLog('ERROR', message, context);
    console.error(`[ERROR] ${message}`, context);
  },
};

