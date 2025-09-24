// Connect to the server
const socket = io();

// Dashboard state
let dashboardState = {
    currentTab: 'overview',
    allowedUsers: [],
    pendingRequests: [],
    activityLogs: [],
    lastPrompt: null,
    lastResponse: null,
    messageCount: 0,
    character: {
        name: 'AI Bot',
        role: 'assistant',
        botRole: 'assistant'
    },
    botState: {
        mood: 'neutral',
        energy: 'normal',
        isAway: false,
        currentAction: 'idle',
        lastUpdateTime: Date.now()
    },
    serversData: [],
    viewingServer: null,
    viewingUser: null,
    currentUserConversation: null,
    theme: 'amoled'
};

// Elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const botMood = document.getElementById('bot-mood');
const botName = document.getElementById('bot-name');
const botRole = document.getElementById('bot-role');
const currentTime = document.getElementById('current-time');
const tabButtons = document.querySelectorAll('.sidebar-nav li');
const contentTabs = document.querySelectorAll('.content-tab');
const serverDetailView = document.getElementById('server-detail-view');
const userDetailView = document.getElementById('user-detail-view');
const confirmationModal = document.getElementById('confirmation-modal');

// Initialize dashboard
function initDashboard() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);
    attachEventListeners();
}

// Update current time
function updateCurrentTime() {
    const now = new Date();
    currentTime.textContent = now.toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
}

// Attach event listeners
function attachEventListeners() {
    // Tab navigation
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            changeTab(button.getAttribute('data-tab'));
        });
    });

    // Toggle prompt visibility
    document.getElementById('toggle-prompt-btn').addEventListener('click', togglePromptVisibility);
    
    // Copy prompt text
    document.getElementById('copy-prompt-btn').addEventListener('click', copyPromptText);
    
    // View all activity button
    document.getElementById('view-all-activity-btn').addEventListener('click', () => {
        changeTab('activity');
    });
    
    // View users button
    document.getElementById('view-users-btn').addEventListener('click', () => {
        changeTab('users');
    });
    
    // View requests button
    document.getElementById('view-requests-btn').addEventListener('click', () => {
        changeTab('requests');
    });
    
    // View activity button
    document.getElementById('view-activity-btn').addEventListener('click', () => {
        changeTab('activity');
    });
    
    // Server back button
    document.getElementById('server-back-btn').addEventListener('click', closeServerDetail);
    
    // User back button
    document.getElementById('user-back-btn').addEventListener('click', closeUserDetail);
    
    // Server detail tabs
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = btn.getAttribute('data-tab');
            const parentElement = btn.closest('.detail-tabs').parentElement;
            
            // Remove active class from all sibling tabs and panes
            parentElement.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
            parentElement.querySelectorAll('.detail-pane').forEach(p => p.classList.remove('active'));
            
            // Add active class to selected tab and pane
            btn.classList.add('active');
            parentElement.querySelector(`#${tabName}`).classList.add('active');
        });
    });
    
    // Toggle away mode
    document.getElementById('toggle-away-btn').addEventListener('click', toggleAwayMode);
    document.getElementById('away-mode-toggle').addEventListener('change', (e) => {
        updateBotState({ isAway: e.target.checked });
    });
    
    // Mood buttons
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateBotState({ mood: btn.getAttribute('data-mood') });
        });
    });
    
    // Energy slider
    const energySlider = document.getElementById('energy-slider');
    const energyValue = document.getElementById('energy-value');
    
    energySlider.addEventListener('input', () => {
        const value = energySlider.value;
        let energyText = 'Normal';
        
        if (value == 1) energyText = 'Low';
        else if (value == 3) energyText = 'High';
        
        energyValue.textContent = energyText;
        updateBotState({ energy: energyText.toLowerCase() });
    });
    
    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const theme = btn.getAttribute('data-theme');
            setTheme(theme);
        });
    });
    
    // Clear logs button
    document.getElementById('clear-logs-btn').addEventListener('click', () => {
        showConfirmationModal(
            'Clear Activity Logs', 
            'Are you sure you want to clear all activity logs? This action cannot be undone.',
            clearActivityLogs
        );
    });
    
    // Modal close button
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    
    // Modal cancel button
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    
    // User search
    document.getElementById('user-search').addEventListener('input', (e) => {
        filterUsers(e.target.value);
    });
    
    // Server search
    document.getElementById('server-search').addEventListener('input', (e) => {
        filterServers(e.target.value);
    });
    
    // Server filter
    document.getElementById('server-filter').addEventListener('change', (e) => {
        filterServers(document.getElementById('server-search').value, e.target.value);
    });
}

// Change current tab
function changeTab(tabName) {
    dashboardState.currentTab = tabName;
    
    // Update tab buttons
    tabButtons.forEach(button => {
        if (button.getAttribute('data-tab') === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Update content tabs
    contentTabs.forEach(tab => {
        if (tab.id === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// Set theme
function setTheme(theme) {
    // Remove all theme classes
    document.body.classList.remove('amoled-theme', 'dark-theme', 'light-theme');
    
    // Add selected theme class
    document.body.classList.add(`${theme}-theme`);
    
    // Save theme preference
    dashboardState.theme = theme;
    localStorage.setItem('dashboardTheme', theme);
}

// Toggle prompt visibility
function togglePromptVisibility() {
    const promptContainer = document.getElementById('current-prompt');
    const toggleButton = document.getElementById('toggle-prompt-btn');
    
    if (promptContainer.classList.contains('hidden')) {
        promptContainer.classList.remove('hidden');
        toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        promptContainer.classList.add('hidden');
        toggleButton.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

// Copy prompt text
function copyPromptText() {
    const promptText = document.getElementById('current-prompt').textContent;
    navigator.clipboard.writeText(promptText)
        .then(() => {
            showToast('Copied to clipboard', 'Prompt text copied to clipboard', 'success');
        })
        .catch(() => {
            showToast('Copy failed', 'Failed to copy prompt text', 'error');
        });
}

// Show server detail view
function showServerDetail(serverId) {
    const server = dashboardState.serversData.find(s => s.id === serverId);
    if (!server) return;
    
    dashboardState.viewingServer = server;
    
    // Update server details
    document.getElementById('server-detail-name').textContent = server.name;
    document.getElementById('server-detail-id').textContent = `ID: ${server.id}`;
    
    // Reset to first tab
    document.querySelectorAll('#server-detail-view .detail-tab-btn').forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
    });
    
    document.querySelectorAll('#server-detail-view .detail-pane').forEach((pane, index) => {
        pane.classList.toggle('active', index === 0);
    });
    
    // Populate server users
    populateServerUsers(server);
    
    // Populate server memory
    populateServerMemory(server);
    
    // Populate server messages
    populateServerMessages(server);
    
    // Show server detail view
    serverDetailView.classList.add('active');
}

// Close server detail view
function closeServerDetail() {
    serverDetailView.classList.remove('active');
    dashboardState.viewingServer = null;
}

// Show user detail view
function showUserDetail(userId) {
    const user = dashboardState.allowedUsers.find(u => u.id === userId);
    if (!user) return;
    
    dashboardState.viewingUser = user;
    
    // Update user details
    document.getElementById('user-detail-name').textContent = user.username;
    document.getElementById('user-detail-id').textContent = `ID: ${user.id}`;
    
    // Set auto-reply toggle
    document.getElementById('user-auto-reply').checked = user.autoReply || false;
    
    // Reset to first tab
    document.querySelectorAll('#user-detail-view .detail-tab-btn').forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
    });
    
    document.querySelectorAll('#user-detail-view .detail-pane').forEach((pane, index) => {
        pane.classList.toggle('active', index === 0);
    });
    
    // Load user conversation
    socket.emit('get-user-conversation', user.id);
    
    // Show user detail view
    userDetailView.classList.add('active');
    
    // Set up auto-reply toggle event
    document.getElementById('user-auto-reply').addEventListener('change', (e) => {
        toggleAutoReply(user.id, e.target.checked);
    });
    
    // Set up remove user button
    document.getElementById('remove-user-btn').addEventListener('click', () => {
        showConfirmationModal(
            'Remove User', 
            `Are you sure you want to remove ${user.username} from allowed users?`,
            () => removeUser(user.id)
        );
    });
}

// Close user detail view
function closeUserDetail() {
    userDetailView.classList.remove('active');
    dashboardState.viewingUser = null;
    dashboardState.currentUserConversation = null;
}

// Toggle auto-reply for a user
function toggleAutoReply(userId, enabled) {
    socket.emit('toggle-auto-reply', { userId, enabled });
    
    const actionText = enabled ? 'enabled' : 'disabled';
    const user = dashboardState.allowedUsers.find(u => u.id === userId);
    
    showToast(
        'Auto-reply updated', 
        `Auto-reply ${actionText} for ${user ? user.username : userId}`,
        'info'
    );
}

// Remove user from allowed users
function removeUser(userId) {
    // This would be handled by the server in a real implementation
    // For now, just close the detail view
    closeUserDetail();
    
    showToast('User removed', 'User has been removed from allowed users', 'success');
}

// Toggle away mode
function toggleAwayMode() {
    const newAwayState = !dashboardState.botState.isAway;
    updateBotState({ isAway: newAwayState });
}

// Update bot state
function updateBotState(newState) {
    // Send update to server
    socket.emit('update-bot-state', newState);
    
    // Update local state
    dashboardState.botState = { ...dashboardState.botState, ...newState };
    
    // Update UI
    updateBotStatusUI();
}

// Update bot status UI
function updateBotStatusUI() {
    const { mood, energy, isAway, currentAction } = dashboardState.botState;
    
    // Update status indicator
    statusIndicator.className = 'status-indicator';
    
    if (isAway) {
        statusIndicator.classList.add('away');
        statusText.textContent = 'Away';
        document.getElementById('bot-status-detail').textContent = 'Away (Not responding)';
    } else if (currentAction === 'processing') {
        statusIndicator.classList.add('busy');
        statusText.textContent = 'Processing';
        document.getElementById('bot-status-detail').textContent = 'Active (Processing message)';
    } else {
        statusIndicator.classList.add('online');
        statusText.textContent = 'Online';
        document.getElementById('bot-status-detail').textContent = 'Online (Ready to respond)';
    }
    
    // Update mood indicator
    botMood.innerHTML = '';
    
    if (mood === 'happy') {
        botMood.innerHTML = '<i class="fas fa-grin"></i>';
    } else if (mood === 'sad') {
        botMood.innerHTML = '<i class="fas fa-frown"></i>';
    } else if (mood === 'angry') {
        botMood.innerHTML = '<i class="fas fa-angry"></i>';
    } else {
        botMood.innerHTML = '<i class="fas fa-smile"></i>';
    }
    
    // Update UI controls to match state
    document.getElementById('away-mode-toggle').checked = isAway;
    
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mood') === mood);
    });
    
    let energyValue = 2; // Normal
    if (energy === 'low') energyValue = 1;
    else if (energy === 'high') energyValue = 3;
    
    document.getElementById('energy-slider').value = energyValue;
    document.getElementById('energy-value').textContent = energy.charAt(0).toUpperCase() + energy.slice(1);
}

// Show confirmation modal
function showConfirmationModal(title, message, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent = message;
    
    // Remove previous event listener
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // Add new event listener
    newConfirmBtn.addEventListener('click', () => {
        onConfirm();
        closeModal();
    });
    
    confirmationModal.classList.add('active');
}

// Close modal
function closeModal() {
    confirmationModal.classList.remove('active');
}

// Show toast notification
function showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                               type === 'error' ? 'exclamation-circle' : 
                               type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <div class="toast-close">
            <i class="fas fa-times"></i>
        </div>
    `;
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('active');
    }, 10);
    
    // Auto close after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('active');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Clear activity logs
function clearActivityLogs() {
    dashboardState.activityLogs = [];
    
    document.getElementById('activity-logs').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-chart-line fa-3x"></i>
            <p>No activity recorded</p>
        </div>
    `;
    
    document.getElementById('recent-activity-logs').innerHTML = `
        <div class="activity-placeholder">No recent activity</div>
    `;
    
    showToast('Logs cleared', 'Activity logs have been cleared', 'info');
}

// Filter users
function filterUsers(query) {
    query = query.toLowerCase();
    
    const container = document.getElementById('allowed-users-container');
    const userCards = container.querySelectorAll('.user-card');
    
    userCards.forEach(card => {
        const username = card.querySelector('.user-name').textContent.toLowerCase();
        const userId = card.querySelector('.user-id').textContent.toLowerCase();
        
        if (username.includes(query) || userId.includes(query)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// Filter servers
function filterServers(query, filterType = 'all') {
    query = query.toLowerCase();
    
    const container = document.getElementById('servers-grid');
    const serverCards = container.querySelectorAll('.server-card');
    
    serverCards.forEach(card => {
        const serverId = card.getAttribute('data-server-id');
        const serverName = card.querySelector('.server-name').textContent.toLowerCase();
        const server = dashboardState.serversData.find(s => s.id === serverId);
        
        let showByFilter = true;
        
        if (filterType === 'active' && (!server.recentMessages || server.recentMessages.length === 0)) {
            showByFilter = false;
        } else if (filterType === 'inactive' && server.recentMessages && server.recentMessages.length > 0) {
            showByFilter = false;
        }
        
        if ((serverName.includes(query) || serverId.includes(query)) && showByFilter) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Populate server users list
function populateServerUsers(server) {
    const container = document.getElementById('server-users-list');
    container.innerHTML = '';
    
    if (!server.users || server.users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users fa-3x"></i>
                <p>No users in this server</p>
            </div>
        `;
        return;
    }
    
    server.users.forEach(userId => {
        // Find user in allowed users or create a placeholder
        const user = dashboardState.allowedUsers.find(u => u.id === userId) || {
            id: userId,
            username: 'Unknown User',
            avatar: null
        };
        
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.setAttribute('data-user-id', user.id);
        
        userCard.innerHTML = `
            <div class="user-avatar">
                ${user.avatar ? `<img src="${user.avatar}" alt="${user.username}">` : '<i class="fas fa-user"></i>'}
            </div>
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-id">${user.id}</div>
            </div>
            <button class="action-btn">
                <i class="fas fa-eye"></i>
            </button>
        `;
        
        userCard.querySelector('button').addEventListener('click', () => {
            socket.emit('get-server-user-conversation', { userId: user.id, serverId: server.id });
            showUserDetail(user.id);
        });
        
        container.appendChild(userCard);
    });
}

// Populate server memory facts
function populateServerMemory(server) {
    const container = document.getElementById('server-memory-facts');
    container.innerHTML = '';
    
    if (!server.memory || !server.memory.facts || server.memory.facts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-brain fa-3x"></i>
                <p>No memory facts for this server</p>
            </div>
        `;
        return;
    }
    
    server.memory.facts.forEach(fact => {
        const factElement = document.createElement('div');
        factElement.className = 'memory-fact';
        
        factElement.innerHTML = `
            <div class="fact-content">${fact.content || fact}</div>
            ${fact.source ? `<div class="fact-source">Source: ${fact.source}</div>` : ''}
        `;
        
        container.appendChild(factElement);
    });
}

// Populate server messages
function populateServerMessages(server) {
    const container = document.getElementById('server-message-list');
    container.innerHTML = '';
    
    if (!server.recentMessages || server.recentMessages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comment fa-3x"></i>
                <p>No recent messages</p>
            </div>
        `;
        return;
    }
    
    server.recentMessages.forEach(msg => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${msg.role === 'assistant' ? 'bot' : ''}`;
        
        const userInfo = msg.role === 'assistant' 
            ? { username: dashboardState.character.name, avatar: null } 
            : (dashboardState.allowedUsers.find(u => u.id === msg.userId) || { username: 'Unknown User', avatar: null });
        
        const time = msg.time ? new Date(msg.time).toLocaleTimeString() : '';
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                ${userInfo.avatar ? `<img src="${userInfo.avatar}" alt="${userInfo.username}">` : 
                   msg.role === 'assistant' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>'}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <div class="message-author">${userInfo.username}</div>
                    <div class="message-time">${time}</div>
                </div>
                <div class="message-text">${msg.content || msg.message}</div>
            </div>
        `;
        
        container.appendChild(messageElement);
    });
}

// Update allowed users
function updateAllowedUsers(users) {
    dashboardState.allowedUsers = users;
    
    // Update count in badge
    document.getElementById('users-count').textContent = users.length;
    document.getElementById('allowed-users-count').textContent = users.length;
    
    // Update allowed users list
    const container = document.getElementById('allowed-users-container');
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users fa-3x"></i>
                <p>No users found</p>
            </div>
        `;
        return;
    }
    
    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.setAttribute('data-user-id', user.id);
        
        userCard.innerHTML = `
            <div class="user-avatar">
                ${user.avatar ? `<img src="${user.avatar}" alt="${user.username}">` : '<i class="fas fa-user"></i>'}
            </div>
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-id">${user.id}</div>
            </div>
            <div class="user-status ${user.lastSeen ? 'offline' : 'online'}"></div>
        `;
        
        userCard.addEventListener('click', () => {
            showUserDetail(user.id);
        });
        
        container.appendChild(userCard);
    });
}

// Update pending DM requests
function updatePendingRequests(requests) {
    dashboardState.pendingRequests = requests;
    
    // Update count in badge
    document.getElementById('requests-count').textContent = requests.length;
    document.getElementById('pending-requests-count').textContent = requests.length;
    
    // Update pending requests list
    const container = document.getElementById('pending-requests-container');
    container.innerHTML = '';
    
    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell fa-3x"></i>
                <p>No pending requests</p>
            </div>
        `;
        return;
    }
    
    // Sort requests by timestamp (newest first)
    const sortedRequests = [...requests].sort((a, b) => {
        return (b.timestamp || 0) - (a.timestamp || 0);
    });
    
    sortedRequests.forEach(request => {
        const time = request.timestamp ? new Date(request.timestamp).toLocaleString() : '';
        
        const requestCard = document.createElement('div');
        requestCard.className = 'request-card';
        
        requestCard.innerHTML = `
            <div class="request-header">
                <div class="request-user-avatar">
                    ${request.avatar ? `<img src="${request.avatar}" alt="${request.username}">` : '<i class="fas fa-user"></i>'}
                </div>
                <div class="request-user-info">
                    <div class="request-username">${request.username}</div>
                    <div class="request-time">${time}</div>
                </div>
            </div>
            <div class="request-message">${request.message || request.originalMessage || ''}</div>
            <div class="request-actions">
                <button class="accept-btn" data-user-id="${request.id}">
                    <i class="fas fa-check"></i> Accept
                </button>
            </div>
        `;
        
        requestCard.querySelector('.accept-btn').addEventListener('click', () => {
            acceptDM(request.id);
        });
        
        container.appendChild(requestCard);
    });
}

// Accept DM request
function acceptDM(userId) {
    socket.emit('accept-dm', userId);
    
    // Find the request for UI update
    const request = dashboardState.pendingRequests.find(r => r.id === userId);
    if (request) {
        showToast(
            'DM Request Accepted', 
            `You've accepted the DM request from ${request.username}`,
            'success'
        );
    }
}

// Add activity log entry
function addLogEntry(log) {
    dashboardState.activityLogs.unshift(log);
    
    // Update both log containers
    updateActivityLogs(log);
    updateRecentActivityLogs();
}

// Update activity logs with new entry
function updateActivityLogs(log) {
    const container = document.getElementById('activity-logs');
    
    // Remove empty state if present
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        container.innerHTML = '';
    }
    
    const logItem = document.createElement('div');
    logItem.className = 'activity-log-item';
    
    const now = new Date();
    const time = now.toLocaleTimeString();
    
    logItem.innerHTML = `
        <div class="activity-log-content">${log}</div>
        <div class="activity-log-time">${time}</div>
    `;
    
    container.insertBefore(logItem, container.firstChild);
}

// Update recent activity logs
function updateRecentActivityLogs() {
    const container = document.getElementById('recent-activity-logs');
    container.innerHTML = '';
    
    if (dashboardState.activityLogs.length === 0) {
        container.innerHTML = `<div class="activity-placeholder">No recent activity</div>`;
        return;
    }
    
    // Show only the 5 most recent logs
    const recentLogs = dashboardState.activityLogs.slice(0, 5);
    
    recentLogs.forEach(log => {
        const logItem = document.createElement('div');
        logItem.className = 'activity-log-item';
        
        // Extract time from log message or use current time
        let time = '';
        const timeMatch = log.match(/\[([^\]]+)\]/);
        if (timeMatch && timeMatch[1]) {
            const parts = timeMatch[1].split(' - ');
            time = parts[0];
        } else {
            time = new Date().toLocaleTimeString();
        }
        
        logItem.innerHTML = `
            <div class="activity-log-content">${log}</div>
            <div class="activity-log-time">${time}</div>
        `;
        
        container.appendChild(logItem);
    });
}

// Update user conversation display
function updateUserConversation(conversation) {
    if (!conversation) return;
    
    dashboardState.currentUserConversation = conversation;
    
    // Update memory metrics
    if (conversation.memory) {
        document.getElementById('user-trust-level').textContent = conversation.memory.trustLevel || 5;
        document.getElementById('user-censorship-level').textContent = conversation.memory.censorshipLevel || 8;
        document.getElementById('user-romantic-level').textContent = conversation.memory.romanticLevel || 0;
    }
    
    // Update memory facts
    const factsContainer = document.getElementById('user-memory-facts');
    factsContainer.innerHTML = '';
    
    if (!conversation.memory || !conversation.memory.facts || conversation.memory.facts.length === 0) {
        factsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-brain fa-3x"></i>
                <p>No memory facts</p>
            </div>
        `;
    } else {
        conversation.memory.facts.forEach(fact => {
            const factElement = document.createElement('div');
            factElement.className = 'memory-fact';
            
            factElement.innerHTML = `
                <div class="fact-content">${fact.content || fact}</div>
                ${fact.source ? `<div class="fact-source">Source: ${fact.source}</div>` : ''}
            `;
            
            factsContainer.appendChild(factElement);
        });
    }
    
    // Update conversation messages
    const messagesContainer = document.getElementById('user-conversation-container');
    messagesContainer.innerHTML = '';
    
    if (!conversation.chat || conversation.chat.length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comment fa-3x"></i>
                <p>No conversation history</p>
            </div>
        `;
        return;
    }
    
    conversation.chat.forEach(msg => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${msg.role === 'assistant' ? 'bot' : ''}`;
        
        // Format timestamp
        const time = msg.time ? new Date(msg.time).toLocaleString() : '';
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                ${msg.role === 'assistant' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>'}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <div class="message-author">${msg.role === 'assistant' ? dashboardState.character.name : dashboardState.viewingUser.username}</div>
                    <div class="message-time">${time}</div>
                </div>
                <div class="message-text">${msg.content}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update servers display
function updateServersDisplay(serversData) {
    dashboardState.serversData = serversData;
    
    // Update count in badge
    document.getElementById('servers-count').textContent = serversData.length;
    
    // Update servers grid
    const container = document.getElementById('servers-grid');
    container.innerHTML = '';
    
    if (serversData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-server fa-3x"></i>
                <p>No servers found</p>
            </div>
        `;
        return;
    }
    
    serversData.forEach(server => {
        const serverCard = document.createElement('div');
        serverCard.className = 'server-card';
        serverCard.setAttribute('data-server-id', server.id);
        
        // Calculate server stats
        const userCount = server.users ? server.users.length : 0;
        const messageCount = server.recentMessages ? server.recentMessages.length : 0;
        const lastActivity = server.recentMessages && server.recentMessages.length > 0 
            ? new Date(server.recentMessages[server.recentMessages.length - 1].time || Date.now()).toLocaleDateString() 
            : 'Never';
        
        serverCard.innerHTML = `
            <div class="server-header">
                <div class="server-name">${server.name}</div>
                <div class="server-id">${server.id}</div>
            </div>
            <div class="server-stats">
                <div class="server-stat">
                    <div class="server-stat-value">${userCount}</div>
                    <div class="server-stat-label">Users</div>
                </div>
                <div class="server-stat">
                    <div class="server-stat-value">${messageCount}</div>
                    <div class="server-stat-label">Messages</div>
                </div>
                <div class="server-stat">
                    <div class="server-stat-value">${lastActivity}</div>
                    <div class="server-stat-label">Last Active</div>
                </div>
            </div>
        `;
        
        serverCard.addEventListener('click', () => {
            showServerDetail(server.id);
        });
        
        container.appendChild(serverCard);
    });
}

// Update counter display with animation
function updateCounter(element, newValue) {
    const currentValue = parseInt(element.textContent);
    if (currentValue === newValue) return;
    
    // Add animation class
    element.classList.add('counter-changing');
    
    // Animate to new value
    setTimeout(() => {
        element.textContent = newValue;
        setTimeout(() => {
            element.classList.remove('counter-changing');
        }, 300);
    }, 300);
}

// Socket events
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('character-info', (info) => {
    dashboardState.character = info;
    
    // Update UI
    botName.textContent = info.name;
    botRole.textContent = info.botRole || info.role;
    
    // Add to log
    addLogEntry(`[${new Date().toLocaleTimeString()} - System] Connected as ${info.name} (${info.botRole || info.role})`);
});

socket.on('allowed-users', (users) => {
    updateAllowedUsers(users);
});

socket.on('pending-requests', (requests) => {
    updatePendingRequests(requests);
});

socket.on('dm-request', (request) => {
    // Add to log
    addLogEntry(`[${new Date().toLocaleTimeString()} - DM Request] New request from ${request.username}`);
    
    // Show toast notification
    showToast(
        'New DM Request', 
        `${request.username} is requesting to chat`,
        'info'
    );
});

socket.on('activity-log', (log) => {
    addLogEntry(log);
});

socket.on('prompt-data', (data) => {
    dashboardState.lastPrompt = data;
    
    // Update UI
    document.getElementById('current-username').textContent = data.username;
    document.getElementById('current-prompt').textContent = data.prompt;
    document.getElementById('current-response').textContent = 'Processing...';
    
    // Update interaction time
    const time = new Date(data.timestamp).toLocaleString();
    document.getElementById('interaction-time').textContent = time;
    
    // Update bot status
    dashboardState.botState.currentAction = 'processing';
    updateBotStatusUI();
});

socket.on('prompt-response', (data) => {
    dashboardState.lastResponse = data;
    
    // Update UI
    document.getElementById('current-response').textContent = data.response;
    
    // Update message count
    updateCounter(document.getElementById('messages-today-count'), dashboardState.messageCount);
    
    // Update bot status
    dashboardState.botState.currentAction = 'idle';
    updateBotStatusUI();
});

socket.on('message-count', (count) => {
    dashboardState.messageCount = count;
    updateCounter(document.getElementById('messages-today-count'), count);
});

socket.on('bot-state', (state) => {
    dashboardState.botState = state;
    updateBotStatusUI();
});

socket.on('user-conversation', (conversation) => {
    updateUserConversation(conversation);
});

socket.on('server-user-conversation', (conversation) => {
    updateUserConversation(conversation);
});

socket.on('servers-data', (serversData) => {
    updateServersDisplay(serversData);
});

// Load theme from local storage
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('dashboardTheme');
    if (savedTheme) {
        setTheme(savedTheme);
        
        // Update theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-theme') === savedTheme);
        });
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    loadSavedTheme();
});

// Add this to the settings section HTML (before existing settings cards)

// Find the end of the <div id="settings-section"> element and add this code right after the opening tag:
// This code adds an AI Provider settings card with radio buttons

// In the initializeUI function, add this section to create the AI provider settings UI
function createAIProviderSettings() {
    const settingsSection = document.getElementById('settings-section');
    if (!settingsSection) return;
    
    // Create AI Provider settings card
    const aiProviderCard = document.createElement('div');
    aiProviderCard.className = 'setting-card';
    aiProviderCard.innerHTML = `
        <h3>AI Provider</h3>
        <div class="setting-content">
            <div class="ai-provider-options">
                <div class="provider-option">
                    <input type="radio" id="provider-openrouter" name="ai-provider" value="openrouter">
                    <label for="provider-openrouter">OpenRouter</label>
                    <div class="provider-description">Primary LLM provider with wide model selection</div>
                </div>
                <div class="provider-option">
                    <input type="radio" id="provider-chutes" name="ai-provider" value="chutes">
                    <label for="provider-chutes">Chutes.ai</label>
                    <div class="provider-description">Alternative provider with OpenAI-compatible API</div>
                </div>
                <div class="provider-option">
                    <input type="radio" id="provider-gemini" name="ai-provider" value="gemini">
                    <label for="provider-gemini">Gemini</label>
                    <div class="provider-description">Google's AI model for text generation</div>
                </div>
                <div class="provider-option">
                    <input type="radio" id="provider-colab" name="ai-provider" value="colab">
                    <label for="provider-colab">Colab</label>
                    <div class="provider-description">Custom hosted model via Gradio</div>
                </div>
            </div>
            <div class="provider-status">Current provider: <span id="current-provider">Loading...</span></div>
        </div>
    `;
    
    // Insert the card at the beginning of the settings section
    if (settingsSection.firstChild) {
        settingsSection.insertBefore(aiProviderCard, settingsSection.firstChild);
    } else {
        settingsSection.appendChild(aiProviderCard);
    }
    
    // Add event listeners to radio buttons
    document.querySelectorAll('input[name="ai-provider"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                socket.emit('changeAIProvider', this.value);
                showToast(`Switching AI provider to ${this.value}...`);
            }
        });
    });
}

// Then, call this function in your initializeUI function
// Add to the existing initializeUI function:
createAIProviderSettings();

// Add this code to handle socket events for AI provider changes
// This should be in the section where you set up socket event listeners:

// Listen for AI provider info
socket.on('aiProviderInfo', (data) => {
    // Update the current provider display
    const currentProviderElement = document.getElementById('current-provider');
    if (currentProviderElement) {
        currentProviderElement.textContent = data.current || 'Unknown';
    }
    
    // Check the correct radio button
    const radioButton = document.getElementById(`provider-${data.current}`);
    if (radioButton) {
        radioButton.checked = true;
    }
});

// Listen for AI provider changes
socket.on('aiProviderChanged', (provider) => {
    // Update the current provider display
    const currentProviderElement = document.getElementById('current-provider');
    if (currentProviderElement) {
        currentProviderElement.textContent = provider;
    }
    
    // Check the correct radio button
    const radioButton = document.getElementById(`provider-${provider}`);
    if (radioButton) {
        radioButton.checked = true;
    }
    
    showToast(`AI provider changed to ${provider}`);
});

// Also update the message display to show which AI was used:
// Find the function that adds messages to the chat and modify it to include provider info
function addMessageToChat(message) {
    // Your existing code to create message element
    
    // Add provider info if available
    if (message.provider) {
        const providerInfo = document.createElement('div');
        providerInfo.className = 'message-provider';
        
        let providerText = `Via: ${message.provider}`;
        if (message.wasFallback) {
            providerText += ' (fallback)';
        }
        
        providerInfo.textContent = providerText;
        messageElement.appendChild(providerInfo);
    }
    
    // Rest of your existing code
}