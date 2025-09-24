/**
 * Advanced message handling system
 * Handles message batching, emotions, server context, and more
 */
const settings = require('../settings');
const memory = require('./memory');
const promptBuilder = require('./promptBuilder');

// Message buffer storage
const messageBuffers = {};

// Message counters for tracking AI fatigue
const messageCounters = {
  global: {
    hourly: 0,
    lastReset: Date.now()
  },
  servers: {}
};

// Track AI active/away status
const aiStatus = {
  isAway: false,
  awayReason: '',
  awayUntil: null
};

/**
 * Initialize message counter for a server
 * @param {string} serverId - Server ID
 */
function initServerCounter(serverId) {
  if (!messageCounters.servers[serverId]) {
    messageCounters.servers[serverId] = {
      hourly: 0,
      lastReset: Date.now()
    };
  }
}

/**
 * Check if a message contains bot keywords for trigger
 * @param {string} content - Message content
 * @param {Array} keywords - List of trigger keywords
 * @returns {boolean} - True if contains keyword
 */
function containsKeyword(content, keywords) {
  if (!content || !keywords || !keywords.length) return false;
  
  const lowerContent = content.toLowerCase();
  return keywords.some(keyword => lowerContent.includes(keyword.toLowerCase()));
}

/**
 * Check whether the bot should respond to a message
 * @param {Object} message - Discord message object
 * @param {Object} serverConfig - Server configuration
 * @param {Object} userMemory - User memory data
 * @returns {boolean} - True if the bot should respond
 */
function shouldRespondToMessage(message, serverConfig, userMemory) {
  // Don't respond if AI is in away status
  if (aiStatus.isAway && aiStatus.awayUntil && Date.now() < aiStatus.awayUntil) {
    console.log('Not responding due to away status');
    return false;
  }
  
  // Always respond in DMs - but with random ignore chance if enabled
  if (message.channel.type === 'DM') {
    console.log('Message is a DM, checking if should respond...');
    
    // In DMs, apply random ignore chance if enabled
    if (settings.ENABLE_RANDOM_IGNORE && memory.shouldIgnoreMessage(userMemory)) {
      console.log('Randomly ignoring DM for natural behavior');
      return false;
    }
    console.log('Responding to DM');
    return true;
  }
  
  // We're in a server now - check if it's configured
  if (!serverConfig) {
    console.log('Server is not configured, ignoring message');
    return false;
  }
  
  console.log(`Processing message in server "${serverConfig.name}" (${serverConfig.id})`);
  
  // Check if channel is in ignore list
  if (serverConfig.ignore_channels && 
      serverConfig.ignore_channels.includes(message.channel.name.toLowerCase())) {
    console.log(`Channel "${message.channel.name}" is in ignore list, not responding`);
    return false;
  }
  
  // Get trust level for response likelihood
  const trustLevel = userMemory ? userMemory.trustLevel || 5 : 5;
  
  // Check for direct mention of the bot
  const isMentioned = message.mentions && message.mentions.has && 
                     message.mentions.has(message.client.user.id);
  
  // Check for keyword triggers from the server config
  const hasKeywordTrigger = serverConfig.keyword_triggers && 
                           serverConfig.keyword_triggers.length > 0 && 
                           containsKeyword(message.content, serverConfig.keyword_triggers);
  
  // Check if message is a reply to the bot
  const isReplyToBot = message.reference && message.reference.messageId &&
                      message.channel.messages && message.channel.messages.cache &&
                      message.channel.messages.cache.has(message.reference.messageId) &&
                      message.channel.messages.cache.get(message.reference.messageId).author.id === message.client.user.id;
  
  // Combined trigger check - the bot was directly engaged
  const wasDirectlyEngaged = isMentioned || hasKeywordTrigger || isReplyToBot;
  
  // Log the trigger type for debugging
  if (isMentioned) console.log('Bot was mentioned');
  if (hasKeywordTrigger) console.log('Message contains trigger keyword');
  if (isReplyToBot) console.log('Message is a reply to the bot');
  
  if (serverConfig.respond_to_all) {
    // In respond-to-all mode, still use trust-based chance to reply for natural behavior
    const shouldRespond = memory.shouldBotRespond(trustLevel, wasDirectlyEngaged);
    console.log(`Server is in respond-to-all mode, ${shouldRespond ? 'responding' : 'not responding'} (trust: ${trustLevel})`);
    return shouldRespond;
  } else {
    // Only respond when directly engaged (mentioned, keyword, or reply)
    console.log(`Server requires direct engagement, ${wasDirectlyEngaged ? 'was engaged' : 'was not engaged'}`);
    return wasDirectlyEngaged;
  }
}

/**
 * Check if the AI should go into away status due to fatigue or time
 * @param {string} serverId - Server ID or null for global check
 * @returns {boolean} - True if AI should go away
 */
function shouldGoAway(serverId = null) {
  // Check time of day
  const now = new Date();
  const hour = now.getHours();
  
  // Outside active hours
  if (hour < settings.ACTIVE_HOURS_START || hour >= settings.ACTIVE_HOURS_END) {
    aiStatus.isAway = true;
    aiStatus.awayReason = 'time_to_sleep';
    aiStatus.awayUntil = new Date(now);
    aiStatus.awayUntil.setHours(settings.ACTIVE_HOURS_START);
    aiStatus.awayUntil.setMinutes(0);
    // If it's already past midnight, set to next day
    if (hour < settings.ACTIVE_HOURS_START) {
      aiStatus.awayUntil.setDate(aiStatus.awayUntil.getDate());
    } else {
      aiStatus.awayUntil.setDate(aiStatus.awayUntil.getDate() + 1);
    }
    return true;
  }
  
  // Check message fatigue
  let counter;
  if (serverId) {
    initServerCounter(serverId);
    counter = messageCounters.servers[serverId];
  } else {
    counter = messageCounters.global;
  }
  
  // Reset hourly counter if needed
  const hoursSinceReset = (Date.now() - counter.lastReset) / (1000 * 60 * 60);
  if (hoursSinceReset >= 1) {
    counter.hourly = 0;
    counter.lastReset = Date.now();
  }
  
  // Check if over message limit
  if (counter.hourly >= settings.MAX_MESSAGES_PER_HOUR) {
    aiStatus.isAway = true;
    aiStatus.awayReason = 'tired';
    aiStatus.awayUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    return true;
  }
  
  return false;
}

/**
 * Generate an away message based on reason and time
 * @param {string} reason - Reason for going away
 * @param {Date} until - When the AI will be back
 * @param {Object} character - Character configuration
 * @returns {string} - Away message
 */
function getAwayMessage(reason, until, character) {
  const timeToReturn = Math.ceil((until - Date.now()) / (1000 * 60));
  
  if (reason === 'time_to_sleep') {
    const options = [
      `I'm getting sleepy, gonna head to bed. Talk to you in the morning! 😴`,
      `It's my bedtime, catch you tomorrow!`,
      `Need to get some rest now. Message you later!`,
      `*yawns* Getting really tired, need to sleep. Ttyl!`
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else if (reason === 'tired') {
    const options = [
      `I need a quick break! I'll be back in about ${timeToReturn} minutes.`,
      `Gonna take a little breather for ${timeToReturn} mins. Talk soon!`,
      `Need to step away for a bit (~${timeToReturn} mins). BRB!`,
      `Taking a short break, message you in a bit!`
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else {
    return `I'll be back in a while!`;
  }
}

/**
 * Handle incoming message and decide what to do
 * @param {Object} message - Discord message
 * @param {Function} processFn - Function to call for processing
 * @param {Object} character - Character configuration
 */
function handleMessage(message, processFn, character) {
  // Skip bot messages
  if (message.author.bot) return;
  
  // Get server configuration if in a server
  const serverId = message.guild ? message.guild.id : null;
  let serverConfig = null;
  
  if (serverId && settings.ENABLE_SERVER_SUPPORT) {
    serverConfig = settings.ALLOWED_SERVERS.find(s => s.id === serverId);
    // Ignore if not in allowed servers
    if (!serverConfig) return;
  }
  
  // Load user memory (not as promise)
  let userMemory;
  if (serverId) {
    userMemory = memory.loadServerUserMemory(character.botRole, message.author.id, serverId);
  } else {
    userMemory = memory.loadDMMemory(character.botRole, message.author.id);
  }
  
  // Check if should respond
  if (!shouldRespondToMessage(message, serverConfig, userMemory)) {
    return;
  }
  
  // Check if AI should go away
  if (shouldGoAway(serverId)) {
    // Send away message then don't process further
    const awayMessage = getAwayMessage(aiStatus.awayReason, aiStatus.awayUntil, character);
    if (message.channel && typeof message.channel.send === 'function') {
      try {
        message.channel.send(awayMessage);
      } catch (err) {
        console.error('Error sending away message:', err.message);
      }
    }
    return;
  }
  
  // Buffer message for batching
  bufferMessage(message, processFn);
}

/**
 * Buffer a message for batching
 * @param {Object} message - Discord message
 * @param {Function} processFn - Function to call when processing
 */
function bufferMessage(message, processFn) {
  const userId = message.author.id;
  const serverId = message.guild ? message.guild.id : null;
  const channelId = message.channel.id;
  const bufferKey = `${userId}-${channelId}`;
  
  // Initialize buffer for this user/channel if it doesn't exist
  if (!messageBuffers[bufferKey]) {
    messageBuffers[bufferKey] = {
      messages: [],
      timer: null,
      serverId: serverId,
      startTime: Date.now()  // Track when we started collecting messages
    };
  }
  
  // Add message to buffer
  messageBuffers[bufferKey].messages.push(message);
  
  // Clear existing timeout if any
  if (messageBuffers[bufferKey].timer) {
    clearTimeout(messageBuffers[bufferKey].timer);
  }
  
  // Set a new timeout to process the messages
  messageBuffers[bufferKey].timer = setTimeout(() => {
    processBatchedMessages(bufferKey, processFn);
  }, settings.MESSAGE_BUFFER_TIMEOUT);
}

/**
 * Process a batch of messages
 * @param {string} bufferKey - Buffer key
 * @param {Function} processFn - Function to call with batched message
 */
function processBatchedMessages(bufferKey, processFn) {
  if (!messageBuffers[bufferKey]) return;
  
  const { messages, serverId } = messageBuffers[bufferKey];
  
  console.log(`Processing batched messages for key ${bufferKey}`);
  console.log(`Server ID from buffer: ${serverId || 'null (DM)'}`);
  console.log(`Number of messages in batch: ${messages.length}`);
  
  if (messages.length > 0) {
    // Get first message for metadata
    const firstMessage = messages[0];
    
    // Debug the first message to ensure server info is present
    console.log(`First message guild: ${firstMessage.guild ? firstMessage.guild.id : 'null'}`);
    console.log(`Message channel type: ${firstMessage.channel.type || 'unknown'}`);
    
    // Create combined content 
    const combinedContent = messages.map(m => m.content).join('\n');
    
    // Get the last message for attachments
    const lastMessage = messages[messages.length - 1];
    
    // Create a "fake" combined message
    const combinedMessage = {
      ...firstMessage,
      content: combinedContent,
      attachments: lastMessage.attachments,
      isBatched: messages.length > 1,
      originalMessages: messages,
      // Explicitly preserve channel reference
      channel: firstMessage.channel,
      // CRITICAL: Explicitly preserve server context
      guild: firstMessage.guild,
      // Add fallback serverId in case guild gets lost
      serverId: serverId
    };
    
    // Double check the combined message has server info
    if (combinedMessage.guild) {
      console.log(`✓ Batched message preserved guild: ${combinedMessage.guild.id}`);
    } else if (serverId) {
      console.log(`⚠️ Guild lost, but serverId preserved: ${serverId}`);
    } else {
      console.log(`ℹ️ No guild or serverId (probably DM)`);
    }
    
    // Process the combined message
    processFn(combinedMessage);
    
    // Clear the buffer
    delete messageBuffers[bufferKey];
  }
}

/**
 * Increment message counter after a response
 * @param {string} serverId - Server ID or null for global
 */
function incrementMessageCounter(serverId = null) {
  // Update global counter
  messageCounters.global.hourly++;
  
  // Update server counter if in a server
  if (serverId) {
    initServerCounter(serverId);
    messageCounters.servers[serverId].hourly++;
  }
}

/**
 * Reset the AI's away status
 */
function resetAwayStatus() {
  aiStatus.isAway = false;
  aiStatus.awayReason = '';
  aiStatus.awayUntil = null;
}

/**
 * Check if the AI's energy level is low based on message count
 * @param {string} serverId - Server ID or null for global
 * @returns {boolean} - True if energy is low
 */
function isEnergyLow(serverId = null) {
  const counter = serverId ? 
    (messageCounters.servers[serverId] || messageCounters.global) : 
    messageCounters.global;
  
  // Energy is low if over 80% of hourly limit
  return counter.hourly > (settings.MAX_MESSAGES_PER_HOUR * 0.8);
}

/**
 * Calculate realistic typing delay based on message
 * @param {string} text - Message text
 * @param {Object} character - Character configuration
 * @param {string} serverId - Server ID or null
 * @returns {number} - Delay in milliseconds
 */
function getRealisticTypingDelay(text, character, serverId = null) {
  // Check AI's energy level
  const energy = isEnergyLow(serverId) ? 'tired' : 'normal';
  
  // Get base delay from message length
  const baseDelay = promptBuilder.getTypingDelay(text, energy);
  
  // Add random variance (±20%)
  const variance = baseDelay * 0.2 * (Math.random() * 2 - 1);
  
  // Reduce delay for better perceived performance - cap at 2.5s max
  // Original formula: const finalDelay = Math.min(Math.max(baseDelay + variance, settings.MIN_TYPING_DELAY), settings.MAX_TYPING_DELAY);
  const calculatedDelay = Math.min(Math.max(baseDelay + variance, settings.MIN_TYPING_DELAY), settings.MAX_TYPING_DELAY);
  
  // Scale down the delay while preserving some variance (making short messages faster but keeping long messages somewhat delayed)
  return Math.min(calculatedDelay * 0.6, 2500);
}

module.exports = {
  handleMessage,
  incrementMessageCounter,
  resetAwayStatus,
  getRealisticTypingDelay,
  isEnergyLow,
  shouldGoAway
}; 