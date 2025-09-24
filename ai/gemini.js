/**
 * Gemini AI integration module
 * Handles all interactions with Google's Gemini API
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const settings = require('../settings');
const dashboard = require('../dashboard/server');

// Initialize the Gemini client
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Prepares an image for Gemini API
 * @param {Buffer} imageBuffer - Raw image data
 * @returns {Object} - Formatted image for Gemini
 */
async function prepareImagePart(imageBuffer) {
  if (!imageBuffer) return null;
  
  try {
    const mimeType = 'image/png'; // Assuming PNG format
    return {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType
      }
    };
  } catch (err) {
    console.error('Error preparing image for Gemini:', err);
    return null;
  }
}

/**
 * Ask Gemini for a response
 * @param {string} prompt - The text prompt to send to Gemini
 * @param {Buffer} imageBuffer - Optional image data to include
 * @param {string} userId - User ID for tracking
 * @param {string} systemInstruction - System instruction for context
 * @param {Object} memory - Optional memory data
 * @returns {Promise<string>} - The text response from Gemini
 */
async function askGemini(prompt, imageBuffer = null, userId = null, systemInstruction = null, memory = null) {
  try {
    dashboard.logActivity('Gemini is thinking...');
    
    // Log basic request info in debug mode
    if (settings.DEBUG_MODE) {
      console.log(`Gemini - Using model: ${settings.GEMINI_MODEL}`);
      console.log(`Gemini - System instruction length: ${systemInstruction ? systemInstruction.length : 0}`);
      console.log(`Gemini - Prompt length: ${prompt ? prompt.length : 0}`);
      console.log(`Gemini - Image included: ${!!imageBuffer}`);
      
      if (memory) {
        console.log(`Gemini - Memory included with trust level: ${memory.trustLevel || 'undefined'}`);
      }
    }
    
    // Get the model
    const model = genAI.getGenerativeModel({
      model: settings.GEMINI_MODEL
    });
    
    // Prepare the content
    let content = [];
    
    // Add system instruction if provided
    let fullPrompt = prompt;
    if (systemInstruction) {
      fullPrompt = `${systemInstruction}\n\n${prompt}`;
    }
    
    // Add memory context if provided
    if (memory) {
      // Format memory for inclusion in the prompt
      const memoryContext = formatMemoryForPrompt(memory);
      if (memoryContext) {
        fullPrompt = `${memoryContext}\n\n${fullPrompt}`;
      }
    }
    
    // Add text content
    content.push({
      role: 'user',
      parts: [{ text: fullPrompt }]
    });
    
    // Add image if provided and enabled
    if (settings.ENABLE_IMAGE_SUPPORT && imageBuffer) {
      try {
        const imagePart = await prepareImagePart(imageBuffer);
        if (imagePart) {
          // For multimodal models, we need to include both text and image
          content[0].parts.push(imagePart);
        }
      } catch (imageErr) {
        console.error('Error adding image to Gemini request:', imageErr);
        // Continue without image if there's an error
      }
    }
    
    if (settings.DEBUG_MODE) {
      console.log(`Gemini - Generated ${content[0].parts.length} content parts`);
    }
    
    // Configure generation parameters
    const generationConfig = {
      temperature: 0.9,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 8192,
    };
    
    // Create chat session
    const chat = model.startChat({
      generationConfig,
      history: []
    });
    
    // Send the request
    const result = await chat.sendMessage(content[0].parts);
    const response = result.response;
    
    if (settings.DEBUG_MODE) {
      console.log('Gemini response received successfully');
      
      if (response) {
        console.log(`Gemini response has ${response.candidates?.length || 0} candidates`);
        console.log(`Gemini response has ${response.promptFeedback ? 'prompt feedback' : 'no prompt feedback'}`);
      }
    }
    
    // Check for safety ratings
    if (response.promptFeedback && response.promptFeedback.blockReason) {
      console.warn(`Gemini blocked response due to: ${response.promptFeedback.blockReason}`);
      dashboard.logActivity(`Gemini blocked response: ${response.promptFeedback.blockReason}`);
      throw new Error(`Response blocked: ${response.promptFeedback.blockReason}`);
    }
    
    // Extract the text
    if (response && response.text) {
      return response.text();
    }
    
    // If we get here, it means the response format was unexpected
    console.error('Unexpected Gemini response format:', JSON.stringify(response, null, 2));
    throw new Error('Unexpected response format from Gemini');
  } catch (err) {
    const errorMessage = err.message || 'Unknown error';
    
    console.error('Gemini API error:', errorMessage);
    
    // Log more detailed error information
    if (err.response) {
      console.error('Gemini error response:', JSON.stringify(err.response, null, 2));
    }
    
    // Handle specific errors
    if (errorMessage.includes('API key')) {
      dashboard.logActivity('Gemini API key error - please check your configuration');
      throw new Error('Gemini API key error');
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      dashboard.logActivity('Gemini API rate limit exceeded - please try again later');
      throw new Error('Gemini rate limit exceeded');
    } else if (errorMessage.includes('blocked')) {
      dashboard.logActivity('Gemini blocked the response due to content policy');
      throw new Error('Gemini content policy violation');
    }
    
    dashboard.logActivity('Gemini API error: ' + errorMessage);
    throw new Error(`Gemini error: ${errorMessage}`);
  }
}

/**
 * Format memory data as a context string for the prompt
 * @param {Object} memory - Memory object with facts and levels
 * @returns {string} - Formatted memory context
 */
function formatMemoryForPrompt(memory) {
  if (!memory) return '';
  
  let context = 'User information:\n';
  
  // Add facts
  if (memory.facts && memory.facts.length > 0) {
    context += memory.facts.map(fact => `- ${fact}`).join('\n');
  } else {
    context += '- No facts known yet.';
  }
  
  context += '\n\n';
  
  // Add relationship metrics
  if (memory.trustLevel !== undefined) {
    context += `Trust level: ${memory.trustLevel}/10\n`;
  }
  
  if (memory.romanticLevel !== undefined) {
    context += `Romantic level: ${memory.romanticLevel}/10\n`;
  }
  
  if (memory.censorshipLevel !== undefined) {
    context += `Censorship level: ${memory.censorshipLevel}/10\n`;
  }
  
  return context;
}

module.exports = {
  askGemini
}; 