export default {
    name: 'Menu',
    command: ['menu', 'help'],
    permissions: 'all',
    hidden: false,
    category: 'main',
    cooldown: 5,
    description: 'Menampilkan menu perintah yang tersedia.',
    async execute(m) {
        const { commands, prefix, settings, args } = m;
        const botName = settings.botName;
        const senderName = m.msg.pushName || 'Petualang';
        
        const categories = {};
        const processedCommands = new Set();
        
        commands.forEach(plugin => {
            if (plugin.hidden || processedCommands.has(plugin.command[0])) {
                return;
            }
            if (!categories[plugin.category]) {
                categories[plugin.category] = [];
            }
            categories[plugin.category].push(plugin);
            processedCommands.add(plugin.command[0]);
        });
        
        const requestedCategory = args[0]?.toLowerCase();
        let menuText = `Halo *${senderName}*!\nSelamat datang di *${botName}*.\n\n`;
        
        if (requestedCategory && categories[requestedCategory]) {
            menuText += `*Kategori: ${requestedCategory.toUpperCase()}*\n\n`;
            categories[requestedCategory].forEach(cmd => {
                menuText += `› *${prefix}${cmd.command[0]}*\n  _${cmd.description || 'Tidak ada deskripsi'}_ \n\n`;
            });
        } else if (requestedCategory === 'all') {
            menuText += `Berikut adalah semua perintah yang tersedia:\n\n`;
            Object.keys(categories).sort().forEach(category => {
                menuText += `╭─「 *${category.toUpperCase()}* 」\n`;
                const commandList = categories[category].map(cmd => `│ › ${prefix}${cmd.command[0]}`).join('\n');
                menuText += `${commandList}\n`;
                menuText += `╰────\n\n`;
            });
            menuText += `_Ketik ${prefix}menu <kategori> untuk detail._`;
        } else {
            menuText += `Berikut adalah daftar kategori perintah yang tersedia:\n\n`;
            Object.keys(categories).sort().forEach(category => {
                menuText += `› *${category.toUpperCase()}*\n`;
            });
            menuText += `\nKetik *${prefix}menu all* untuk melihat semua perintah atau *${prefix}menu <kategori>* untuk detail spesifik.`;
        }
        
        await m.reply(menuText.trim());
    }
};