/**
 * Advanced Memory Management System
 * Handles memory loading/saving for DMs and servers with separated context
 */
const fs = require('fs');
const path = require('path');
const settings = require('../settings');

// Base memory folder
const MEMORY_ROOT = path.join(process.cwd(), 'memory');
const SERVERS_ROOT = path.join(process.cwd(), 'servers');

/**
 * Ensure a directory exists
 * @param {string} dirPath - Path to check/create
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Create default memory structure
 * @returns {Object} - Default memory object
 */
function createDefaultMemory() {
  return {
    facts: [],
    trustLevel: 5,
    romanticLevel: 0,
    censorshipLevel: 8,
    mood: "neutral",
    energy: "normal"
  };
}

/**
 * Create default chat history structure
 * @returns {Array} - Default chat array
 */
function createDefaultChat() {
  return [];
}

/**
 * Load memory data for a user in DM context
 * @param {string} botRole - AI character role
 * @param {string} userId - Discord user ID
 * @returns {Object} - User memory object
 */
function loadDMMemory(botRole, userId) {
  const memoryDir = path.join(MEMORY_ROOT, botRole, userId);
  const memoryPath = path.join(memoryDir, 'memory.json');
  
  ensureDirectoryExists(memoryDir);
  
  if (fs.existsSync(memoryPath)) {
    try {
      return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    } catch (err) {
      console.error(`Error loading memory for ${userId}:`, err.message);
      return createDefaultMemory();
    }
  }
  
  return createDefaultMemory();
}

/**
 * Load chat history for a user in DM context
 * @param {string} botRole - AI character role
 * @param {string} userId - Discord user ID
 * @returns {Array} - User chat history
 */
function loadDMChat(botRole, userId) {
  const chatDir = path.join(MEMORY_ROOT, botRole, userId);
  const chatPath = path.join(chatDir, 'chat.json');
  
  ensureDirectoryExists(chatDir);
  
  if (fs.existsSync(chatPath)) {
    try {
      return JSON.parse(fs.readFileSync(chatPath, 'utf8'));
    } catch (err) {
      console.error(`Error loading chat for ${userId}:`, err.message);
      return createDefaultChat();
    }
  }
  
  return createDefaultChat();
}

/**
 * Load server-specific memory for a user
 * @param {string} botRole - AI character role
 * @param {string} userId - Discord user ID
 * @param {string} serverId - Discord server ID
 * @returns {Object} - User's server-specific memory
 */
function loadServerUserMemory(botRole, userId, serverId) {
  const memoryDir = path.join(MEMORY_ROOT, botRole, userId, 'servers', serverId);
  const memoryPath = path.join(memoryDir, 'memory.json');
  
  ensureDirectoryExists(memoryDir);
  
  if (fs.existsSync(memoryPath)) {
    try {
      return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    } catch (err) {
      console.error(`Error loading server memory for ${userId} in ${serverId}:`, err.message);
      return createDefaultMemory();
    }
  }
  
  return createDefaultMemory();
}

/**
 * Load chat history for a user in a specific server
 * @param {string} botRole - AI character role
 * @param {string} userId - Discord user ID
 * @param {string} serverId - Discord server ID
 * @returns {Array} - User's server-specific chat history
 */
function loadServerUserChat(botRole, userId, serverId) {
  const chatDir = path.join(MEMORY_ROOT, botRole, userId, 'servers', serverId);
  const chatPath = path.join(chatDir, 'chat.json');
  
  ensureDirectoryExists(chatDir);
  
  if (fs.existsSync(chatPath)) {
    try {
      return JSON.parse(fs.readFileSync(chatPath, 'utf8'));
    } catch (err) {
      console.error(`Error loading server chat for ${userId} in ${serverId}:`, err.message);
      return createDefaultChat();
    }
  }
  
  return createDefaultChat();
}

/**
 * Load global server memory (shared across all users)
 * @param {string} serverId - Discord server ID
 * @returns {Object} - Server-wide memory
 */
function loadServerMemory(serverId) {
  const memoryDir = path.join(SERVERS_ROOT, serverId);
  const memoryPath = path.join(memoryDir, 'memory.json');
  
  ensureDirectoryExists(memoryDir);
  
  if (fs.existsSync(memoryPath)) {
    try {
      return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    } catch (err) {
      console.error(`Error loading server memory for ${serverId}:`, err.message);
      return { facts: [], mood: "neutral", energy: "normal" };
    }
  }
  
  return { facts: [], mood: "neutral", energy: "normal" };
}

/**
 * Load global server chat history
 * @param {string} serverId - Discord server ID
 * @returns {Array} - Server-wide chat history
 */
function loadServerChat(serverId) {
  const chatDir = path.join(SERVERS_ROOT, serverId);
  const chatPath = path.join(chatDir, 'chat.json');
  
  ensureDirectoryExists(chatDir);
  
  if (fs.existsSync(chatPath)) {
    try {
      return JSON.parse(fs.readFileSync(chatPath, 'utf8'));
    } catch (err) {
      console.error(`Error loading server chat for ${serverId}:`, err.message);
      return createDefaultChat();
    }
  }
  
  return createDefaultChat();
}

/**
 * Save memory data for a user in DM context
 * @param {string} botRole - AI character role
 * @param {string} userId - Discord user ID
 * @param {Object} memory - Memory data to save
 */
function saveDMMemory(botRole, userId, memory) {
  const memoryDir = path.join(MEMORY_ROOT, botRole, userId);
  const memoryPath = path.join(memoryDir, 'memory.json');
  
  ensureDirectoryExists(memoryDir);
  
  try {
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
  } catch (err) {
    console.error(`Error saving memory for ${userId}:`, err.message);
  }
}

/**
 * Save chat history for a user in DM context
 * @param {string} botRole - AI character role
 * @param {string} userId - Discord user ID
 * @param {Array} chat - Chat history to save
 */
function saveDMChat(botRole, userId, chat) {
  const chatDir = path.join(MEMORY_ROOT, botRole, userId);
  const chatPath = path.join(chatDir, 'chat.json');
  
  ensureDirectoryExists(chatDir);
  
  try {
    fs.writeFileSync(chatPath, JSON.stringify(chat, null, 2));
  } catch (err) {
    console.error(`Error saving chat for ${userId}:`, err.message);
  }
}

/**
 * Save server-specific memory for a user
 * @param {string} botRole - AI character role
 * @param {string} userId - Discord user ID
 * @param {string} serverId - Discord server ID
 * @param {Object} memory - Memory data to save
 */
function saveServerUserMemory(botRole, userId, serverId, memory) {
  const memoryDir = path.join(MEMORY_ROOT, botRole, userId, 'servers', serverId);
  const memoryPath = path.join(memoryDir, 'memory.json');
  
  ensureDirectoryExists(memoryDir);
  
  try {
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
  } catch (err) {
    console.error(`Error saving server memory for ${userId} in ${serverId}:`, err.message);
  }
}

/**
 * Save chat history for a user in a specific server
 * @param {string} botRole - AI character role
 * @param {string} userId - Discord user ID
 * @param {string} serverId - Discord server ID
 * @param {Array} chat - Chat history to save
 */
function saveServerUserChat(botRole, userId, serverId, chat) {
  const chatDir = path.join(MEMORY_ROOT, botRole, userId, 'servers', serverId);
  const chatPath = path.join(chatDir, 'chat.json');
  
  ensureDirectoryExists(chatDir);
  
  try {
    fs.writeFileSync(chatPath, JSON.stringify(chat, null, 2));
  } catch (err) {
    console.error(`Error saving server chat for ${userId} in ${serverId}:`, err.message);
  }
}

/**
 * Save global server memory
 * @param {string} serverId - Discord server ID
 * @param {Object} memory - Memory data to save
 */
function saveServerMemory(serverId, memory) {
  const memoryDir = path.join(SERVERS_ROOT, serverId);
  const memoryPath = path.join(memoryDir, 'memory.json');
  
  ensureDirectoryExists(memoryDir);
  
  try {
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
  } catch (err) {
    console.error(`Error saving server memory for ${serverId}:`, err.message);
  }
}

/**
 * Save global server chat history
 * @param {string} serverId - Discord server ID
 * @param {Array} chat - Chat history to save
 */
function saveServerChat(serverId, chat) {
  const chatDir = path.join(SERVERS_ROOT, serverId);
  const chatPath = path.join(chatDir, 'chat.json');
  
  ensureDirectoryExists(chatDir);
  
  try {
    fs.writeFileSync(chatPath, JSON.stringify(chat, null, 2));
  } catch (err) {
    console.error(`Error saving server chat for ${serverId}:`, err.message);
  }
}

/**
 * Get combined memory context for prompt generation
 * @param {string} botRole - AI character role
 * @param {string} userId - Discord user ID
 * @param {string} serverId - Discord server ID (null for DMs)
 * @param {string} mentionedServer - Server mentioned in DM (null if none)
 * @returns {Object} - Combined memory context for AI prompt
 */
function getCombinedPromptMemory(botRole, userId, serverId = null, mentionedServer = null) {
  let combinedMemory = {
    personalFacts: [],
    serverUserFacts: [],
    serverGlobalFacts: [],
    trustLevel: 5,
    romanticLevel: 0,
    censorshipLevel: 8,
    userMood: "neutral",
    userEnergy: "normal",
    serverMood: "neutral",
    serverEnergy: "normal"
  };
  
  // Load DM memory if in DM context
  if (!serverId) {
    const dmMemory = loadDMMemory(botRole, userId);
    combinedMemory.personalFacts = dmMemory.facts || [];
    combinedMemory.trustLevel = dmMemory.trustLevel || 5;
    combinedMemory.romanticLevel = dmMemory.romanticLevel || 0;
    combinedMemory.censorshipLevel = dmMemory.censorshipLevel || 8;
    combinedMemory.userMood = dmMemory.mood || "neutral";
    combinedMemory.userEnergy = dmMemory.energy || "normal";
  }
  
  // Load server-specific user memory if in server or mentioned in DM
  const targetServerId = serverId || mentionedServer;
  if (targetServerId) {
    const serverUserMemory = loadServerUserMemory(botRole, userId, targetServerId);
    combinedMemory.serverUserFacts = serverUserMemory.facts || [];
    
    // In servers, use server-specific trust levels
    if (serverId) {
      combinedMemory.trustLevel = serverUserMemory.trustLevel || 5;
      combinedMemory.romanticLevel = serverUserMemory.romanticLevel || 0;
      combinedMemory.censorshipLevel = serverUserMemory.censorshipLevel || 8;
      combinedMemory.userMood = serverUserMemory.mood || "neutral";
      combinedMemory.userEnergy = serverUserMemory.energy || "normal";
    }
    
    // Load server global memory
    const serverMemory = loadServerMemory(targetServerId);
    combinedMemory.serverGlobalFacts = serverMemory.facts || [];
    combinedMemory.serverMood = serverMemory.mood || "neutral";
    combinedMemory.serverEnergy = serverMemory.energy || "normal";
  }
  
  return combinedMemory;
}

/**
 * Update AI's mood based on interactions and fatigue
 * @param {string} botRole - The bot character role
 * @returns {Object} - Updated mood and energy
 */
function updateAIMood(botRole) {
    let aiMood = getAIMood(botRole);
    
    // Return current mood
    return aiMood;
}

/**
 * Get the AI's current mood
 * @param {string} botRole - The bot character role
 * @returns {Object} - Current mood {mood, energy}
 */
function getAIMood(botRole) {
    try {
        const moodPath = path.join('memory', botRole, 'ai_mood.json');
        
        if (fs.existsSync(moodPath)) {
            const moodData = JSON.parse(fs.readFileSync(moodPath, 'utf8'));
            return {
                mood: moodData.mood || 'neutral',
                energy: moodData.energy || 'normal'
            };
        }
    } catch (err) {
        console.error('Error loading AI mood:', err.message);
    }
    
    // Default mood if no file exists
    return {
        mood: 'neutral',
        energy: 'normal'
    };
}

/**
 * Set the AI's mood
 * @param {string} botRole - The bot character role
 * @param {Object} moodData - Mood data {mood, energy}
 */
function setAIMood(botRole, moodData) {
    try {
        ensureDirectoryExists(path.join('memory', botRole));
        const moodPath = path.join('memory', botRole, 'ai_mood.json');
        
        // Get existing mood if available
        let currentMood = { mood: 'neutral', energy: 'normal' };
        if (fs.existsSync(moodPath)) {
            currentMood = JSON.parse(fs.readFileSync(moodPath, 'utf8'));
        }
        
        // Update with new values
        const newMood = {
            ...currentMood,
            mood: moodData.mood || currentMood.mood,
            energy: moodData.energy || currentMood.energy,
            lastUpdated: Date.now()
        };
        
        // Save updated mood
        fs.writeFileSync(moodPath, JSON.stringify(newMood, null, 2));
        
        console.log(`AI mood updated to: ${newMood.mood}, energy: ${newMood.energy}`);
        return newMood;
    } catch (err) {
        console.error('Error saving AI mood:', err.message);
        return { mood: 'neutral', energy: 'normal' };
    }
}

/**
 * Check if bot should respond based on trust level and mention
 * @param {number} trustLevel - User's trust level
 * @param {boolean} isMentioned - Whether bot is mentioned
 * @returns {boolean} - True if bot should respond
 */
function shouldBotRespond(trustLevel, isMentioned) {
  // Always respond if directly mentioned
  if (isMentioned) return true;
  
  // High trust = more likely to respond without being mentioned
  if (trustLevel >= 8) return Math.random() < 0.8;
  if (trustLevel >= 6) return Math.random() < 0.5;
  if (trustLevel >= 4) return Math.random() < 0.2;
  
  // Low trust = rarely respond without being mentioned
  return Math.random() < 0.05;
}

/**
 * Decide if the bot should ignore this message for natural behavior
 * @param {Object} memory - User memory
 * @returns {boolean} - True if the message should be ignored
 */
function shouldIgnoreMessage(memory) {
  const trustLevel = memory.trustLevel || 5;
  const energy = memory.energy || "normal";
  
  // Random chance to ignore based on trust and energy
  if (energy === "tired" || energy === "sleepy") {
    return Math.random() < 0.3; // 30% chance to ignore when tired
  }
  
  if (trustLevel < 3) {
    return Math.random() < 0.4; // 40% chance to ignore low trust users
  }
  
  // Default small chance to ignore for realism
  return Math.random() < 0.1; // 10% chance to ignore generally
}

// Compatibility with existing codebase
module.exports = {
  // Original memory functions (renamed for compatibility)
  loadChat: loadDMChat,
  saveChat: saveDMChat,
  loadMemory: loadDMMemory,
  saveMemory: saveDMMemory,
  
  // New functions
  loadDMChat,
  saveDMChat,
  loadDMMemory,
  saveDMMemory,
  loadServerUserMemory,
  saveServerUserMemory,
  loadServerUserChat,
  saveServerUserChat,
  loadServerMemory,
  saveServerMemory,
  loadServerChat,
  saveServerChat,
  getCombinedPromptMemory,
  updateAIMood,
  shouldBotRespond,
  shouldIgnoreMessage,
  getAIMood,
  setAIMood,
  
  // Helper functions
  ensureDirectoryExists,
  createDefaultMemory,
  createDefaultChat
}; 