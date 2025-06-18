import { readDB, writeDB } from '../lib/database.js';

export default {
    name: 'Unregister RPG',
    command: ['unreg', 'undaftar', 'deleterpg'],
    prefix: true,
    category: 'rpg',
    description: 'Menghapus semua data petualangan RPG Anda secara permanen untuk mendaftar ulang.',
    cooldown: 300, // Cooldown 5 menit untuk mencegah penyalahgunaan/kesalahan
    async execute(msg, { sock, sender }) {
        const db = await readDB();

        if (!db.users[sender] || !db.users[sender].registered) {
            return sock.sendMessage(msg.key.remoteJid, { text: 'Anda belum terdaftar dalam petualangan.' }, { quoted: msg });
        }

        const userName = db.users[sender].name;
        
        // Hapus data RPG user
        delete db.users[sender];
        
        // Simpan database yang sudah diperbarui
        await writeDB(db);
        
        // Kirim pesan konfirmasi
        await sock.sendMessage(msg.key.remoteJid, { text: `Data petualangan atas nama *${userName}* telah berhasil dihapus.\n\nAnda sekarang bebas untuk memulai reinkarnasi baru dengan menggunakan perintah .daftar.` }, { quoted: msg });
    }
};