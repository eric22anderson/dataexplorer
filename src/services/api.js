import axios from 'axios';

// Configuration for API endpoints
const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:3001/api',
  },
  production: {
    baseURL: '/api',
  }
};

const currentConfig = API_CONFIG[process.env.NODE_ENV] || API_CONFIG.development;

// Create axios instance with base configuration
const api = axios.create({
  baseURL: currentConfig.baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Authentication functions
export const authService = {
  login: async (username, password) => {
    try {
      const response = await api.post('/login', { username, password });
      const { token, user } = response.data;
      
      // Store token in localStorage
      if (token) {
        localStorage.setItem('authToken', token);
      }
      
      return { success: true, user, token };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },

  getToken: () => {
    return localStorage.getItem('authToken');
  }
};

// Chat functions
export const chatService = {
  sendMessage: async (message, onChunk) => {
    try {
      const token = localStorage.getItem('authToken');
      // Use the configured API URL
      const apiUrl = `${currentConfig.baseURL}/chat`;
      
      console.log('Making request to:', apiUrl); // Debug log
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ message })
      });

      console.log('Response status:', response.status); // Debug log
      console.log('Response headers:', Object.fromEntries(response.headers.entries())); // Debug log

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      // Check if response body exists
      if (!response.body) {
        throw new Error('No response body available for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream ended, final buffer:', buffer); // Debug log
            break;
          }

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          console.log('Received chunk:', chunk); // Debug log

          // Process complete JSON objects from buffer
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (line) {
              try {
                console.log('Parsing line:', line); // Debug log
                
                // Handle Server-Sent Events (SSE) format
                let jsonString = line;
                if (line.startsWith('data: ')) {
                  jsonString = line.substring(6); // Remove 'data: ' prefix
                }
                
                // Skip empty lines or SSE comments
                if (!jsonString || jsonString.startsWith(':')) {
                  continue;
                }
                
                const parsedChunk = JSON.parse(jsonString);
                
                // Call the onChunk callback with the parsed chunk
                if (onChunk) {
                  onChunk(parsedChunk);
                }

                // Check if this is the end chunk
                if (parsedChunk.type === 'end') {
                  console.log('Received end chunk, finishing stream'); // Debug log
                  return { success: true };
                }
              } catch (parseError) {
                console.error('Error parsing JSON chunk:', parseError, 'Line:', line);
                // Continue processing other lines even if one fails to parse
              }
            }
          }
        }

        return { success: true };
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Streaming error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message'
      };
    }
  }
};

export default api;
