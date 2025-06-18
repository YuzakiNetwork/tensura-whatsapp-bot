import { writeDB } from './database.js';

// Konfigurasi jalur evolusi tetap sama
const evolutionPaths = {
  'Goblin': { level: 20, to: 'Hobgoblin', statBonus: { health: 100, mana: 50, attack: 15, defense: 10 }, newSkills: ['Leadership'] },
  'Hobgoblin': { level: 40, to: 'Ogre', statBonus: { health: 250, mana: 100, attack: 30, defense: 25 }, newSkills: ['Ogre Strength'] },
  'Ogre': { level: 60, to: 'Kijin', statBonus: { health: 500, mana: 300, attack: 50, defense: 40 }, newSkills: ['Magic Sense', 'Battlewill'] },
  'Slime': { level: 50, to: 'Demon Slime', statBonus: { health: 1000, mana: 1000, attack: 35, defense: 50 }, newSkills: ['Great Sage', 'Predator'] },
  'Lizardman': { level: 35, to: 'Dragonewt', statBonus: { health: 300, mana: 150, attack: 35, defense: 30 }, newSkills: ['Dragon Scales', 'Flight'] },
  'Direwolf': { level: 30, to: 'Tempest Wolf', statBonus: { health: 200, mana: 100, attack: 40, defense: 20 }, newSkills: ['Black Lightning'] }
};

// Fungsi ini sekarang lebih sebagai fungsi internal yang dipanggil oleh grantExp
function checkLevelUp(user) {
  let levelUp = false;
  let originalLevel = user.level;
  
  while (user.exp >= user.maxExp) {
    levelUp = true;
    user.level++;
    user.exp -= user.maxExp;
    user.maxHealth += Math.floor(user.maxHealth * 0.1);
    user.maxMana += Math.floor(user.maxMana * 0.05);
    user.attack += Math.floor(user.attack * 0.05) + 2;
    user.defense += Math.floor(user.defense * 0.05) + 2;
    user.health = user.maxHealth;
    user.mana = user.maxMana;
    user.maxExp = Math.floor(user.maxExp * 1.5);
  }
  return { user, levelUp, originalLevel };
}

// Fungsi ini juga menjadi fungsi internal
async function checkEvolution(user, sock, msg) {
  const evolutionData = evolutionPaths[user.race];
  
  if (evolutionData && user.level >= evolutionData.level) {
    const oldRace = user.race;
    const newRace = evolutionData.to;
    user.race = newRace;
    user.maxHealth += evolutionData.statBonus.health;
    user.health = user.maxHealth;
    user.maxMana += evolutionData.statBonus.mana;
    user.mana = user.maxMana;
    user.attack += evolutionData.statBonus.attack;
    user.defense += evolutionData.statBonus.defense;
    if (evolutionData.newSkills) user.skills.push(...evolutionData.newSkills);
    
    const evolutionMessage = `EVOLUSI RAS!\n\nSelamat, *${user.name}*! Anda telah berevolusi!\n\n*${oldRace}*  進化  ►►►  *${newRace}*\n\nKekuatan baru telah bangkit. Gunakan *.profile* untuk melihatnya!`;
    await sock.sendMessage(msg.key.remoteJid, { text: evolutionMessage.trim() }, { quoted: msg });
  }
  return user;
}


/**
 * Fungsi terpusat untuk memberikan EXP dan menangani event level-up/evolusi.
 * @param {object} user - Objek data pemain dari database.
 * @param {number} expGained - Jumlah EXP yang diberikan.
 * @param {object} sock - Objek socket Baileys.
 * @param {object} msg - Objek pesan Baileys.
 * @returns {Promise<{user: object, notification: string}>} - Objek berisi data user yang diperbarui dan pesan notifikasi event.
 */
export async function grantExp(user, expGained, sock, msg) {
  user.exp += expGained;
  let notification = '';
  
  // 1. Cek kenaikan level
  const { user: userAfterLevelUp, levelUp, originalLevel } = checkLevelUp(user);
  let updatedUser = userAfterLevelUp;
  
  // 2. Jika naik level, buat notifikasi dan cek evolusi
  if (levelUp) {
    notification = `\n\n*LEVEL UP!* Selamat, Anda naik dari Lv. ${originalLevel} ke *Lv. ${updatedUser.level}*!`;
    
    // Panggil fungsi evolusi
    updatedUser = await checkEvolution(updatedUser, sock, msg);
  }
  
  return { user: updatedUser, notification };
}