const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');
const { getCharacter } = require('../characters');
const settings = require('../settings');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(path.join(__dirname)));

// Persistent storage paths
const STORAGE_PATH = path.join(__dirname, '../data');
const ALLOWED_USERS_PATH = path.join(STORAGE_PATH, 'allowedUsers.json');
const DASHBOARD_STATE_PATH = path.join(STORAGE_PATH, 'dashboardState.json');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// Initialize state
let dashboardSocket = null;
let allowedUsers = []; 
let pendingDMRequests = []; 
let serverConversations = {};
let userConversations = {};
let botState = {
    mood: "neutral",
    energy: "normal",
    isAway: false,
    currentAction: "idle",
    lastUpdateTime: Date.now()
};

// Load the character configuration
const character = getCharacter();
let dailyMessageCount = 0;

// Load allowed users from persistent storage
function loadAllowedUsers() {
    try {
        if (fs.existsSync(ALLOWED_USERS_PATH)) {
            const data = fs.readFileSync(ALLOWED_USERS_PATH, 'utf8');
            allowedUsers = JSON.parse(data);
            console.log(`Loaded ${allowedUsers.length} allowed users from storage`);
        }
    } catch (err) {
        console.error('Error loading allowed users:', err.message);
    }
}

// Save allowed users to persistent storage
function saveAllowedUsers() {
    try {
        fs.writeFileSync(ALLOWED_USERS_PATH, JSON.stringify(allowedUsers, null, 2));
        console.log(`Saved ${allowedUsers.length} allowed users to storage`);
    } catch (err) {
        console.error('Error saving allowed users:', err.message);
    }
}

// Load dashboard state
function loadDashboardState() {
    try {
        if (fs.existsSync(DASHBOARD_STATE_PATH)) {
            const data = fs.readFileSync(DASHBOARD_STATE_PATH, 'utf8');
            const state = JSON.parse(data);
            
            // Restore state properties
            dailyMessageCount = state.dailyMessageCount || 0;
            botState = state.botState || botState;
            pendingDMRequests = state.pendingDMRequests || [];
            
            console.log('Dashboard state loaded from storage');
        }
    } catch (err) {
        console.error('Error loading dashboard state:', err.message);
    }
}

// Save dashboard state
function saveDashboardState() {
    try {
        const state = {
            dailyMessageCount,
            botState,
            pendingDMRequests
        };
        
        fs.writeFileSync(DASHBOARD_STATE_PATH, JSON.stringify(state, null, 2));
    } catch (err) {
        console.error('Error saving dashboard state:', err.message);
    }
}

// Load data on startup
loadAllowedUsers();
loadDashboardState();

// Set up auto-save interval (every 5 minutes)
setInterval(() => {
    saveAllowedUsers();
    saveDashboardState();
}, 5 * 60 * 1000);

// Load conversation data for a user
function loadUserConversation(userId) {
    if (userConversations[userId]) return userConversations[userId];
    
    try {
        const chatPath = path.join(__dirname, '../memory', character.botRole, userId, 'chat.json');
        const memoryPath = path.join(__dirname, '../memory', character.botRole, userId, 'memory.json');
        
        let conversation = {
            userId,
            chat: [],
            memory: {
                facts: [],
                trustLevel: 5,
                romanticLevel: 0,
                censorshipLevel: 8,
                mood: "neutral",
                energy: "normal"
            },
            lastActive: null
        };
        
        // Load chat if it exists
        if (fs.existsSync(chatPath)) {
            conversation.chat = JSON.parse(fs.readFileSync(chatPath, 'utf8'));
            if (conversation.chat.length > 0) {
                const lastMsg = conversation.chat[conversation.chat.length - 1];
                conversation.lastActive = lastMsg.time || Date.now();
            }
        }
        
        // Load memory if it exists
        if (fs.existsSync(memoryPath)) {
            conversation.memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
        }
        
        userConversations[userId] = conversation;
        return conversation;
    } catch (err) {
        console.error(`Error loading conversation for ${userId}:`, err.message);
        return {
            userId,
            chat: [],
            memory: { facts: [], trustLevel: 5, romanticLevel: 0, censorshipLevel: 8 },
            lastActive: null
        };
    }
}

// Load conversation data for a user in a server
function loadServerUserConversation(userId, serverId) {
    const key = `${userId}-${serverId}`;
    if (serverConversations[key]) return serverConversations[key];
    
    try {
        const chatPath = path.join(__dirname, '../memory', character.botRole, userId, 'servers', serverId, 'chat.json');
        const memoryPath = path.join(__dirname, '../memory', character.botRole, userId, 'servers', serverId, 'memory.json');
        
        let conversation = {
            userId,
            serverId,
            chat: [],
            memory: {
                facts: [],
                trustLevel: 5,
                romanticLevel: 0,
                censorshipLevel: 8,
                mood: "neutral",
                energy: "normal"
            },
            lastActive: null
        };
        
        // Load chat if it exists
        if (fs.existsSync(chatPath)) {
            conversation.chat = JSON.parse(fs.readFileSync(chatPath, 'utf8'));
            if (conversation.chat.length > 0) {
                const lastMsg = conversation.chat[conversation.chat.length - 1];
                conversation.lastActive = lastMsg.time || Date.now();
            }
        }
        
        // Load memory if it exists
        if (fs.existsSync(memoryPath)) {
            conversation.memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
        }
        
        serverConversations[key] = conversation;
        return conversation;
    } catch (err) {
        console.error(`Error loading server conversation for ${userId} in ${serverId}:`, err.message);
        return {
            userId,
            serverId,
            chat: [],
            memory: { facts: [], trustLevel: 5, romanticLevel: 0, censorshipLevel: 8 },
            lastActive: null
        };
    }
}

// Get all server data
function getServersData() {
    try {
        const serversData = [];
        const serversPath = path.join(__dirname, '../servers');
        
        if (!fs.existsSync(serversPath)) return serversData;
        
        // Get all server directories
        const serverDirs = fs.readdirSync(serversPath)
            .filter(item => {
                const itemPath = path.join(serversPath, item);
                return fs.statSync(itemPath).isDirectory();
            });
            
        // Load data for each server
        for (const serverId of serverDirs) {
            const memoryPath = path.join(serversPath, serverId, 'memory.json');
            const chatPath = path.join(serversPath, serverId, 'chat.json');
            
            const serverInfo = { 
                id: serverId,
                name: "Unknown Server", // Will be updated from settings
                memory: { facts: [] },
                recentMessages: [],
                users: []
            };
            
            // Try to get server name from settings
            try {
                const settings = require('../settings');
                const serverConfig = settings.ALLOWED_SERVERS.find(s => s.id === serverId);
                if (serverConfig) {
                    serverInfo.name = serverConfig.name;
                }
            } catch (err) {
                console.error(`Error getting server name for ${serverId}:`, err.message);
            }
            
            // Load memory
            if (fs.existsSync(memoryPath)) {
                serverInfo.memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
            }
            
            // Load recent messages
            if (fs.existsSync(chatPath)) {
                const chat = JSON.parse(fs.readFileSync(chatPath, 'utf8'));
                serverInfo.recentMessages = chat.slice(-10); // Last 10 messages
            }
            
            // Find users who have interacted in this server
            try {
                const botRolePath = path.join(__dirname, '../memory', character.botRole);
                if (fs.existsSync(botRolePath)) {
                    const userDirs = fs.readdirSync(botRolePath)
                        .filter(item => {
                            const itemPath = path.join(botRolePath, item);
                            return fs.statSync(itemPath).isDirectory();
                        });
                        
                    for (const userId of userDirs) {
                        const serverPath = path.join(botRolePath, userId, 'servers', serverId);
                        if (fs.existsSync(serverPath)) {
                            serverInfo.users.push(userId);
                        }
                    }
                }
            } catch (err) {
                console.error(`Error finding users for server ${serverId}:`, err.message);
            }
            
            serversData.push(serverInfo);
        }
        
        return serversData;
    } catch (err) {
        console.error('Error getting servers data:', err.message);
        return [];
    }
}

// Initialize socket connection
io.on('connection', (socket) => {
    console.log('Dashboard connected');
    dashboardSocket = socket;

    // Send current state when new dashboard connects
    socket.emit('allowed-users', allowedUsers);
    socket.emit('pending-requests', pendingDMRequests);
    socket.emit('bot-state', botState);
    socket.emit('message-count', dailyMessageCount);
    socket.emit('character-info', {
        name: character.name,
        role: character.botRole,
        gender: character.gender,
        nationality: character.nationality,
        botRole: character.botRole,
        // Only show first few chars for security
        token: character.token ? `${character.token.substring(0, 12)}...` : 'Not set'
    });
    
    // Send servers data
    socket.emit('servers-data', getServersData());

    // When dashboard requests user conversation data
    socket.on('get-user-conversation', (userId) => {
        const conversation = loadUserConversation(userId);
        socket.emit('user-conversation', conversation);
    });

    // When dashboard requests server user conversation data
    socket.on('get-server-user-conversation', ({ userId, serverId }) => {
        const conversation = loadServerUserConversation(userId, serverId);
        socket.emit('server-user-conversation', conversation);
    });

    // When dashboard accepts a DM request
    socket.on('accept-dm', (userId) => {
            console.log(`Accepting DM from ${userId}`);
        
        // Add to allowed users if not already there
        if (!allowedUsers.find(u => u.id === userId)) {
            const request = pendingDMRequests.find(r => r.id === userId);
            if (request) {
                allowedUsers.push(request);
                
                // Save allowed users immediately
                saveAllowedUsers();
                
                // Update UI
                io.emit('allowed-users', allowedUsers);
            }
        }
        
        // Remove from pending requests
        pendingDMRequests = pendingDMRequests.filter(req => req.id !== userId);
        io.emit('pending-requests', pendingDMRequests);
        
        // Emit accepted user event to bot
            io.emit('accepted-user', userId);
        
        // Save state
        saveDashboardState();
    });
    
    // When dashboard manually updates bot state
    socket.on('update-bot-state', (newState) => {
        botState = { ...botState, ...newState };
        io.emit('bot-state', botState);
        saveDashboardState();
        
        logActivity(`Bot state manually updated: ${JSON.stringify(newState)}`);
    });
    
    // When dashboard toggles auto-reply for a user
    socket.on('toggle-auto-reply', ({ userId, enabled }) => {
        const userIndex = allowedUsers.findIndex(u => u.id === userId);
        if (userIndex >= 0) {
            allowedUsers[userIndex].autoReply = enabled;
            io.emit('allowed-users', allowedUsers);
            saveAllowedUsers();
            
            logActivity(`Auto-reply ${enabled ? 'enabled' : 'disabled'} for ${allowedUsers[userIndex].username}`);
        }
    });

    // When dashboard changes AI provider
    socket.on('changeAIProvider', (provider) => {
        console.log(`Changing AI provider to: ${provider}`);
        
        if (['openrouter', 'chutes', 'gemini', 'colab'].includes(provider)) {
            settings.PRIMARY_AI = provider;
            botState.aiProvider = provider;
            io.emit('aiProviderChanged', provider);
            logActivity(`AI provider changed to ${provider}`);
        } else {
            console.error(`Invalid AI provider: ${provider}`);
        }
    });

    // Send current AI provider info
    socket.emit('aiProviderInfo', {
        current: botState.aiProvider,
        available: ['openrouter', 'chutes', 'gemini', 'colab']
    });

    socket.on('disconnect', () => {
        console.log('Dashboard disconnected');
        dashboardSocket = null;
    });
});

// --- Functions ---
function updateAllowedUsers(users) {
    // Merge with existing users (to preserve auto-reply settings)
    users.forEach(newUser => {
        const existingUser = allowedUsers.find(u => u.id === newUser.id);
        if (existingUser) {
            // Keep autoReply setting if it exists
            if (existingUser.autoReply !== undefined) {
                newUser.autoReply = existingUser.autoReply;
            }
        }
    });
    
    allowedUsers = users;
    saveAllowedUsers();
    
    if (dashboardSocket) {
        dashboardSocket.emit('allowed-users', allowedUsers);
    }
}

function addDMRequest(dm) {
    // Only add if not already present and not in allowed users
    if (!pendingDMRequests.find(req => req.id === dm.id) && 
        !allowedUsers.find(user => user.id === dm.id)) {
        
        pendingDMRequests.push({
            ...dm,
            timestamp: Date.now(), // Add timestamp for sorting/display
            originalMessage: dm.message // Store original message for auto-reply
        });
        
        if (dashboardSocket) {
            dashboardSocket.emit('dm-request', dm);
            dashboardSocket.emit('pending-requests', pendingDMRequests);
        }
        
        // Save state
        saveDashboardState();
    }
}

function removeDMRequest(userId) {
    pendingDMRequests = pendingDMRequests.filter(req => req.id !== userId);
    
    if (dashboardSocket) {
        dashboardSocket.emit('pending-requests', pendingDMRequests);
    }
    
    // Save state
    saveDashboardState();
}

function logActivity(activity) {
    if (dashboardSocket) {
        const timestamp = new Date().toLocaleTimeString();
        const formattedActivity = `[${timestamp} - ${character.botRole}] ${activity}`;
        dashboardSocket.emit('activity-log', formattedActivity);
    }
}

// Update the sendPromptData function to include AI provider information
function sendPromptData(user, prompt, isBatched = false, hasReplyContext = false, aiProvider = null) {
    if (dashboardSocket) {
        dashboardSocket.emit('prompt-data', {
            username: user.username || 'Unknown User',
            userId: user.id,
            prompt: prompt,
            isBatched: isBatched,
            hasReplyContext: hasReplyContext,
            aiProvider: aiProvider,
            timestamp: Date.now()
        });
        
        // Update bot state
        botState.currentAction = 'processing';
        botState.lastUpdateTime = Date.now();
        dashboardSocket.emit('bot-state', botState);
        
        const statusInfo = [];
        if (isBatched) statusInfo.push('batched messages');
        if (hasReplyContext) statusInfo.push('with reply context');
        if (aiProvider) statusInfo.push(`using ${aiProvider}`);
        
        const statusText = statusInfo.length > 0 
            ? ` (${statusInfo.join(', ')})`
            : '';
            
        logActivity(`Processing message from ${user.username}${statusText}`);
        
        // Save state
        saveDashboardState();
    }
}

// New function to send response data to dashboard with AI provider info
function sendResponseData(user, response, aiProvider = null) {
    if (dashboardSocket) {
        dashboardSocket.emit('prompt-response', {
            username: user.username || 'Unknown User',
            userId: user.id,
            response: response,
            aiProvider: aiProvider,
            timestamp: Date.now()
        });
        
        // Update daily message count
        dailyMessageCount++;
        dashboardSocket.emit('message-count', dailyMessageCount);
        
        // Update bot state
        botState.currentAction = 'idle';
        botState.lastUpdateTime = Date.now();
        dashboardSocket.emit('bot-state', botState);
        
        const providerInfo = aiProvider ? ` (using ${aiProvider})` : '';
        logActivity(`Sent response to ${user.username}${providerInfo}`);
        
        // Save state
        saveDashboardState();
    }
}

// Update bot state
function updateBotState(newState) {
    botState = { ...botState, ...newState, lastUpdateTime: Date.now() };
    
    if (dashboardSocket) {
        dashboardSocket.emit('bot-state', botState);
    }
    
    // Save state
    saveDashboardState();
}

// Reset daily counts at midnight
function setupDailyReset() {
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // tomorrow
        0, 0, 0 // midnight
    );
    const msToMidnight = night.getTime() - now.getTime();

    setTimeout(() => {
        dailyMessageCount = 0;
        if (dashboardSocket) {
            dashboardSocket.emit('message-count', 0);
        }
        
        // Save state
        saveDashboardState();
        
        // Setup for next day
        setupDailyReset();
    }, msToMidnight);
}

// Initialize daily reset
setupDailyReset();

// --- Start Server ---
server.listen(3000, () => {
    console.log(`Dashboard running at http://localhost:3000 (Character: ${character.name}, Role: ${character.botRole})`);
});

module.exports = {
    updateAllowedUsers,
    addDMRequest,
    removeDMRequest,
    logActivity,
    sendPromptData,
    sendResponseData,
    updateBotState,
    io
};