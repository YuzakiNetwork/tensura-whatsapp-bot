import { readDB, writeDB } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';

const EXCHANGE_RATE_MONSTER_CORE = 25; // 1 monster core = 25 Gold
const GUILD_CREATION_COST = 5000; // Biaya membuat guild

export default {
    name: 'Guild',
    command: ['guild'],
    prefix: true,
    category: 'rpg',
    description: 'Manajemen guild. Sub-command: create, exchange, info',
    cooldown: 10,
    async execute(msg, { sock, sender, args, prefix, isGroup }) {
        const subCommand = args[0]?.toLowerCase();
        const db = await readDB();
        let user = db.users[sender];

        if (!user?.registered) {
            return sock.sendMessage(msg.key.remoteJid, { text: `Anda belum terdaftar. Gunakan *${prefix}daftar*.` }, { quoted: msg });
        }

        switch (subCommand) {
            case 'create':
                if (!isGroup) return sock.sendMessage(msg.key.remoteJid, { text: 'Perintah ini hanya dapat digunakan di dalam grup.' }, { quoted: msg });
                if (user.guildId) return sock.sendMessage(msg.key.remoteJid, { text: 'Anda sudah tergabung dalam sebuah guild.' }, { quoted: msg });

                const guildName = args.slice(1).join(' ');
                if (!guildName) return sock.sendMessage(msg.key.remoteJid, { text: `Gunakan format: *${prefix}guild create <nama guild>*` }, { quoted: msg });
                
                if ((user.inventory.gold || 0) < GUILD_CREATION_COST) {
                    return sock.sendMessage(msg.key.remoteJid, { text: `Anda membutuhkan ${GUILD_CREATION_COST} Gold untuk membuat guild.` }, { quoted: msg });
                }

                // Kurangi gold user
                user.inventory.gold -= GUILD_CREATION_COST;

                const guildId = uuidv4();
                user.guildId = guildId;

                // Inisialisasi data guild baru di db.guilds
                db.guilds = db.guilds || {};
                db.guilds[guildId] = {
                    name: guildName,
                    leaderId: sender,
                    members: [sender],
                    treasury: 0,
                    level: 1,
                    createdAt: Date.now(),
                    groupId: msg.key.remoteJid // Simpan ID grup tempat guild dibuat
                };

                db.users[sender] = user;
                await writeDB(db);

                return sock.sendMessage(msg.key.remoteJid, { text: `Guild *${guildName}* berhasil didirikan! Anda adalah pemimpinnya.` }, { quoted: msg });

            case 'exchange':
                if (!user.guildId) return sock.sendMessage(msg.key.remoteJid, { text: 'Anda harus bergabung dengan guild untuk menukar material.' }, { quoted: msg });
                
                const userCores = user.inventory.monster_core || 0;
                if (userCores <= 0) return sock.sendMessage(msg.key.remoteJid, { text: 'Anda tidak memiliki Monster Core untuk ditukar.' }, { quoted: msg });
                
                const amountToExchange = args[1]?.toLowerCase() === 'all' ? userCores : parseInt(args[1]);

                if (isNaN(amountToExchange) || amountToExchange <= 0) {
                     return sock.sendMessage(msg.key.remoteJid, { text: `Jumlah tidak valid. Gunakan .guild exchange <jumlah> atau .guild exchange all` }, { quoted: msg });
                }
                if (userCores < amountToExchange) {
                     return sock.sendMessage(msg.key.remoteJid, { text: `Anda hanya memiliki ${userCores} Monster Core.` }, { quoted: msg });
                }

                const goldEarned = EXCHANGE_RATE_MONSTER_CORE * amountToExchange;
                const guildTax = Math.floor(goldEarned * 0.1); // Pajak guild 10%
                const netGold = goldEarned - guildTax;

                // Proses transaksi
                user.inventory.monster_core -= amountToExchange;
                user.inventory.gold = (user.inventory.gold || 0) + netGold;
                db.guilds[user.guildId].treasury += guildTax;

                db.users[sender] = user;
                await writeDB(db);

                return sock.sendMessage(msg.key.remoteJid, { text: `*Transaksi Guild Berhasil*\n\n› Ditukar: ${amountToExchange} Monster Core\n› Gold Diterima: ${netGold} Gold\n› Pajak Guild (10%): ${guildTax} Gold` }, { quoted: msg });
            
            // Sub-command lain bisa ditambahkan di sini (info, join, leave, dll.)

            default:
                return sock.sendMessage(msg.key.remoteJid, { text: `Gunakan:\n› *${prefix}guild create <nama>*\n› *${prefix}guild exchange <jumlah|all>*` }, { quoted: msg });
        }
    }
};