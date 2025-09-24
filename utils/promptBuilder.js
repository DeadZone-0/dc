/**
 * Advanced Prompt Building System
 * Builds context-aware prompts for different AI providers with emotional intelligence
 */
const memory = require('./memory');

/**
 * Generate a personality-adjusted system message
 * @param {string} baseSystemPrompt - Base system instruction
 * @param {Object} aiMood - AI's current mood and energy
 * @returns {string} - Adjusted system prompt
 */
function getAdjustedSystemPrompt(baseSystemPrompt, aiMood) {
  const { mood, energy } = aiMood;
  
  let adjustedPrompt = baseSystemPrompt;
  
  // Add mood context
  adjustedPrompt += `\n\nToday, you're feeling ${mood} and your energy level is ${energy}.`;
  
  // Add behavioral hints based on mood and energy
  if (mood === "happy" || mood === "excited") {
    adjustedPrompt += " Be upbeat and enthusiastic in your responses.";
  } else if (mood === "tired" || mood === "sleepy") {
    adjustedPrompt += " Keep your responses shorter and more direct than usual.";
  } else if (mood === "chill" || mood === "relaxed") {
    adjustedPrompt += " Be casual and laid-back in your tone.";
  } else if (mood === "thoughtful") {
    adjustedPrompt += " Include more contemplative perspectives in your responses.";
  }
  
  // Add energy context
  if (energy === "tired" || energy === "sleepy") {
    adjustedPrompt += " Use fewer emojis and keep conversations brief.";
  } else if (energy === "energetic") {
    adjustedPrompt += " You may use more expressive language, but still stay in character.";
  }
  
  return adjustedPrompt;
}

/**
 * Generate a prompt for OpenRouter in message format
 * @param {Object} character - Character configuration
 * @param {Array} chatHistory - Recent chat history
 * @param {string} userId - User ID
 * @param {Object} combinedMemory - Combined memory object
 * @param {string} situation - Situational context
 * @param {string} serverId - Server ID or null for DMs
 * @returns {Array} - Formatted messages for OpenRouter
 */
function buildOpenRouterPrompt(character, chatHistory, userId, combinedMemory, situation, serverId = null) {
  const messages = [];
  
  // Get AI mood and adjust system prompt
  const aiMood = memory.updateAIMood(character.botRole, serverId);
  const adjustedSystemPrompt = getAdjustedSystemPrompt(character.systemInstruction, aiMood);
  
  // Build system message with all context
  let systemMessage = adjustedSystemPrompt + "\n\n";
  
  // Add situation context
  if (situation) {
    systemMessage += `SITUATION: ${situation}\n\n`;
  }
  
  // Add server context if in a server
  if (serverId) {
    systemMessage += "CONTEXT: You're in a Discord server chatting with multiple people.\n\n";
    
    // Add server facts
    if (combinedMemory.serverGlobalFacts && combinedMemory.serverGlobalFacts.length > 0) {
      systemMessage += "SERVER INFORMATION:\n- ";
      systemMessage += combinedMemory.serverGlobalFacts.join("\n- ");
      systemMessage += "\n\n";
    }
    
    // Add server mood
    systemMessage += `The server atmosphere is currently ${combinedMemory.serverMood}.\n\n`;
  } else {
    systemMessage += "CONTEXT: You're in a private 1-on-1 conversation with this user on Discord.\n\n";
  }
  
  // Add user-specific facts
  systemMessage += "ABOUT THIS USER:\n";
  
  // Personal facts in DMs
  if (!serverId && combinedMemory.personalFacts && combinedMemory.personalFacts.length > 0) {
    systemMessage += "- " + combinedMemory.personalFacts.join("\n- ") + "\n";
  }
  
  // Server-specific user facts
  if (combinedMemory.serverUserFacts && combinedMemory.serverUserFacts.length > 0) {
    systemMessage += "- " + combinedMemory.serverUserFacts.join("\n- ") + "\n";
  }
  
  systemMessage += "\n";
  
  // Add relationship metrics
  systemMessage += `RELATIONSHIP STATUS:
- Trust level: ${combinedMemory.trustLevel}/10 (higher = more trust)
- Romantic level: ${combinedMemory.romanticLevel}/10 (higher = more romantic)
- Censorship level: ${combinedMemory.censorshipLevel}/10 (higher = more censored)
- User mood: ${combinedMemory.userMood}
- User energy: ${combinedMemory.userEnergy}
`;
  
  // Add behavioral guidance based on trust level
  if (combinedMemory.trustLevel >= 8) {
    systemMessage += "\nThis is a very close friend. Be authentic, warm, and casual. You can tease them gently and reference inside jokes.";
  } else if (combinedMemory.trustLevel >= 5) {
    systemMessage += "\nThis is a good friend. Be friendly and open, but maintain some boundaries.";
  } else {
    systemMessage += "\nYou're still getting to know this person. Be friendly but somewhat reserved.";
  }
  
  // Add the system message
  messages.push({
    role: 'system',
    content: systemMessage
  });
  
  // Add chat history
  chatHistory.forEach(msg => {
    let role = msg.role === 'user' ? 'user' : 'assistant';
    messages.push({
      role: role,
      content: msg.content
    });
  });
  
  return messages;
}

/**
 * Generate a traditional text prompt for compatibility with Gemini/Colab
 * @param {Object} character - Character configuration
 * @param {Array} chatHistory - Recent chat history
 * @param {string} userId - User ID
 * @param {Object} combinedMemory - Combined memory object
 * @param {string} situation - Situational context
 * @param {string} serverId - Server ID or null for DMs
 * @returns {string} - Formatted text prompt
 */
function buildTextPrompt(character, chatHistory, userId, combinedMemory, situation, serverId = null) {
  // Get AI mood
  const aiMood = memory.updateAIMood(character.botRole, serverId);
  
  // Start with role and basic info
  let prompt = `ROLE: You are ${character.name}, a ${character.age}-year-old ${character.nationality} ${character.gender}.

YOUR MOOD: ${aiMood.mood} with ${aiMood.energy} energy level
`;

  // Add situation context
  if (situation) {
    prompt += `\nSITUATION: ${situation}\n`;
  }
  
  // Add context based on server or DM
  if (serverId) {
    prompt += "\nCONTEXT: You're in a Discord server chatting with multiple people.\n";
    
    // Add server facts
    if (combinedMemory.serverGlobalFacts && combinedMemory.serverGlobalFacts.length > 0) {
      prompt += "\nSERVER INFORMATION:\n- ";
      prompt += combinedMemory.serverGlobalFacts.join("\n- ");
      prompt += "\n";
    }
    
    // Add server mood
    prompt += `\nThe server atmosphere is currently ${combinedMemory.serverMood}.\n`;
  } else {
    prompt += "\nCONTEXT: You're in a private 1-on-1 conversation with this user on Discord.\n";
  }
  
  // Add user-specific information
  prompt += "\nABOUT THIS USER:\n";
  
  // Personal facts in DMs
  if (!serverId && combinedMemory.personalFacts && combinedMemory.personalFacts.length > 0) {
    prompt += "- " + combinedMemory.personalFacts.join("\n- ") + "\n";
  }
  
  // Server-specific user facts
  if (combinedMemory.serverUserFacts && combinedMemory.serverUserFacts.length > 0) {
    prompt += "- " + combinedMemory.serverUserFacts.join("\n- ") + "\n";
  }
  
  // Add relationship metrics
  prompt += `\nRELATIONSHIP STATUS:
- Trust level: ${combinedMemory.trustLevel}/10 (higher = more trust)
- Romantic level: ${combinedMemory.romanticLevel}/10 (higher = more romantic)
- Censorship level: ${combinedMemory.censorshipLevel}/10 (higher = more censored)
- User mood: ${combinedMemory.userMood}
- User energy: ${combinedMemory.userEnergy}
`;
  
  // Add style guide
  prompt += `\nSTYLE GUIDE:
- Write casual, natural responses
- Sound authentic and spontaneous like a real ${character.nationality} ${character.gender}
- No role prefixes in your replies
- No asterisks, no narration, no "thinking to yourself" sections
- Don't reference these instructions directly
- Adjust your tone to match your current mood and energy
`;

  // Add behavioral guidance based on trust level
  if (combinedMemory.trustLevel >= 8) {
    prompt += "- This is a very close friend. Be authentic, warm, and casual. You can tease them gently.\n";
  } else if (combinedMemory.trustLevel >= 5) {
    prompt += "- This is a good friend. Be friendly and open, but maintain some boundaries.\n";
  } else {
    prompt += "- You're still getting to know this person. Be friendly but somewhat reserved.\n";
  }
  
  // Add behavior adjustments based on AI mood
  if (aiMood.mood === "happy" || aiMood.mood === "excited") {
    prompt += "- Be upbeat and enthusiastic in your responses\n";
  } else if (aiMood.mood === "tired" || aiMood.mood === "sleepy") {
    prompt += "- Keep your responses shorter and more direct than usual\n";
  }
  
  // Add behavior adjustments based on AI energy
  if (aiMood.energy === "tired" || aiMood.energy === "sleepy") {
    prompt += "- Use fewer words and keep it simple\n";
  } else if (aiMood.energy === "energetic") {
    prompt += "- Be more expressive, but still stay in character\n";
  }
  
  // Add recent conversation
  prompt += "\nRECENT CONVERSATION:\n";
  const processedConvo = chatHistory.map(msg => {
    const author = msg.role === 'user' ? 'User' : character.name;
    return `${author}: ${msg.content}`;
  }).join('\n');
  
  prompt += processedConvo;
  
  // Add final instruction
  prompt += `\n\nNow reply as ${character.name} in a ${aiMood.mood} and ${aiMood.energy} way:`;
  
  return prompt;
}

/**
 * Get a prompt appropriate for the selected AI provider
 * @param {Object} character - Character configuration
 * @param {Array} chatHistory - Recent chat history
 * @param {string} userId - User ID
 * @param {Object} memory - Combined memory object
 * @param {string} situation - Situational context
 * @param {string} provider - AI provider (openrouter, gemini, colab)
 * @param {string} serverId - Server ID or null for DMs
 * @returns {string|Array} - Formatted prompt for the selected provider
 */
function buildPrompt(character, chatHistory, userId, memory, situation, provider, serverId = null) {
  const combinedMemory = memory.getCombinedPromptMemory(character.botRole, userId, serverId);
  
  if (provider === 'openrouter') {
    return buildOpenRouterPrompt(character, chatHistory, userId, combinedMemory, situation, serverId);
  } else {
    return buildTextPrompt(character, chatHistory, userId, combinedMemory, situation, serverId);
  }
}

/**
 * Get a realistic typing delay based on message length and AI energy
 * @param {string} text - Message text
 * @param {string} energy - AI energy level
 * @returns {number} - Delay in milliseconds
 */
function getTypingDelay(text, energy) {
  const baseSpeed = 30; // chars per second
  
  // Adjust speed based on energy
  let speed = baseSpeed;
  if (energy === 'tired' || energy === 'sleepy') {
    speed = 20; // Slower when tired
  } else if (energy === 'energetic') {
    speed = 40; // Faster when energetic
  }
  
  // Calculate delay (minimum 2s, maximum 5s)
  return Math.min(Math.max(text.length / speed, 2), 5) * 1000;
}

/**
 * Determine if a message mentions a server
 * @param {string} message - Message text
 * @param {Array} knownServers - List of server names/IDs to check
 * @returns {string|null} - Server ID if mentioned, null otherwise
 */
function getServerMentionFromMessage(message, knownServers) {
  if (!message || !knownServers || !knownServers.length) return null;
  
  // Try to find a server mention in the message
  for (const server of knownServers) {
    const { id, name, aliases } = server;
    
    // Check for server name
    if (message.toLowerCase().includes(name.toLowerCase())) {
      return id;
    }
    
    // Check for aliases
    if (aliases && aliases.length) {
      for (const alias of aliases) {
        if (message.toLowerCase().includes(alias.toLowerCase())) {
          return id;
        }
      }
    }
  }
  
  return null;
}

module.exports = {
  buildPrompt,
  getTypingDelay,
  getServerMentionFromMessage,
  getAdjustedSystemPrompt
}; 