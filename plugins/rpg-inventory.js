import { readDB } from '../lib/database.js';

export default {
    name: 'Inventory',
    command: ['inventory', 'inv', 'tas'],
    prefix: true,
    category: 'rpg',
    description: 'Menampilkan isi inventory Anda.',
    async execute(msg, { sock, sender, prefix }) {
        const db = await readDB();
        if (!db.users[sender]?.registered) {
            return sock.sendMessage(msg.key.remoteJid, { text: `Anda belum terdaftar. Gunakan *${prefix}daftar*.` }, { quoted: msg });
        }
        const user = db.users[sender];
        
        let invMessage = `*🎒 INVENTORY - ${user.name}*\n\n`;

        if (!user.inventory || Object.keys(user.inventory).length === 0) {
            invMessage += '_Inventory kosong._';
        } else {
            // Urutkan item, letakkan gold di atas
            const sortedInventory = Object.entries(user.inventory).sort(([keyA], [keyB]) => {
                if (keyA === 'gold') return -1;
                if (keyB === 'gold') return 1;
                return keyA.localeCompare(keyB);
            });

            for (const [item, amount] of sortedInventory) {
                if (amount > 0) { // Hanya tampilkan item yang jumlahnya lebih dari 0
                    const itemName = item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    invMessage += `› *${itemName}:* ${amount.toLocaleString()}\n`;
                }
            }
        }
        
        await sock.sendMessage(msg.key.remoteJid, { text: invMessage.trim() }, { quoted: msg });
    }
};