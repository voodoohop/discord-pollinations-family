import axios from 'axios';
import { pollinationsConfig } from '../config';
import debug from 'debug';

const log = debug('app:api');

/**
 * Service for interacting with the Pollinations API
 * Following the "thin proxy" design principle:
 * - No unnecessary data transformation
 * - Direct pass-through of responses
 * - Simple error handling
 */
export class PollinationsApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = pollinationsConfig.baseUrl;
    log('PollinationsApiService initialized with baseUrl: %s', this.baseUrl);
  }

  /**
   * Generate text using the Pollinations API
   * @param prompt The prompt to generate text from
   * @param model The model to use for generation
   * @param systemPrompt Optional system prompt for context
   */
  async generateText(prompt: string, model: string, systemPrompt?: string): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const payload = {
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ]
    };

    log('Sending request to Pollinations API: POST %s with payload: %O', url, payload);

    try {
      const response = await axios.post(
        url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      log('Received response from Pollinations API: Status %d', response.status);
      // Log only a snippet of the response data if it's large
      const responseDataSnippet = JSON.stringify(response.data)?.substring(0, 100) + '...'; 
      log('Response data snippet: %s', responseDataSnippet);

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const text = response.data.choices[0].message.content;
        log('Extracted text response: "%s"', text);
        return text;
      } else {
        log('Error: Invalid response structure from Pollinations API: %O', response.data);
        throw new Error('Invalid response structure from Pollinations API');
      }
    } catch (error: any) {
      log('Error calling Pollinations API: %O', error);
      if (axios.isAxiosError(error)) {
        log('Axios error details: Status %s, Response %O', error.response?.status, error.response?.data);
        throw new Error(`Pollinations API request failed with status ${error.response?.status}: ${error.message}`);
      } else {
        throw new Error(`Failed to generate text: ${error.message}`);
      }
    }
  }

  /**
   * List available text models from Pollinations API
   */
  async listTextModels(): Promise<string[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/models`,
        {
          headers: {}
        }
      );

      // Direct pass-through of the models data
      return response.data.data
        .filter((model: any) => model.id.includes('gpt') || model.id.includes('claude') || model.id.includes('mistral'))
        .map((model: any) => model.id);
    } catch (error) {
      console.error('Error fetching models from Pollinations API:', error);
      return [];
    }
  }
}
