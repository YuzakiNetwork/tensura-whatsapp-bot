 import { Boom } from '@hapi/boom';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import settings from './settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: 'silent' });
const commands = new Map();
const cooldowns = new Map();
const FOLDER_PLUGINS = path.join(__dirname, 'plugins');

async function loadPlugins() {
  const pluginFiles = readdirSync(FOLDER_PLUGINS).filter(file => file.endsWith('.js'));
  console.log(`[INFO] Ditemukan ${pluginFiles.length} plugin.`);
  
  for (const file of pluginFiles) {
    try {
      const module = await import(`file://${path.join(FOLDER_PLUGINS, file)}`);
      const plugin = module.default;
      
      if (plugin && plugin.command && plugin.execute) {
        plugin.command.forEach(cmd => {
          if (commands.has(cmd)) {
            console.warn(`[WARNING] Command duplicate: "${cmd}" di file ${file}`);
          }
          commands.set(cmd, plugin);
        });
      } else {
        console.warn(`[WARNING] File plugin tidak valid: ${file}`);
      }
    } catch (error) {
      console.error(`[ERROR] Gagal memuat plugin ${file}:`, error);
    }
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[INFO] Menggunakan Baileys v${version.join('.')}, latest: ${isLatest}`);
  
  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: [settings.botName, 'Chrome', '1.0.0'],
    shouldIgnoreJid: jid => jid.endsWith('@call'),
  });
  
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const phoneNumber = sock.user.id.split('@')[0].split(':')[0];
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('====================================');
        console.log('       MASUKKAN KODE INI DI WHATSAPP ANDA      ');
        console.log(`KODE PAIRING ANDA: ${code}`);
        console.log('====================================');
      } catch (error) {
        console.error('[ERROR] Gagal meminta pairing code:', error);
      }
    }, 3000);
  }
  
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error instanceof Boom) &&
        lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
      console.log('[CONNECTION] Koneksi ditutup, mencoba menghubungkan kembali...', shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('[CONNECTION] Koneksi berhasil dibuka!');
      if (!settings.botNumber) settings.botNumber = sock.user.id;
    }
  });
  
  sock.ev.on('creds.update', saveCreds);
  
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe || !msg.key.remoteJid || msg.key.remoteJid.endsWith('@newsletter')) return;
    
    const messageType = Object.keys(msg.message)[0];
    const text = (messageType === 'conversation') ? msg.message.conversation :
      (messageType === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
    
    if (!settings.prefixes.test(text)) return;
    
    const prefix = text.match(settings.prefixes)[0];
    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = commands.get(commandName);
    if (!command) return;
    
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup ? msg.key.participant : msg.key.remoteJid;
    
    if (command.owner && !settings.ownerNumbers.some(num => sender.startsWith(num))) {
      return sock.sendMessage(msg.key.remoteJid, { text: 'Perintah ini khusus untuk Owner Bot.' }, { quoted: msg });
    }
    
    if (command.groupOnly && !isGroup) {
      return sock.sendMessage(msg.key.remoteJid, { text: 'Perintah ini hanya dapat digunakan di dalam grup.' }, { quoted: msg });
    }
    
    if (command.cooldown) {
      const cooldownKey = `${sender}-${command.command[0]}`;
      const now = Date.now();
      const expirationTime = cooldowns.get(cooldownKey) || 0;
      
      if (now < expirationTime) {
        const timeLeft = Math.ceil((expirationTime - now) / 1000);
        return sock.sendMessage(msg.key.remoteJid, { text: `Tunggu ${timeLeft} detik lagi.` }, { quoted: msg });
      }
      cooldowns.set(cooldownKey, now + command.cooldown * 1000);
      setTimeout(() => cooldowns.delete(cooldownKey), command.cooldown * 1000);
    }
    
    try {
      await command.execute(msg, { sock, text, args, commands, prefix, isGroup, sender, settings });
    } catch (error) {
      console.error(`[ERROR] Eksekusi ${commandName} gagal:`, error);
      await sock.sendMessage(msg.key.remoteJid, { text: 'Terjadi kesalahan internal.' }, { quoted: msg });
    }
  });
  
  return sock;
}

async function main() {
  await loadPlugins();
  await connectToWhatsApp();
}

main().catch(console.error);