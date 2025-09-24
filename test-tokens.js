// Simple test to verify character-specific tokens
require('dotenv').config();
const { getCharacter } = require('./characters');
const himari = require('./characters/himari');
const rudra = require('./characters/rudra');

console.log('=== Character Token Test ===');

// Test default character
const defaultChar = getCharacter();
console.log(`Default character: ${defaultChar.name}`);
console.log(`Token source: ${defaultChar.token === process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN (default)' : 
  defaultChar.token === process.env[`${defaultChar.botRole.toUpperCase()}_TOKEN`] ? 
  `${defaultChar.botRole.toUpperCase()}_TOKEN (character-specific)` : 'Unknown'}`);
console.log('Token: ' + (defaultChar.token ? defaultChar.token.substring(0, 12) + '...' : 'not set'));

// Test each character specifically
console.log('\n=== Character-Specific Tokens ===');

['himari', 'rudra'].forEach(charName => {
  const char = require(`./characters/${charName}`);
  const envVarName = `${charName.toUpperCase()}_TOKEN`;
  const hasSpecificToken = process.env[envVarName] !== undefined;
  
  console.log(`\n${char.name}:`);
  console.log(`- Character-specific token (${envVarName}): ${hasSpecificToken ? 'Set' : 'Not set'}`);
  console.log(`- Using token: ${hasSpecificToken ? envVarName : 'DISCORD_TOKEN (fallback)'}`);
  console.log(`- Token value: ${char.token ? char.token.substring(0, 12) + '...' : 'not set'}`);
});

// Show how to run each character
console.log('\n=== Running Commands ===');
console.log('To run Himari: node run.js himari');
console.log('To run Rudra:  node run.js rudra'); 