/**
 * Chutes.ai integration module
 * Handles all interactions with Chutes.ai API
 */
const axios = require('axios');
const settings = require('../settings');
const dashboard = require('../dashboard/server');

/**
 * Formats chat history into Chutes-compatible messages array
 * @param {Array} chatHistory - Array of chat messages with role and content
 * @param {string} systemInstruction - System instruction for the AI
 * @param {Object} memory - User memory object containing facts and levels
 * @returns {Array} - Formatted messages array for Chutes
 */
function formatChutesMessages(chatHistory, systemInstruction, memory = null) {
  const messages = [];
  
  // Add system message with instructions and memory context if available
  if (systemInstruction) {
    let systemMessage = systemInstruction;
    
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
    
    messages.push({
      role: 'system',
      content: systemMessage
    });
  }
  
  // Add chat history
  if (chatHistory && chatHistory.length) {
    // Convert chat history to Chutes format
    chatHistory.forEach(msg => {
      // Make sure content is a string
      let content = typeof msg.content === 'string' ? msg.content : String(msg.content);
      
      // Map 'user' and character roles to Chutes roles (using OpenAI-compatible format)
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
 * Formats an image for inclusion in a Chutes message
 * @param {Buffer} imageBuffer - Raw image data
 * @returns {Object} - Formatted image data for Chutes
 */
function formatChutesImage(imageBuffer) {
  if (!imageBuffer) return null;
  
  // Convert buffer to base64
  const base64Image = imageBuffer.toString('base64');
  
  return {
    type: "image",
    data: base64Image,
    format: "png"
  };
}

/**
 * Ask Chutes.ai for a response
 * @param {string|Array} prompt - The text prompt or messages array
 * @param {Buffer} imageBuffer - Optional image data to include
 * @param {string} userId - User ID for tracking
 * @param {string} systemInstruction - System instruction for context
 * @param {Object} memory - Optional memory data to include
 * @returns {Promise<string>} - The text response from Chutes
 */
async function askChutes(prompt, imageBuffer = null, userId = null, systemInstruction = null, memory = null) {
  try {
    dashboard.logActivity('Chutes.ai is thinking...');
    
    // Determine if prompt is already in message format or needs conversion
    let messages;
    
    if (Array.isArray(prompt)) {
      // Already in message format
      messages = prompt;
      
      // Add system message if provided and not already present
      if (systemInstruction && !messages.some(m => m.role === 'system')) {
        messages.unshift({ role: 'system', content: systemInstruction });
      }
    } else {
      // It's a text prompt, convert to message format
      messages = formatChutesMessages([], systemInstruction, memory);
      messages.push({ role: 'user', content: prompt });
    }
    
    // Prepare the request payload
    const payload = {
      messages: messages,
      model: settings.CHUTES_MODEL || "gpt-4",
      temperature: settings.CHUTES_TEMPERATURE || 0.7,
      max_tokens: settings.CHUTES_MAX_TOKENS || 2048
    };
    
    // Add image if provided and enabled
    if (settings.ENABLE_IMAGE_SUPPORT && imageBuffer) {
      // For Chutes, add image to the last user message
      const lastUserMessageIndex = [...messages].reverse().findIndex(m => m.role === 'user');
      if (lastUserMessageIndex >= 0) {
        const actualIndex = messages.length - 1 - lastUserMessageIndex;
        const formattedImage = formatChutesImage(imageBuffer);
        
        // Convert content to array if it's not already
        if (!Array.isArray(messages[actualIndex].content)) {
          const textContent = messages[actualIndex].content;
          messages[actualIndex].content = [
            { type: "text", text: textContent },
            formattedImage
          ];
        } else {
          // Content is already an array, add the image
          messages[actualIndex].content.push(formattedImage);
        }
      }
    }
    
    if (settings.DEBUG_MODE) {
      console.log(`Chutes - Using model: ${payload.model}`);
      console.log(`Chutes - Message count: ${messages.length}`);
      console.log(`Chutes - First message role: ${messages[0]?.role}`);
      console.log(`Chutes - Last message role: ${messages[messages.length-1]?.role}`);
      
      // Log limited payload to avoid overwhelming logs
      if (messages.length <= 3) {
        console.log('Chutes - Full payload:', JSON.stringify(payload, null, 2));
      }
    }
    
    // Make API request to Chutes
    const response = await axios.post('https://llm.chutes.ai/v1/chat/completions', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.CHUTES_API_KEY}`
      },
      timeout: settings.CHUTES_TIMEOUT || 60000
    });
    
    // Log response status
    if (settings.DEBUG_MODE) {
      console.log(`Chutes response status: ${response.status}`);
      
      if (response.data) {
        console.log('Chutes response data structure:', JSON.stringify({
          hasChoices: !!response.data.choices,
          choicesLength: response.data.choices?.length || 0,
          firstChoice: response.data.choices?.[0] ? {
            hasMessage: !!response.data.choices[0].message,
            messageRole: response.data.choices[0].message?.role
          } : null
        }, null, 2));
      }
    }
    
    // Process the response (following OpenAI format)
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const assistantMessage = response.data.choices[0].message;
      
      if (assistantMessage && assistantMessage.content) {
        return assistantMessage.content.trim();
      }
    }
    
    // If we get here, something is wrong with the response format
    console.error('Unexpected Chutes response format:', JSON.stringify(response.data, null, 2));
    throw new Error('Unexpected response format from Chutes');
  } catch (err) {
    console.error('Chutes API error:', err.message);
    
    // Handle specific error cases
    if (err.response) {
      // The request was made and the server responded with a status code
      console.error(`Chutes API status code: ${err.response.status}`);
      console.error('Chutes error response headers:', err.response.headers);
      
      if (err.response.data) {
        console.error('Chutes error response data:', JSON.stringify(err.response.data, null, 2));
      }
      
      if (err.response.status === 429) {
        dashboard.logActivity('Chutes rate limit exceeded - please try again later');
        throw new Error('Chutes rate limit exceeded');
      } else if (err.response.status === 401 || err.response.status === 403) {
        dashboard.logActivity('Chutes authentication error - check your API key');
        throw new Error('Chutes authentication error');
      } else if (err.response.status >= 500) {
        dashboard.logActivity('Chutes server error - the service may be experiencing issues');
        throw new Error('Chutes server error');
      }
    } else if (err.request) {
      // The request was made but no response was received
      console.error('Chutes no response received');
      dashboard.logActivity('Chutes timeout or no response');
      throw new Error('Chutes timeout or no response');
    }
    
    // Log a friendlier message to the dashboard
    dashboard.logActivity('Chutes API error: ' + err.message);
    throw new Error(`Chutes error: ${err.message}`);
  }
}

module.exports = {
  askChutes,
  formatChutesMessages
}; 