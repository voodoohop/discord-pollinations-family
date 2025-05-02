import axios from 'axios';
import debug from 'debug';
import { GenerateTextWithHistory, ApiMessage } from './types';

const log = debug('app:api');

// Timeout duration in milliseconds
const API_TIMEOUT_MS = 20000; // 20 seconds

/**
 * Create a text generation function for the Pollinations API
 */
export const createGenerateTextWithHistory = (baseUrl: string): GenerateTextWithHistory => {
  log('API Client created with baseUrl: %s', baseUrl);

  // Semaphore to control concurrency
  let isRequestInProgress = false;
  const requestQueue: Array<() => void> = [];

  // Function to acquire the semaphore
  const acquireSemaphore = async (): Promise<void> => {
    if (!isRequestInProgress) {
      isRequestInProgress = true;
      return;
    }

    // If a request is already in progress, wait for it to complete
    return new Promise<void>(resolve => {
      requestQueue.push(resolve);
    });
  };

  // Function to release the semaphore
  const releaseSemaphore = (): void => {
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      // Process the next request in the queue
      nextRequest();
    } else {
      // No more requests in the queue
      isRequestInProgress = false;
    }
  };

  /**
   * Generate text using conversation history
   */
  return async (messages: ApiMessage[], model: string, systemPrompt?: string): Promise<string> => {
    // Wait for any ongoing request to complete
    await acquireSemaphore();
    log('Acquired semaphore for model %s', model);

    const url = `${baseUrl}/chat/completions`;
    const apiMessages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages
    ];

    const requestData = { model, messages: apiMessages };

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
          'Content-Type': 'application/json'
        }
      });

      // Race the request against the timeout
      const response = await Promise.race([requestPromise, timeoutPromise]);

      // Release the semaphore for the next request
      releaseSemaphore();
      log('Released semaphore for model %s', model);

      return response.data.choices[0].message.content;
    } catch (error: any) {
      // Check if this is a timeout error
      if (error.message && error.message.includes('Request timed out')) {
        log('Request timed out after %dms', API_TIMEOUT_MS);
        // Wait 60 seconds before allowing the next request
        log('Waiting 60 seconds before allowing next request...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        log('Wait complete, next request can now be processed');

        // Release the semaphore after waiting
        releaseSemaphore();
        log('Released semaphore for model %s after timeout and wait', model);

        return ""; // Return empty string instead of error message
      }

      // For other errors, release the semaphore immediately
      releaseSemaphore();
      log('Released semaphore for model %s after error', model);
      // Log error with more context
      log('=== API ERROR DETAILS ===');
      log('Error Type: %s', error.name || 'Unknown Error Type');
      log('Error Message: %s', error.message || 'No error message available');
      log('Error Code: %s', error.code || 'No error code available');
      log('Full URL: %s', url);
      log('Model: %s', model);

      // Log the complete error response if available
      if (error.response) {
        log('Response Status: %s', error.response.status);
        log('Response Status Text: %s', error.response.statusText || 'No status text');
        log('Response Headers: %O', error.response.headers);

        // Try to parse and log the response data in a more readable format
        try {
          const errorData = error.response.data;
          log('Response Data: %O', errorData);

          // Check if there's an error message in the response data
          if (errorData && typeof errorData === 'object') {
            if (errorData.error) log('API Error Message: %s', errorData.error);
            if (errorData.message) log('API Message: %s', errorData.message);
          }
        } catch (parseError: unknown) {
          // Handle the unknown type correctly
          if (parseError instanceof Error) {
            log('Error parsing response data: %s', parseError.message);
          } else {
            log('Error parsing response data: Unknown error');
          }
        }
      } else if (error.request) {
        log('No response received from server');
        log('Request Details: %O', {
          method: 'POST',
          url,
          headers: {
            'Referer': 'roblox',
            'Content-Type': 'application/json'
          }
        });
      } else {
        log('Error setting up request: %s', error.message);
      }

      // Log request data with sensitive information redacted
      const redactedMessages = apiMessages.map(msg => ({
        ...msg,
        content: msg.content.length > 100 ? `${msg.content.substring(0, 100)}...` : msg.content
      }));

      log('Request Payload: %O', {
        model,
        messages: redactedMessages,
        url
      });

      // Log stack trace if available
      if (error.stack) {
        log('Stack Trace: %s', error.stack);
      }

      log('=== END API ERROR DETAILS ===');

      // Wait 60 seconds before allowing the next request
      log('Waiting 60 seconds before allowing next request...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      log('Wait complete, next request can now be processed');

      // Note: We've already released the semaphore earlier, so no need to release it again here
      return ""; // Return empty string instead of error message
    }
  };
};
