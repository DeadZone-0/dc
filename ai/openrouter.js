/**
 * OpenRouter.ai integration module
 * Handles all interactions with OpenRouter's API
 */
const axios = require('axios');
const settings = require('../settings');
const dashboard = require('../dashboard/server');

/**
 * Formats chat history into OpenRouter-compatible messages array
 * @param {Array} chatHistory - Array of chat messages with role and content
 * @param {string} systemInstruction - System instruction for the AI
 * @param {Object} memory - User memory object containing facts and levels
 * @returns {Array} - Formatted messages array for OpenRouter
 */
function formatChatMessages(chatHistory, systemInstruction, memory = null) {
  const messages = [];
  
  // Add system message with instructions and memory context if available
  let systemMessage = systemInstruction || '';
  
  if (memory) {
    // Add memory facts and relationship metrics to system message
    const facts = memory.facts?.length ? memory.facts.join('\n- ') : 'No facts known yet.';
    systemMessage += `\n\nUser information:\n- ${facts}\n\n`;
    
    if (memory.trustLevel !== undefined) {
      systemMessage += `Trust level: ${memory.trustLevel}/10\n`;
    }
    
    if (memory.romanticLevel !== undefined) {
      systemMessage += `Romantic level: ${memory.romanticLevel}/10\n`;
    }
    
    if (memory.censorshipLevel !== undefined) {
      systemMessage += `Censorship level: ${memory.censorshipLevel}/10\n`;
    }
  }
  
  // Add the system message
  messages.push({
    role: 'system',
    content: systemMessage
  });
  
  // Add chat history
  if (chatHistory && chatHistory.length) {
    // Convert chat history to OpenRouter format
    chatHistory.forEach(msg => {
      // Make sure content is a string
      let content = typeof msg.content === 'string' ? msg.content : String(msg.content);
      
      // Map 'user' and character roles to OpenRouter roles
      let role = msg.role === 'user' ? 'user' : 'assistant';
      
      messages.push({
        role: role,
        content: content
      });
    });
  }
  
  return messages;
}

/**
 * Formats an image for inclusion in an OpenRouter message
 * @param {Buffer} imageBuffer - Raw image data
 * @returns {Object} - Formatted image object for OpenRouter
 */
function formatImageContent(imageBuffer) {
  // Convert buffer to base64
  const base64Image = imageBuffer.toString('base64');
  
  return {
    type: "image_url",
    image_url: {
      url: `data:image/png;base64,${base64Image}`
    }
  };
}

/**
 * Validates the messages array to ensure it's properly formatted for OpenRouter
 * @param {Array} messages - Array of messages to validate
 * @returns {boolean} - Whether the messages array is valid
 */
function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    console.error('Messages is not an array');
    return false;
  }
  
  // Check each message for required fields
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    // Check basic structure
    if (!msg || typeof msg !== 'object') {
      console.error(`Message at index ${i} is not an object`);
      return false;
    }
    
    // Check for required role field
    if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
      console.error(`Message at index ${i} has invalid role: ${msg.role}`);
      return false;
    }
    
    // Check content field
    if (msg.content === undefined || msg.content === null) {
      console.error(`Message at index ${i} is missing content`);
      return false;
    }
    
    // If content is an array (multimodal), check each part
    if (Array.isArray(msg.content)) {
      for (let j = 0; j < msg.content.length; j++) {
        const part = msg.content[j];
        if (!part.type) {
          console.error(`Part at index ${j} in message ${i} is missing type`);
          return false;
        }
        
        if (part.type === 'text' && typeof part.text !== 'string') {
          console.error(`Text part at index ${j} in message ${i} has invalid text`);
          return false;
        }
        
        if (part.type === 'image_url' && !part.image_url?.url) {
          console.error(`Image part at index ${j} in message ${i} is missing URL`);
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Ask OpenRouter for a response
 * @param {string} prompt - The text prompt or full chat history array
 * @param {Buffer} imageBuffer - Optional image data to include with the prompt
 * @param {string} userId - User ID for tracking
 * @param {string} systemInstruction - System instruction for context
 * @param {Object} memory - Optional memory data to include
 * @returns {Promise<string>} - The text response from OpenRouter
 */
async function askOpenRouter(prompt, imageBuffer = null, userId = null, systemInstruction = null, memory = null) {
  try {
    dashboard.logActivity('OpenRouter is thinking...');
    
    // Determine if prompt is already in OpenRouter format or needs conversion
    let messages;
    
    if (Array.isArray(prompt)) {
      // Already in message format
      messages = prompt;
      
      // Add system message if provided and not already present
      if (systemInstruction && !messages.some(m => m.role === 'system')) {
        messages.unshift({ role: 'system', content: systemInstruction });
      }
    } else {
      // It's a text prompt, convert to message format and add chat history if available
      const lastMessage = { role: 'user', content: prompt };
      
      // If memory is provided, add system context
      messages = formatChatMessages([], systemInstruction, memory);
      
      // Add the user's message
      if (settings.ENABLE_IMAGE_SUPPORT && imageBuffer) {
        // For multimodal models, include both text and image
        lastMessage.content = [
          { type: "text", text: prompt },
          formatImageContent(imageBuffer)
        ];
      }
      
      messages.push(lastMessage);
    }
    
    // Validate messages array
    if (!validateMessages(messages)) {
      throw new Error('Invalid message format for OpenRouter');
    }
    
    // Prepare the request payload
    const payload = {
      model: settings.OPENROUTER_MODEL,
      messages: messages,
      temperature: settings.OPENROUTER_TEMPERATURE,
      max_tokens: settings.OPENROUTER_MAX_TOKENS
    };
    
    if (settings.DEBUG_MODE) {
      console.log(`OpenRouter - Sending request to model: ${settings.OPENROUTER_MODEL}`);
      console.log(`OpenRouter - Message count: ${messages.length}`);
      console.log(`OpenRouter - First message role: ${messages[0]?.role}`);
      console.log(`OpenRouter - Last message role: ${messages[messages.length-1]?.role}`);
      
      // To avoid spamming logs with large message content
      if (messages.length <= 3) {
        console.log('OpenRouter - Full payload:', JSON.stringify(payload, null, 2));
      }
    }
    
    // Make API request to OpenRouter
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://discord-bot.example.com',  // Replace with your actual domain
        'X-Title': 'Discord AI Bot'
      },
      timeout: settings.OPENROUTER_TIMEOUT
    });
    
    // Log response status and basic info
    console.log(`OpenRouter response status: ${response.status}`);
    
    if (settings.DEBUG_MODE && response.data) {
      console.log('OpenRouter response data:', JSON.stringify({
        model: response.data.model,
        id: response.data.id,
        created: response.data.created,
        hasChoices: !!response.data.choices,
        choicesLength: response.data.choices?.length || 0
      }, null, 2));
    }
    
    // Process the response
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const assistantMessage = response.data.choices[0].message;
      
      if (settings.DEBUG_MODE) {
        console.log('OpenRouter message data:', JSON.stringify({
          role: assistantMessage?.role,
          hasContent: !!assistantMessage?.content,
          contentLength: assistantMessage?.content?.length || 0
        }, null, 2));
      }
      
      if (assistantMessage && assistantMessage.content) {
        return assistantMessage.content.trim();
      }
    }
    
    // If we got here, something is wrong with the response format
    console.error('Unexpected OpenRouter response format:', JSON.stringify(response.data, null, 2));
    throw new Error('Unexpected response format from OpenRouter');
  } catch (err) {
    console.error('OpenRouter API error:', err.message);
    
    // Handle specific error cases
    if (err.response) {
      // The request was made and the server responded with an error status
      console.error(`OpenRouter API status code: ${err.response.status}`);
      console.error('OpenRouter error response headers:', err.response.headers);
      
      // Log response data if available (helpful for debugging API issues)
      if (err.response.data) {
        console.error('OpenRouter error response data:', JSON.stringify(err.response.data, null, 2));
      }
      
      if (err.response.status === 429) {
        dashboard.logActivity('OpenRouter rate limit exceeded - please try again later');
        throw new Error('OpenRouter rate limit exceeded');
      } else if (err.response.status === 401 || err.response.status === 403) {
        dashboard.logActivity('OpenRouter authentication error - check your API key');
        throw new Error('OpenRouter authentication error');
      } else if (err.response.status >= 500) {
        dashboard.logActivity('OpenRouter server error - the service may be experiencing issues');
        throw new Error('OpenRouter server error');
      }
    } else if (err.request) {
      // The request was made but no response was received
      console.error('OpenRouter no response received:', err.request);
      dashboard.logActivity('OpenRouter timeout or no response');
      throw new Error('OpenRouter timeout or no response');
    }
    
    // Log a friendlier message to the dashboard
    dashboard.logActivity('OpenRouter API error: ' + err.message);
    throw new Error(`OpenRouter error: ${err.message}`);
  }
}

module.exports = {
  askOpenRouter,
  formatChatMessages
}; 