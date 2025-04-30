import axios from 'axios';
import debug from 'debug';
import { GenerateTextWithHistory, ApiMessage } from './types';

const log = debug('app:api');

/**
 * Create a text generation function for the Pollinations API
 */
export const createGenerateTextWithHistory = (baseUrl: string): GenerateTextWithHistory => {
  log('API Client created with baseUrl: %s', baseUrl);
  
  /**
   * Generate text using conversation history
   */
  return async (messages: ApiMessage[], model: string, systemPrompt?: string): Promise<string> => {
    const url = `${baseUrl}/chat/completions`;
    const apiMessages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages
    ];
    
    const response = await axios.post(url, { model, messages: apiMessages });
    return response.data.choices[0].message.content;
  };
};
