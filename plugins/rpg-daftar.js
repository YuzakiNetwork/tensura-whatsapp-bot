import { readDB, writeDB } from '../lib/database.js';

const raceBaseStats = {
    slime: { health: 150, maxHealth: 150, mana: 100, maxMana: 100, attack: 5, defense: 20, skills: ['Water Blade'] },
    goblin: { health: 80, maxHealth: 80, mana: 30, maxMana: 30, attack: 12, defense: 8, skills: ['Club Bash'] },
    ogre: { health: 120, maxHealth: 120, mana: 20, maxMana: 20, attack: 18, defense: 15, skills: ['Heavy Swing'] },
    direwolf: { health: 90, maxHealth: 90, mana: 40, maxMana: 40, attack: 15, defense: 10, skills: ['Claw Attack', 'Howl'] },
    lizardman: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, attack: 10, defense: 12, skills: ['Spear Thrust'] },
    dwarf: { health: 110, maxHealth: 110, mana: 25, maxMana: 25, attack: 14, defense: 18, skills: ['Hammer Smash', 'Crafting'] },
    manusia: { health: 100, maxHealth: 100, mana: 20, maxMana: 20, attack: 10, defense: 10, skills: ['Sword Slash'], evolution: false } // Ras baru, tidak bisa evolusi
};

export default {
    name: 'Daftar RPG',
    command: ['daftar', 'register'],
    prefix: true,
    category: 'rpg',
    description: 'Mendaftar untuk memulai petualangan. Format: .daftar Nama.Ras',
    cooldown: 60,
    async execute(msg, { sock, args, sender, prefix }) {
        const db = await readDB();

        if (db.users[sender] && db.users[sender].registered) {
            return sock.sendMessage(msg.key.remoteJid, { text: `Anda sudah terdaftar. Gunakan *${prefix}unreg* untuk menghapus data petualangan Anda terlebih dahulu.` }, { quoted: msg });
        }

        const input = args.join(' ');
        if (!input.includes('.')) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: `Format pendaftaran salah.\nGunakan: *${prefix}daftar Nama.Ras*\n\nContoh: *${prefix}daftar Rimuru.Slime*\n\nRas yang tersedia: *${Object.keys(raceBaseStats).join(', ')}*`
            }, { quoted: msg });
        }

        const [name, race] = input.split('.').map(s => s.trim());
        const lowerCaseRace = race?.toLowerCase();

        if (!name || !race) {
            return sock.sendMessage(msg.key.remoteJid, { text: 'Nama dan Ras tidak boleh kosong.' }, { quoted: msg });
        }
        
        if (!raceBaseStats[lowerCaseRace]) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: `Ras "${race}" tidak ditemukan.\nRas yang tersedia: *${Object.keys(raceBaseStats).join(', ')}*`
            }, { quoted: msg });
        }
        
        const baseStats = raceBaseStats[lowerCaseRace];
        const capitalizedRace = lowerCaseRace.charAt(0).toUpperCase() + lowerCaseRace.slice(1);

        db.users[sender] = {
            name: name,
            race: capitalizedRace,
            rank: "Normal", level: 1, exp: 0, maxExp: 100, ...baseStats,
            uniqueSkills: [], ultimateSkills: [],
            inventory: { potion: 5, magicrystal: 10, gold: 100, diamond: 0 },
            guildId: null, registered: true, registerTime: Date.now()
        };

        await writeDB(db);

        const welcomeMessage = `*Pendaftaran Berhasil!*\n\nSelamat datang di dunia baru, wahai jiwa yang bereinkarnasi!\n\n*Nama:* ${name}\n*Ras:* ${capitalizedRace}\n\nPerjalananmu dimulai sekarang. Gunakan *${prefix}profile* untuk melihat status.`;
        await sock.sendMessage(msg.key.remoteJid, { text: welcomeMessage }, { quoted: msg });
    }
};