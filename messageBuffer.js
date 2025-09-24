/**
 * Message buffer system for batching multiple messages and handling reply context
 */
const messageBuffers = {};
const BUFFER_TIMEOUT = 3000; // 3 seconds

/**
 * Process a new message and decide whether to buffer it or handle immediately
 * @param {Object} message - Discord.js message object
 * @param {Function} processFn - Function to call when ready to process message(s)
 */
async function handleMessage(message, processFn) {
    const userId = message.author.id;
    const content = message.content;
    const referencedMessage = message.reference ? message.reference : null;
    let replyContext = null;

    // If this is a reply to another message, retrieve the original
    if (referencedMessage) {
        try {
            // Different versions of Discord.js have different ways to fetch messages
            // Try both the newer and older methods
            let fetchedMessage = null;
            
            // First try the Discord.js v13 way (could be channel.messages or channel method)
            if (typeof message.channel.messages?.fetch === 'function') {
                fetchedMessage = await message.channel.messages.fetch(referencedMessage.messageId);
            } 
            // Then try direct channel fetch method
            else if (typeof message.channel.fetch === 'function') {
                fetchedMessage = await message.channel.fetch(referencedMessage.messageId);
            }
            // Finally try fetchMessage which is in older Discord.js versions
            else if (typeof message.channel.fetchMessage === 'function') {
                fetchedMessage = await message.channel.fetchMessage(referencedMessage.messageId);
            }
            
            // If we successfully fetched the message
            if (fetchedMessage) {
                replyContext = {
                    content: fetchedMessage.content,
                    author: fetchedMessage.author.id
                };
            }
            
            // Continue with buffering including any found reply context
            bufferMessage(userId, content, processFn, replyContext);
        } catch (err) {
            console.error('Error fetching referenced message:', err.message);
            // Still process the message without the reply context
            bufferMessage(userId, content, processFn);
        }
    } else {
        // No reference, just buffer normally
        bufferMessage(userId, content, processFn);
    }
}

/**
 * Buffer a message or process it if the buffer times out
 * @param {string} userId - Discord user ID
 * @param {string} content - Message content
 * @param {Function} processFn - Function to call when processing
 * @param {Object} replyContext - Optional context from a replied-to message
 */
function bufferMessage(userId, content, processFn, replyContext = null) {
    // Initialize buffer for this user if it doesn't exist
    if (!messageBuffers[userId]) {
        messageBuffers[userId] = {
            messages: [],
            timer: null,
            replyContext: null
        };
    }

    // Store reply context if provided (only keep the most recent one if multiple)
    if (replyContext) {
        messageBuffers[userId].replyContext = replyContext;
    }

    // Add message to buffer
    messageBuffers[userId].messages.push(content);

    // Clear existing timeout if any
    if (messageBuffers[userId].timer) {
        clearTimeout(messageBuffers[userId].timer);
    }

    // Set a new timeout to process the messages
    messageBuffers[userId].timer = setTimeout(() => {
        processBuffer(userId, processFn);
    }, BUFFER_TIMEOUT);
}

/**
 * Process buffered messages when timeout occurs
 * @param {string} userId - Discord user ID
 * @param {Function} processFn - Function to call with combined message
 */
function processBuffer(userId, processFn) {
    if (!messageBuffers[userId]) return;

    const { messages, replyContext } = messageBuffers[userId];
    
    if (messages.length > 0) {
        // Combine all buffered messages
        const combinedContent = messages.join('\n');
        
        // Create combined message object to pass to the processor
        const combinedMessage = {
            content: combinedContent,
            replyContext: replyContext
        };
        
        // Process the combined message
        processFn(userId, combinedMessage);
        
        // Clear the buffer
        delete messageBuffers[userId];
    }
}

module.exports = {
    handleMessage
}; 