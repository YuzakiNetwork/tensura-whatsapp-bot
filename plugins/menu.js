export default {
    name: 'Menu',
    command: ['menu', 'help'],
    prefix: true,
    category: 'main',
    description: 'Menampilkan menu perintah yang tersedia.',
    async execute(msg, { sock, args, commands, prefix, settings }) {
        const botName = settings.botName;
        const senderName = msg.pushName || 'Petualang';
        
        const categories = {};
        commands.forEach(cmd => {
            if (!categories[cmd.category]) {
                categories[cmd.category] = [];
            }
            if (cmd.command[0] === commands.get(cmd.command[0]).command[0]) {
                categories[cmd.category].push(cmd);
            }
        });
        
        const requestedCategory = args[0]?.toLowerCase();
        let menuText = `Halo *${senderName}*!\nSelamat datang di *${botName}*.\n\n`;
        
        if (requestedCategory && categories[requestedCategory]) {
            menuText += `*Kategori: ${requestedCategory.toUpperCase()}*\n\n`;
            categories[requestedCategory].forEach(cmd => {
                menuText += `› *${prefix}${cmd.command[0]}*\n  _${cmd.description || 'Tidak ada deskripsi'}_ \n\n`;
            });
        } else if (requestedCategory === 'all') {
            Object.keys(categories).sort().forEach(category => {
                menuText += `╭─「 *${category.toUpperCase()}* 」\n`;
                menuText += categories[category].map(cmd => `│ › ${prefix}${cmd.command[0]}`).join('\n');
                menuText += `\n╰────\n\n`;
            });
            menuText += `_Ketik ${prefix}menu <kategori> untuk detail._`;
        } else {
            menuText += `Berikut adalah daftar kategori perintah:\n\n`;
            Object.keys(categories).sort().forEach(category => {
                menuText += `› *${category.toUpperCase()}*\n`;
            });
            menuText += `\nKetik *${prefix}menu all* untuk melihat semua perintah.`;
        }
        
        await sock.sendMessage(msg.key.remoteJid, { text: menuText.trim() }, { quoted: msg });
    }
};