export default {
    name: 'Ping',
    command: ['ping', 'p'],
    prefix: true,
    category: 'owner',
    description: 'Mengukur kecepatan respon bot. Hanya bisa digunakan oleh owner.',
    owner: true, // <-- Ditambahkan: Hanya owner yang bisa akses
    cooldown: 5, // <-- Ditambahkan: Cooldown 5 detik
    async execute(msg, { sock }) {
        const startTime = Date.now();
        const latency = startTime - (msg.messageTimestamp * 1000);
        
        await sock.sendMessage(msg.key.remoteJid, {
            text: `Pong! 🏓\nLatensi: ${latency} ms`
        }, { quoted: msg });
    }
};