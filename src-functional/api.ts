import axios from 'axios';
import debug from 'debug';
import { GenerateTextWithHistory, ApiMessage } from './types';
import { NetworkTimeoutError } from './errors';

const log = debug('app:api');

// Timeout duration in milliseconds
const API_TIMEOUT_MS = 50000; // 50 seconds

/**
 * Create a text generation function for the Pollinations API
 */
export const createGenerateTextWithHistory = (baseUrl: string): GenerateTextWithHistory => {
  log('API Client created with baseUrl: %s', baseUrl);

  // Per-model semaphore to control concurrency (allows different models to run concurrently)
  const modelSemaphores = new Map<string, { inProgress: boolean; queue: Array<() => void> }>();

  // Function to get or create semaphore for a model
  const getModelSemaphore = (model: string) => {
    if (!modelSemaphores.has(model)) {
      modelSemaphores.set(model, { inProgress: false, queue: [] });
    }
    return modelSemaphores.get(model)!;
  };

  // Function to acquire the semaphore for a specific model
  const acquireSemaphore = async (model: string): Promise<void> => {
    const semaphore = getModelSemaphore(model);
    
    if (!semaphore.inProgress) {
      semaphore.inProgress = true;
      return;
    }

    // If a request is already in progress for this model, wait for it to complete
    return new Promise<void>(resolve => {
      semaphore.queue.push(resolve);
    });
  };

  // Function to release the semaphore for a specific model
  const releaseSemaphore = (model: string): void => {
    const semaphore = getModelSemaphore(model);
    const nextRequest = semaphore.queue.shift();
    
    if (nextRequest) {
      // Process the next request in the queue for this model
      nextRequest();
    } else {
      // No more requests in the queue for this model
      semaphore.inProgress = false;
    }
  };

  /**
   * Generate text using conversation history
   */
  return async (messages: ApiMessage[], model: string, systemPrompt?: string): Promise<string> => {
    // Wait for any ongoing request to complete for this specific model
    await acquireSemaphore(model);
    log('Acquired semaphore for model %s', model);

    const url = `${baseUrl}/chat/completions`;
    const apiMessages = [
      ...(systemPrompt ? [{ role: 'user', content: systemPrompt }] : []),
      ...messages
    ];

    const requestData = { model, messages: apiMessages};

    // Log equivalent curl command for debugging
    const curlCommand = `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(requestData, null, 2)}'`;

    log('Equivalent curl command:\n%s', curlCommand);

    try {
      // Create a promise that will reject after the timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timed out after ${API_TIMEOUT_MS}ms`));
        }, API_TIMEOUT_MS);
      });

      // Create the actual request promise
      const requestPromise = axios.post(url, requestData, {
        headers: {
          'Referer': 'roblox',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEXT_POLLINATIONS_TOKEN}`
        }
      });

      // Race the request against the timeout
      const response = await Promise.race([requestPromise, timeoutPromise]);

      // Release the semaphore for the next request
      releaseSemaphore(model);
      log('Released semaphore for model %s', model);

      return response.data.choices[0].message.content;
    } catch (error: any) {
      releaseSemaphore(model);
      log('Released semaphore for model %s after error', model);
      
      // Handle timeout errors
      if (error.message?.includes('Request timed out')) {
        log('Request timed out after %dms, waiting 60s before next request', API_TIMEOUT_MS);
        await new Promise(resolve => setTimeout(resolve, 60000));
        throw new NetworkTimeoutError(API_TIMEOUT_MS);
      }
      
      // Handle all other API errors - return empty string instead of throwing
      log('API request failed for model %s: %s', model, error.message);
      
      // Log response body if available (for HTTP errors like 502)
      if (error.response) {
        log('HTTP Error Status: %d', error.response.status);
        log('HTTP Error Headers: %O', error.response.headers);
        if (error.response.data) {
          log('HTTP Error Response Body: %O', error.response.data);
        }
      } else if (error.request) {
        log('No response received. Request details: %O', error.request);
      }
      
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait before next request
      return ''; // Return empty string for non-timeout errors
    }
  };
};
