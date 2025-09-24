/**
 * AI integration module
 * Provides a unified interface for interacting with different AI providers
 */
const settings = require('../settings');
const openrouter = require('./openrouter');
const gemini = require('./gemini');
const colab = require('./colab');
const chutes = require('./chutes');
const memory = require('../utils/memory');
const dashboard = require('../dashboard/server');

/**
 * Converts OpenRouter message format to simple text prompt for Gemini/Colab
 * @param {Array} messages - Array of messages in OpenRouter format
 * @returns {string} - Flattened prompt text
 */
function convertMessagesToSimplePrompt(messages) {
  if (!Array.isArray(messages)) {
    console.error('Expected messages array but got:', typeof messages);
    return '';
  }
  
  let result = '';
  
  messages.forEach(msg => {
    if (!msg || typeof msg !== 'object') {
      console.error('Invalid message format:', msg);
      return;
    }
    
    const role = msg.role;
    let content = msg.content;
    
    // Handle different content formats
    if (Array.isArray(content)) {
      // For multimodal content, extract just the text parts
      content = content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n');
    } else if (typeof content !== 'string') {
      content = String(content);
    }
    
    // Format based on role
    if (role === 'system') {
      result += `[System Instructions]\n${content}\n\n`;
    } else if (role === 'user') {
      result += `User: ${content}\n\n`;
    } else if (role === 'assistant') {
      result += `Assistant: ${content}\n\n`;
    }
  });
  
  return result.trim();
}

/**
 * Unified function to ask an AI for a response
 * Uses primary AI provider with fallback support
 * @param {string|Array} prompt - Text prompt or messages array
 * @param {Buffer} imageData - Optional image data
 * @param {string} userId - User ID for tracking
 * @param {string} systemInstructions - System instructions for context
 * @param {Object} memory - User memory object
 * @param {Array} chatHistory - Chat history for context
 * @returns {Promise<string>} - AI response text
 */
async function askAI(prompt, imageData = null, userId = null, systemInstructions = null, memory = null, chatHistory = null) {
  // Determine which AI provider to use as primary
  const primaryAI = settings.PRIMARY_AI.toLowerCase();
  
  try {
    // Format messages for OpenRouter if needed
    let formattedMessages = null;
    if (primaryAI === 'openrouter' && !Array.isArray(prompt) && chatHistory) {
      formattedMessages = openrouter.formatChatMessages(chatHistory, systemInstructions, memory);
    }
    
    // Record which AI is being used
    let usedAI = primaryAI;
    let usedAsFallback = false;
    
    if (settings.DEBUG_MODE) {
      console.log(`Using ${primaryAI} as primary AI provider`);
      if (formattedMessages) {
        console.log(`Formatted ${formattedMessages.length} messages for ${primaryAI}`);
      }
    }
    
    // Try primary AI provider first
    try {
      let response;
      
      if (primaryAI === 'openrouter') {
        if (formattedMessages) {
          response = await openrouter.askOpenRouter(formattedMessages, imageData, userId);
        } else {
          response = await openrouter.askOpenRouter(prompt, imageData, userId, systemInstructions, memory);
        }
      } else if (primaryAI === 'gemini') {
        response = await gemini.askGemini(prompt, imageData, userId, systemInstructions, memory);
      } else if (primaryAI === 'chutes') {
        response = await chutes.askChutes(prompt, imageData, userId, systemInstructions, memory);
      } else if (primaryAI === 'colab') {
        response = await colab.askColab(prompt, imageData, userId, systemInstructions);
      } else {
        throw new Error(`Unknown AI provider: ${primaryAI}`);
      }
      
      // Log which AI was used
      dashboard.logActivity(`Response generated using ${usedAI}`);
      
      return {
        response: response,
        provider: usedAI,
        wasFallback: usedAsFallback
      };
    } catch (primaryError) {
      // If no fallback enabled, rethrow the error
      if (!settings.FALLBACK_ENABLED) {
        throw primaryError;
      }
      
      console.warn(`${primaryAI} error: ${primaryError.message}. Attempting fallback...`);
      dashboard.logActivity(`${primaryAI} error: ${primaryError.message}. Attempting fallback...`);
      
      // Try fallbacks in order
      if (!settings.FALLBACK_ORDER || settings.FALLBACK_ORDER.length === 0) {
        throw new Error(`Primary AI (${primaryAI}) failed and no fallbacks are configured`);
      }
      
      // Filter out the primary AI from fallbacks
      const fallbackOptions = settings.FALLBACK_ORDER.filter(ai => ai.toLowerCase() !== primaryAI);
      
      if (fallbackOptions.length === 0) {
        throw new Error(`Primary AI (${primaryAI}) failed and no other fallbacks are available`);
      }
      
      let lastError = primaryError;
      
      // Try each fallback
      for (const fallbackAI of fallbackOptions) {
        try {
          console.log(`Trying fallback AI: ${fallbackAI}`);
          dashboard.logActivity(`Trying fallback AI: ${fallbackAI}`);
          
          let response;
          usedAI = fallbackAI;
          usedAsFallback = true;
          
          // If we're falling back from OpenRouter to text-based AI, convert message format
          if (primaryAI === 'openrouter' && Array.isArray(formattedMessages) && 
              (fallbackAI === 'gemini' || fallbackAI === 'colab')) {
            const simplifiedPrompt = convertMessagesToSimplePrompt(formattedMessages);
            console.log(`Converted OpenRouter messages to simplified prompt for ${fallbackAI}`);
            
            if (fallbackAI === 'gemini') {
              response = await gemini.askGemini(simplifiedPrompt, imageData, userId, systemInstructions, memory);
            } else if (fallbackAI === 'colab') {
              response = await colab.askColab(simplifiedPrompt, imageData, userId, systemInstructions);
            }
          } else {
            // Normal fallback case
            if (fallbackAI === 'openrouter') {
              if (formattedMessages) {
                response = await openrouter.askOpenRouter(formattedMessages, imageData, userId);
              } else {
                response = await openrouter.askOpenRouter(prompt, imageData, userId, systemInstructions, memory);
              }
            } else if (fallbackAI === 'gemini') {
              response = await gemini.askGemini(prompt, imageData, userId, systemInstructions, memory);
            } else if (fallbackAI === 'chutes') {
              response = await chutes.askChutes(prompt, imageData, userId, systemInstructions, memory);
            } else if (fallbackAI === 'colab') {
              response = await colab.askColab(prompt, imageData, userId, systemInstructions);
            }
          }
          
          // Log successful fallback
          dashboard.logActivity(`Response generated using ${usedAI} (fallback)`);
          
          return {
            response: response,
            provider: usedAI,
            wasFallback: usedAsFallback
          };
        } catch (err) {
          console.warn(`Fallback AI ${fallbackAI} error: ${err.message}`);
          dashboard.logActivity(`Fallback AI ${fallbackAI} failed: ${err.message}`);
          lastError = err;
          // Continue to next fallback
        }
      }
      
      // If all fallbacks failed
      throw new Error(`All AI providers failed. Primary (${primaryAI}) error: ${primaryError.message}. Last fallback error: ${lastError.message}`);
    }
  } catch (err) {
    console.error('AI request failed:', err);
    dashboard.logActivity(`AI request failed: ${err.message}`);
    throw err;
  }
}

module.exports = {
  askAI
}; 