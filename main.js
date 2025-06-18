import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import settings from './settings.js';
import { readDB } from './lib/database.js';

// --- GAYA IMPOR BARU UNTUK BAILEYS ---
import * as baileys from '@whiskeysockets/baileys';
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = baileys;
// ------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: 'silent' });
const commands = new Map();
const cooldowns = new Map();
const FOLDER_PLUGINS = path.join(__dirname, 'plugins');

// ... (Fungsi loadPlugins tetap sama) ...
async function loadPlugins() {
    const pluginFiles = readdirSync(FOLDER_PLUGINS).filter(file => file.endsWith('.js'));
    console.log(`[INFO] Ditemukan ${pluginFiles.length} plugin.`);
    for (const file of pluginFiles) {
        try {
            const module = await import(`file://${path.join(FOLDER_PLUGINS, file)}`);
            const plugin = module.default;
            if (plugin && plugin.command && plugin.execute) {
                plugin.command.forEach(cmd => {
                    if (commands.has(cmd)) console.warn(`[WARNING] Command duplicate: "${cmd}" di file ${file}`);
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
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: [settings.botName, 'Chrome', '1.0.0'],
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const phoneNumber = sock.user.id.split('@')[0].split(':')[0];
                const code = await sock.requestPairingCode(phoneNumber);
                console.log('====================================');
                console.log(`KODE PAIRING ANDA: ${code}`);
                console.log('====================================');
            } catch (error) {
                console.error('[ERROR] Gagal meminta pairing code:', error);
            }
        }, 3000);
    }
    
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) &&
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
            console.log('[CONNECTION] Koneksi ditutup, mencoba menghubungkan kembali...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('[CONNECTION] Koneksi berhasil dibuka!');
        }
    });

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

        if (command.hidden) {
            console.log(`[BLOCKED] Command '${commandName}' is hidden.`);
            return;
        }

        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : msg.key.remoteJid;
        const isOwner = settings.ownerNumbers.some(num => sender.startsWith(num));

        const db = await readDB();
        const permission = command.permissions.toLowerCase();
        let hasPermission = false;

        switch (permission) {
            case 'all': hasPermission = true; break;
            case 'owner': if (isOwner) hasPermission = true; break;
            case 'group': if (isGroup) hasPermission = true; break;
            case 'private': if (!isGroup) hasPermission = true; break;
            case 'rpg':
                const groupData = db.groups?.[msg.key.remoteJid];
                if (isGroup && groupData?.rpg_enabled) hasPermission = true;
                break;
            default: console.warn(`[WARNING] Unknown permission type '${permission}'`); break;
        }
        
        if (!hasPermission) return;

        if (command.cooldown > 0 && !isOwner) {
            const cooldownKey = `${sender}-${commandName}`;
            const now = Date.now();
            const expirationTime = cooldowns.get(cooldownKey) || 0;

            if (now < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - now) / 1000);
                await sock.sendMessage(msg.key.remoteJid, { text: `Tunggu ${timeLeft} detik lagi.` }, { quoted: msg });
                return;
            }
            cooldowns.set(cooldownKey, now + command.cooldown * 1000);
            setTimeout(() => cooldowns.delete(cooldownKey), command.cooldown * 1000);
        }
        
        const context = {
        sock,
        msg,
        text,
        args,
        commandName,
        prefix,
        sender,
        isGroup,
        isOwner,
        chat: msg.key.remoteJid,
        reply: (content) => sock.sendMessage(msg.key.remoteJid, { text: content }, { quoted: msg }),
        db // Teruskan database agar plugin tidak perlu import ulang
    };

        try {
            await command.execute(context);
        } catch (error) {
            console.error(`[ERROR] Eksekusi ${commandName} gagal:`, error);
            await context.reply('Terjadi kesalahan internal.');
        }
    });

    return sock;
}

async function main() {
    await loadPlugins();
    await connectToWhatsApp();
}

main().catch(console.error);