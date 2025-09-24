// Simple test to verify character-specific memory structure
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { loadMemory, saveMemory, loadChat, saveChat } = require('./memory');

const testUserId = 'test-user-123';

// Test for Himari character
console.log('Testing Himari memory structure...');
const himariMemory = loadMemory('himari', testUserId);
console.log('Himari memory loaded:', himariMemory);
himariMemory.facts.push(`Test fact added at ${new Date().toISOString()}`);
saveMemory('himari', testUserId, himariMemory);
console.log('Himari memory updated and saved');

// Test for Rudra character
console.log('\nTesting Rudra memory structure...');
const rudraMemory = loadMemory('rudra', testUserId);
console.log('Rudra memory loaded:', rudraMemory);
rudraMemory.facts.push(`Test fact added at ${new Date().toISOString()}`);
saveMemory('rudra', testUserId, rudraMemory);
console.log('Rudra memory updated and saved');

// Test chat functionality
console.log('\nTesting chat functionality...');
const chat = loadChat('himari', testUserId);
chat.push({
    role: 'user',
    content: 'This is a test message',
    time: Date.now()
});
chat.push({
    role: 'himari',
    content: 'This is a test response',
    time: Date.now()
});
saveChat('himari', testUserId, chat);
console.log('Chat updated and saved for Himari');

// Verify directory structure
console.log('\nVerifying directory structure:');
const memoryDir = path.join(__dirname, 'memory');

function listDirContents(dir, indent = '') {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
        const itemPath = path.join(dir, item);
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
            console.log(`${indent}📁 ${item}/`);
            listDirContents(itemPath, indent + '  ');
        } else {
            console.log(`${indent}📄 ${item} (${stats.size} bytes)`);
        }
    });
}

listDirContents(memoryDir);
console.log('\nTest completed successfully!'); 