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

    const requestData = { model, messages: apiMessages };

    // Log equivalent curl command for debugging
    const curlCommand = `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(requestData, null, 2)}'`;

    log('Equivalent curl command:\n%s', curlCommand);

    try {
      const response = await axios.post(url, requestData, {
        headers: {
          'Referer': 'roblox',
          'Content-Type': 'application/json'
        }
      });
      return response.data.choices[0].message.content;
    } catch (error: any) {
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

      return "Sorry, I encountered an error processing your request.";
    }
  };
};
