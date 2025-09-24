// --- Imports ---
const { Client, Intents } = require('discord.js-selfbot-v13');
const { io } = require('./dashboard/server');
const dashboard = require('./dashboard/server');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const memory = require('./utils/memory');
const { extractFactsAndRatings, extractGlobalFactsAndRatings } = require('./factExtractor');
const { getCharacter } = require('./characters');
const { askAI } = require('./ai');
const settings = require('./settings');
const axios = require('axios');
const messageHandler = require('./utils/messageHandler');
const promptBuilder = require('./utils/promptBuilder');

// Get character configuration
const character = getCharacter();

// --- Tokens & Client ---
const client = new Client();
// Use character-specific token if available
const DISCORD_TOKEN = character.token || process.env.DISCORD_TOKEN;
const messageBuffers = {};
const seenMessages = new Set();
let ALLOWED_USERS = ['940246394281795595','1257286620151812207','1257286620151812207'];

// Import memory utilities
// const updateMemory = require('./utils/memory').updateMemory;

// Handle bot state and mood from dashboard
let botState = {
  mood: "neutral",
  energy: "normal",
  isAway: false,
  currentAction: "idle",
  lastUpdateTime: Date.now()
};

// --- Ready ---
client.on('ready', async () => {
    console.log(`Logged in as ${client.user.username} (${character.name})`);

    // Initialize directories for servers
    if (settings.ENABLE_SERVER_SUPPORT) {
        for (const server of settings.ALLOWED_SERVERS) {
            memory.ensureDirectoryExists(path.join('servers', server.id));
        }
    }

    // Update AI mood on startup
    const aiMood = memory.updateAIMood(character.botRole);
    console.log(`AI mood: ${aiMood.mood}, energy: ${aiMood.energy}`);

    // Update bot state from AI mood
    botState.mood = aiMood.mood;
    botState.energy = aiMood.energy;
    dashboard.updateBotState(botState);

    await updateDashboardAllowedUsers();

    // Log to dashboard
    dashboard.logActivity(`Bot started as ${client.user.tag}`);
});

// --- Dashboard Connection ---
io.on('connection', (socket) => {
    socket.on('accept-dm', async (userId) => {
        if (!ALLOWED_USERS.includes(userId)) {
            ALLOWED_USERS.push(userId);
            await updateDashboardAllowedUsers();
            dashboard.removeDMRequest(userId);
            console.log(`User accepted: ${userId}`);
        }
    });

    socket.on('reset-away-status', () => {
        messageHandler.resetAwayStatus();
        dashboard.logActivity('AI away status reset. Now available again.');
    });
    
    // Listen for bot state updates from dashboard
    socket.on('update-bot-state', (newState) => {
        console.log('Updating bot state from dashboard:', newState);
        
        // Update local state
        botState = { ...botState, ...newState };
        
        // If mood or energy changed, update AI mood
        if (newState.mood || newState.energy) {
            memory.setAIMood(character.botRole, {
                mood: botState.mood,
                energy: botState.energy
            });
            
            dashboard.logActivity(`AI mood updated to ${botState.mood}, energy: ${botState.energy}`);
        }
        
        // Log away status changes
        if (newState.hasOwnProperty('isAway')) {
            dashboard.logActivity(`Bot is now ${botState.isAway ? 'away' : 'available'}`);
        }
    });
    
    // Listen for auto-reply toggles
    socket.on('toggle-auto-reply', ({ userId, enabled }) => {
        console.log(`Auto-reply ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
        
        // Update allowed users list to save this preference
        updateDashboardAllowedUsers();
    });
});

// --- Message Handler ---
client.on('messageCreate', async (message) => {
    // Skip messages we've seen or from self
    if (message.author.id === client.user.id || seenMessages.has(message.id)) return;
    seenMessages.add(message.id);

    const userId = message.author.id;

    // Check if bot is in away mode and abort if true
    if (botState.isAway) {
        console.log(`Bot is in away mode. Ignoring message from ${message.author.username}`);
        return;
    }

    // Handle DM requests differently
    if (message.channel.type === 'DM' && !ALLOWED_USERS.includes(userId)) {
        console.log(`New DM request from ${message.author.username}`);
        dashboard.addDMRequest({
            id: userId,
            username: message.author.username,
            avatar: message.author.displayAvatarURL({ format: 'png' }),
            message: message.content
        });
        return;
    }

    // Use enhanced message handler for both DMs and servers
    messageHandler.handleMessage(message, processUserMessage, character);
});

// Process user message (after batching/filtering)
async function processUserMessage(message) {
    const userId = message.author.id;
    
    // *** SERVER DETECTION - Critical section ***
    let serverId = message.guild ? message.guild.id : null;
    
    // Debug log for guild detection
    if (message.guild) {
        console.log(`CORRECT SERVER DETECTION: Message is from guild with ID ${message.guild.id} and name ${message.guild.name}`);
    } else {
        console.log(`NOT FROM SERVER: Message is a DM or guild is null`);
    }
    
    // Double check server ID before proceeding
    if (serverId) {
        console.log(`✓ Server ID: ${serverId} from guild ${message.guild.name}`);
    } else if (message.channel.type === 'DM') {
        console.log(`✓ Confirmed DM channel`);
    } else {
        console.log(`⚠️ WARNING: Not a DM but no server ID detected. Channel type: ${message.channel.type}`);
    }
    
    const isBatched = message.isBatched || false;
    
    // Additional logging for the batched message
    if (isBatched) {
        console.log(`Message is batched. Original server ID preserved? ${message.serverId ? 'Yes: ' + message.serverId : 'No'}`);
        // If batched message has lost serverId, try to recover it
        if (!serverId && message.serverId) {
            console.log(`Recovering serverId from batched message: ${message.serverId}`);
            // This is a batched message that lost its serverId - recover it
            serverId = message.serverId;
        }
    }
    
    // Final server detection decision
    const contextType = serverId ? 'SERVER' : 'DM';
    console.log(`★★★ FINAL CONTEXT: ${contextType} ${serverId ? '(ID: ' + serverId + ')' : ''} ★★★`);

    // Update bot state to processing
    botState.currentAction = 'processing';
    dashboard.updateBotState(botState);
    
    // Get chat history based on context - explicitly use server-specific path for servers
    let chat;
    if (serverId) {
        chat = memory.loadServerUserChat(character.botRole, userId, serverId);
        console.log(`✓ Loaded SERVER chat from: ${character.botRole}/${userId}/servers/${serverId}/chat.json`);
    } else {
        chat = memory.loadDMChat(character.botRole, userId);
        console.log(`✓ Loaded DM chat from: ${character.botRole}/${userId}/chat.json`);
    }

    // Extract any referenced message for reply context
    let replyContext = null;
    if (message.reference && message.channel && message.channel.messages && 
        typeof message.channel.messages.fetch === 'function') {
        try {
            const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            
            if (referencedMessage) {
                replyContext = {
                    content: referencedMessage.content,
                    author: referencedMessage.author.id
                };
            }
        } catch (err) {
            console.error('Error fetching referenced message:', err.message);
        }
    }

    // Add contextual note for replies
    let contextNote = '';
    if (replyContext) {
        if (replyContext.author === client.user.id) {
            contextNote = `Context (replied to my message): "${replyContext.content}"`;
        } else {
            contextNote = `Context (replied to another message): "${replyContext.content}"`;
        }
    }

    // Add to chat history with server context if applicable
    const chatEntry = { 
        role: 'user', 
        content: contextNote ? `${contextNote}\n\n${message.content}` : message.content,
        time: Date.now(),
        // Add server context for better tracking
        context: serverId ? `server:${serverId}` : 'dm'
    };
    
    chat.push(chatEntry);
    console.log(`Added message to ${contextType} chat history with context tag: ${chatEntry.context}`);

    // Limit chat history to recent messages
    if (chat.length > 50) chat = chat.slice(-50);

    // Generate situation context based on time between messages and AI mood
    let situation = '';
    const lastMsg = [...chat].reverse().find(m => m.role === 'user' && m !== chat[chat.length - 1]);
    
    if (lastMsg) {
        const mins = (Date.now() - lastMsg.time) / (1000 * 60);
        if (mins > 360) situation = "You're talking after a long time. Sound friendly and warm.";
        else if (mins > 30) situation = "They messaged after a while. Keep it casual and chill.";
        else situation = "They're responding quickly. Just flow with it.";
    }

    // Check for server mentions in DM
    let mentionedServer = null;
    if (!serverId && settings.ENABLE_SERVER_SUPPORT) {
        mentionedServer = promptBuilder.getServerMentionFromMessage(
            message.content, 
            settings.ALLOWED_SERVERS
        );
    }

    // Extract image attachment if present and image support is enabled
    let imageBuffer = null;
    if (settings.ENABLE_IMAGE_SUPPORT && message.attachments.size > 0) {
        try {
            const attachment = message.attachments.first();
            
            // Only process image attachments
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                dashboard.logActivity('Processing image attachment...');
                
                // Download the image
                const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                imageBuffer = Buffer.from(response.data);
                
                dashboard.logActivity('Image processed successfully');
            }
        } catch (err) {
            console.error('Error processing image:', err.message);
            dashboard.logActivity('Failed to process image attachment');
            // Continue without the image
        }
    }
    
    // Build appropriate prompt based on context
    const ai = settings.PRIMARY_AI.toLowerCase();
    console.log(`Building prompt for ${contextType} context with serverID: ${serverId || 'null'}`);
    const prompt = promptBuilder.buildPrompt(
        character, 
        chat, 
        userId, 
        memory, 
        situation, 
        ai, 
        serverId, 
        mentionedServer
    );
    
    // Send prompt to dashboard with user info and context details
    dashboard.sendPromptData({
        id: message.author.id,
        username: message.author.username,
        avatar: message.author.displayAvatarURL ? message.author.displayAvatarURL({ format: 'png' }) : null
    }, prompt, isBatched, !!replyContext, ai);
    
    try {
        // Get memory context based on whether we're in a server or DM
        const memoryContext = memory.getCombinedPromptMemory(character.botRole, userId, serverId, mentionedServer);
        
        // Log memory context type
        console.log(`Using ${contextType} memory. Facts count: ${
            serverId ? 
                (memoryContext.serverUserFacts?.length || 0) + ' user facts, ' + 
                (memoryContext.serverGlobalFacts?.length || 0) + ' server facts' : 
                (memoryContext.personalFacts?.length || 0) + ' personal facts'
        }`);
        
        // Use the unified AI system with proper context
        const aiResult = await askAI(
            prompt,        // Prompt for the AI  
            imageBuffer,   // Image if any
            userId,        // User ID
            character.systemInstruction,  // System instruction
            memoryContext,  // Memory with proper server context
            settings.PRIMARY_AI === 'openrouter' ? chat : null // Chat history for OpenRouter
        );

        // Extract the actual response and provider info
        const aiResponse = aiResult.response;
        const provider = aiResult.provider;
        const wasFallback = aiResult.wasFallback;

        // Log which provider was used
        if (wasFallback) {
            console.log(`Response generated using ${provider} (fallback)`);
            dashboard.logActivity(`Response sent using ${provider} (fallback)`);
        } else {
            console.log(`Response generated using ${provider}`);
            dashboard.logActivity(`Response sent using ${provider}`);
        }

        if (aiResponse) {
            // Get realistic typing delay based on message length and AI energy
            const typingDelay = messageHandler.getRealisticTypingDelay(aiResponse, character, serverId);
            
            // Show a single typing indicator after we have the response
            if (message.channel && typeof message.channel.sendTyping === 'function') {
                try {
                    await message.channel.sendTyping();
                } catch (err) {
                    // Ignore typing errors
                }
            }
            
            // Wait for a short typing delay 
            await new Promise(res => setTimeout(res, Math.min(typingDelay * 0.5, 1000)));
            
            // Send the message
            if (message.channel && typeof message.channel.send === 'function') {
                await message.channel.send(aiResponse);
            } else {
                console.error('Cannot send message: channel is undefined or does not have send method');
                dashboard.logActivity('Failed to send message: no valid channel');
            }
            
            // Get the AI provider from settings
            const aiProvider = settings.PRIMARY_AI.toLowerCase();
            
            // Send response to dashboard with AI provider info
            dashboard.sendResponseData({
                id: message.author.id,
                username: message.author.username,
                avatar: message.author.displayAvatarURL ? message.author.displayAvatarURL({ format: 'png' }) : null
            }, aiResponse, aiProvider);

            // Update message counter for AI fatigue tracking
            messageHandler.incrementMessageCounter(serverId);
            
            // Add to chat history with explicit context
            chat.push({ 
                role: character.botRole, 
                content: aiResponse, 
                time: Date.now(),
                context: serverId ? `server:${serverId}` : 'dm'
            });
            
            // *** CRITICAL SECTION FOR SAVING CHAT ***
            console.log(`★★★ SAVING ${contextType} CHAT - Final verification ★★★`);
            console.log(`- User ID: ${userId}`);
            console.log(`- Server ID: ${serverId || 'null (DM)'}`);
            console.log(`- Bot Role: ${character.botRole}`);
            console.log(`- Message count in chat: ${chat.length}`);
            console.log(`- Last message context tag: ${chat[chat.length-1].context}`);
            
            if (serverId) {
                console.log(`✓ Saving to SERVER chat at: ${character.botRole}/${userId}/servers/${serverId}/chat.json`);
                memory.saveServerUserChat(character.botRole, userId, serverId, chat);
                
                // Debug verification - load the chat again to verify it was saved correctly
                try {
                    const verifyChat = memory.loadServerUserChat(character.botRole, userId, serverId);
                    console.log(`✓ Verification - loaded back ${verifyChat.length} messages from server chat`);
                } catch (err) {
                    console.error(`⚠️ ERROR: Failed to verify server chat was saved: ${err.message}`);
                }
            } else {
                console.log(`✓ Saving to DM chat at: ${character.botRole}/${userId}/chat.json`);
                memory.saveDMChat(character.botRole, userId, chat);
            }

            // Process for memory updates
            if (!messageBuffers[userId]) messageBuffers[userId] = [];
            
            // Add messages without context notes for memory
            messageBuffers[userId].push({ 
                role: 'user', 
                content: message.content,
                context: serverId ? `server:${serverId}` : 'dm'
            });
            messageBuffers[userId].push({ 
                role: character.botRole, 
                content: aiResponse,
                context: serverId ? `server:${serverId}` : 'dm'
            });

            if (messageBuffers[userId].length >= character.messageBufferSize) {
                console.log(`Updating ${contextType} memory for user ${userId}${serverId ? ` in server ${serverId}` : ''}`);
                await processBatchedMemory(userId, messageBuffers[userId], serverId);
                messageBuffers[userId] = [];
            }
        }
        
        // Reset bot state to idle
        botState.currentAction = 'idle';
        dashboard.updateBotState(botState);
        
    } catch (err) {
        console.error('AI response error:', err.message);
        dashboard.logActivity(`Error generating response: ${err.message}`);
        
        try {
            // Send a simple fallback message when all AI options fail
            if (message.channel && typeof message.channel.send === 'function') {
                await message.channel.send("Sorry, I'm having trouble responding right now. Please try again in a moment.");
            } else {
                console.error('Cannot send fallback message: channel is undefined or does not have send method');
            }
        } catch (sendErr) {
            console.error('Error sending fallback message:', sendErr.message);
        }
        
        // Reset bot state to idle even on error
        botState.currentAction = 'idle';
        dashboard.updateBotState(botState);
    }
}

// --- Update Memory ---
async function processBatchedMemory(userId, batch, serverId = null) {
    // Explicitly re-validate the serverId to ensure it's correct
    console.log(`★★★ MEMORY UPDATE - CONTEXT VERIFICATION ★★★`);
    console.log(`Server ID passed to processBatchedMemory: ${serverId || 'null (DM context)'}`);
    
    // Check if we have context info in batch messages
    const contextInfo = batch.find(msg => msg.context);
    if (contextInfo) {
        console.log(`Context found in messages: ${contextInfo.context}`);
        // If the context doesn't match the serverId, something is wrong
        if (serverId && !contextInfo.context.includes(serverId)) {
            console.error(`⚠️ CRITICAL ERROR: ServerId (${serverId}) doesn't match message context (${contextInfo.context})`);
            console.log(`Correcting mismatch - using context from messages`);
            if (contextInfo.context.startsWith('server:')) {
                serverId = contextInfo.context.split(':')[1];
                console.log(`✓ Corrected serverId to: ${serverId}`);
            } else {
                console.log(`✓ Setting to DM context based on message context`);
                serverId = null;
            }
        }
    }
    
    // Final context decision
    const contextType = serverId ? 'SERVER' : 'DM';
    console.log(`Final memory update context: ${contextType} ${serverId ? `(ID: ${serverId})` : ''}`);
    
    // Log what kind of memory we're updating
    console.log(`${contextType} memory update for ${userId}${serverId ? ` in server ${serverId}` : ''}`);
    
    // Get right memory object based on context
    let userMemory;
    if (serverId) {
        userMemory = memory.loadServerUserMemory(character.botRole, userId, serverId);
        console.log(`✓ Loaded existing server memory from: ${character.botRole}/${userId}/servers/${serverId}/memory.json`);
    } else {
        userMemory = memory.loadDMMemory(character.botRole, userId);
        console.log(`✓ Loaded existing DM memory from: ${character.botRole}/${userId}/memory.json`);
    }
    
    // Filter the batch to only include messages from the correct context
    const contextToMatch = serverId ? `server:${serverId}` : 'dm';
    const filteredBatch = batch.filter(msg => 
        !msg.context || msg.context === contextToMatch
    );
    
    if (filteredBatch.length === 0) {
        console.log(`No messages for context ${contextToMatch} to process`);
        return;
    }
    
    console.log(`Processing ${filteredBatch.length} messages for memory extraction`);
    
    // Extract facts and metrics
    const result = await extractFactsAndRatings(filteredBatch, userMemory);

    if (!result) {
        console.log('No memory updates extracted');
        return;
    }

    console.log(`Extracted ${result.facts.length} new facts and updated relationship metrics`);

    // Update memory with new information
    userMemory.facts = [...new Set([...userMemory.facts, ...result.facts])].slice(-30);
    userMemory.trustLevel = result.trustLevel;
    userMemory.romanticLevel = result.romanticLevel;
    userMemory.censorshipLevel = result.censorshipLevel;
    
    // Add mood and energy if not already present
    if (!userMemory.mood) userMemory.mood = botState.mood;
    if (!userMemory.energy) userMemory.energy = botState.energy;

    // Save updated memory based on context - with final verification
    if (serverId) {
        console.log(`✓ Saving SERVER memory to: ${character.botRole}/${userId}/servers/${serverId}/memory.json`);
        memory.saveServerUserMemory(character.botRole, userId, serverId, userMemory);
        
        // Verify memory was saved correctly
        try {
            const verifyMemory = memory.loadServerUserMemory(character.botRole, userId, serverId);
            console.log(`✓ Verification - loaded back ${verifyMemory.facts.length} facts from server memory`);
        } catch (err) {
            console.error(`⚠️ ERROR: Failed to verify server memory was saved: ${err.message}`);
        }
        
        // Update server memory with shared facts if appropriate
        if (result.facts.length > 0) {
            const serverMemory = memory.loadServerMemory(serverId);
            console.log(`Checking for global server facts for server ${serverId}`);
            
            // Add global facts that might be relevant to everyone
            const globalFacts = result.facts.filter(fact => 
                fact.includes('everyone') ||
                fact.includes('the server') ||
                fact.includes('the group')
            );
            
            if (globalFacts.length > 0) {
                console.log(`Adding ${globalFacts.length} global facts to server ${serverId}`);
                serverMemory.facts = [...new Set([...serverMemory.facts, ...globalFacts])].slice(-30);
                memory.saveServerMemory(serverId, serverMemory);
            }
        }
        // Use the new AI function to extract global facts
        const globalFactResult = await extractGlobalFactsAndRatings(messages, { mood: serverMemory.mood, energy: serverMemory.energy });
        
        if (globalFactResult) {
            serverMemory.facts = globalFactResult.globalFacts;
            serverMemory.mood = globalFactResult.serverMood;
            serverMemory.energy = globalFactResult.serverEnergy;
            await saveServerMemory(serverId, serverMemory);
        }
    } else {
        console.log(`✓ Saving DM memory to: ${character.botRole}/${userId}/memory.json`);
        memory.saveDMMemory(character.botRole, userId, userMemory);
    }
    
    dashboard.logActivity(`Updated memory for ${userId}${serverId ? ` in server ${serverId}` : ''}`);
}

// --- Helpers ---
async function updateDashboardAllowedUsers() {
    try {
        const users = await Promise.all(ALLOWED_USERS.filter(id => id).map(async id => {
        try {
            const u = await client.users.fetch(id);
            return {
                username: u.username,
                avatar: u.displayAvatarURL({ format: 'png' }),
                    id: u.id,
                    // Default to no auto-reply
                    autoReply: false
            };
            } catch (err) {
                console.error(`Error fetching user ${id}:`, err.message);
            return null;
        }
    }));
        
        // Filter out nulls and update dashboard
        const validUsers = users.filter(Boolean);
        dashboard.updateAllowedUsers(validUsers);
        
        console.log(`Updated dashboard with ${validUsers.length} allowed users`);
        return validUsers;
    } catch (err) {
        console.error('Error updating dashboard users:', err.message);
        return [];
    }
}

// --- Login ---
client.login(DISCORD_TOKEN);