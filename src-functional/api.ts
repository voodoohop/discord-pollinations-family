import axios from 'axios';
import debug from 'debug';
import { ApiClient, ApiMessage } from './types';

const log = debug('app:api');

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Simple delay function
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create an API client for the Pollinations API
 */
export const createApiClient = (baseUrl: string): ApiClient => {
  log('API Client created with baseUrl: %s', baseUrl);
  
  return {
    /**
     * Generate text using a simple prompt
     */
    generateText: async (prompt: string, model: string, systemPrompt?: string): Promise<string> => {
      const url = `${baseUrl}/chat/completions`;
      const messages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ];
      
      const response = await axios.post(url, { model, messages });
      return response.data.choices[0].message.content;
    },

    /**
     * Generate text using conversation history
     */
    generateTextWithHistory: async (messages: ApiMessage[], model: string, systemPrompt?: string): Promise<string> => {
      const url = `${baseUrl}/chat/completions`;
      const apiMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages
      ];

      // Try with retries for transient errors
      let lastError;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Add a small delay between retries
          if (attempt > 0) {
            log('Retry attempt %d for model %s', attempt, model);
            await delay(RETRY_DELAY_MS * attempt);
          }
          
          const response = await axios.post(url, { model, messages: apiMessages });
          return response.data.choices[0].message.content;
        } catch (error) {
          lastError = error;
          
          // Only log minimal error info
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const errorMessage = error.response?.data?.error;
            
            log('API Error %d: %s', status || 'unknown', errorMessage || error.message);
            
            // For debugging 422 errors, log just the essential info
            if (status === 422) {
              // Log only the model and number of messages
              log('Request info - Model: %s, Messages: %d', model, apiMessages.length);
              
              // Log just the roles sequence to help debug
              const roles = apiMessages.map(m => m.role).join(', ');
              log('Message roles: %s', roles);
            }
            
            // Don't retry for client errors (4xx)
            if (status && status >= 400 && status < 500) {
              break;
            }
          }
        }
      }
      
      // If we got here, all retries failed
      throw lastError;
    }
  };
};
