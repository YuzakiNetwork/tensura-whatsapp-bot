import { readDB, writeDB } from '../lib/database.js';
// Impor hanya grantExp, karena fungsi lain sudah di-handle di dalamnya
import { grantExp } from '../lib/functions.js';

export default {
    name: 'Dungeon',
    command: ['dungeon', 'hunt', 'explore'],
    prefix: true,
    category: 'rpg',
    description: 'Masuk ke dungeon untuk melawan monster dan mendapatkan EXP & Gold.',
    cooldown: 300,
    async execute(msg, { sock, sender, prefix }) {
        const db = await readDB();

        if (!db.users[sender] || !db.users[sender].registered) {
            return sock.sendMessage(msg.key.remoteJid, { text: `Anda belum terdaftar. Gunakan *${prefix}daftar* untuk memulai petualangan.` }, { quoted: msg });
        }

        let user = db.users[sender];

        // Simulasi pertarungan
        const monsters = ['Goblin', 'Giant Ant', 'Bat', 'Slime', 'Direwolf'];
        const defeatedMonster = monsters[Math.floor(Math.random() * monsters.length)];
        
        const earnedExp = Math.floor(Math.random() * (50 * user.level)) + (20 * user.level);
        const earnedGold = Math.floor(Math.random() * (15 * user.level)) + (10 * user.level);

        // Tambahkan gold secara manual
        user.inventory.gold += earnedGold;

        // Panggil fungsi terpusat untuk memberikan EXP dan menangani semua event
        const { user: updatedUser, notification } = await grantExp(user, earnedExp, sock, msg);

        // Simpan data user yang sudah diperbarui ke database
        db.users[sender] = updatedUser;
        await writeDB(db);

        // Buat pesan hasil akhir
        let replyMessage = `Anda menjelajahi dungeon dan berhasil mengalahkan *${defeatedMonster}*!\n\n*Hadiah:*\n› *EXP:* +${earnedExp}\n› *Gold:* +${earnedGold}`;
        
        // Tambahkan notifikasi level up/evolusi jika ada
        replyMessage += notification;

        await sock.sendMessage(msg.key.remoteJid, { text: replyMessage.trim() }, { quoted: msg });
    }
};