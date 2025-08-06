import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatService, authService } from '../services/api';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  // Scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  // Check authentication on component mount
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    // Add user message to chat
    const newUserMessage = {
      id: Date.now(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);

    // Create initial streaming message
    const streamingId = Date.now() + 1;
    const initialStreamingMessage = {
      id: streamingId,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      isStreaming: true
    };

    setStreamingMessage(initialStreamingMessage);
    let finalStreamingMessage = initialStreamingMessage;

    try {
      // Send message to API with streaming callback
      const result = await chatService.sendMessage(userMessage, (chunk) => {
        console.log('Received chunk:', chunk); // Debug log
        
        if (chunk.type === 'message' && chunk.content) {
          // Update the streaming message with new content on a new line, followed by a blank line
          setStreamingMessage(prev => {
            if (prev) {
              const newText = prev.text ? prev.text + '\n' + chunk.content + '\n' : chunk.content + '\n';
              const updated = { ...prev, text: newText };
              finalStreamingMessage = updated;
              return updated;
            }
            return null;
          });
        } else if (chunk.type === 'error') {
          // Handle error chunks
          setStreamingMessage(prev => {
            if (prev) {
              const updated = {
                ...prev,
                text: prev.text || `Error: ${chunk.content || chunk.data || 'Unknown error'}`,
                isError: true,
                isStreaming: false
              };
              finalStreamingMessage = updated;
              return updated;
            }
            return null;
          });
        }
      });

      // When streaming is complete, move the message to the main messages array
      if (result.success && finalStreamingMessage) {
        setMessages(prev => [...prev, {
          ...finalStreamingMessage,
          isStreaming: false
        }]);
      } else if (!result.success) {
        // If the streaming failed, add an error message
        const errorMessage = {
          id: streamingId,
          text: `Error: ${result.error}`,
          sender: 'bot',
          timestamp: new Date(),
          isError: true
        };
        setMessages(prev => [...prev, errorMessage]);
      }

    } catch (error) {
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Failed to send message. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setStreamingMessage(null);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Medical Data Analysis</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !streamingMessage && (
          <div className="welcome-message">
            <p>Welcome to the chat! Type a message below to get started.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.sender} ${message.isError ? 'error' : ''}`}
          >
            <div className="message-content">
              {message.text.split('\n').map((line, index) => (
                <div key={index}>{line || '\u00A0'}</div>
              ))}
            </div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}

        {/* Render streaming message */}
        {streamingMessage && (
          <div 
            key={streamingMessage.id} 
            className={`message ${streamingMessage.sender} ${streamingMessage.isError ? 'error' : ''} ${streamingMessage.isStreaming ? 'streaming' : ''}`}
          >
            <div className="message-content">
              {streamingMessage.text.split('\n').map((line, index) => (
                <div key={index}>{line || '\u00A0'}</div>
              ))}
              {streamingMessage.isStreaming && (
                <span className="streaming-cursor">|</span>
              )}
            </div>
            <div className="message-timestamp">
              {streamingMessage.timestamp.toLocaleTimeString()}
            </div>
          </div>
        )}
        
        {loading && !streamingMessage && (
          <div className="message bot loading-message">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="input-container">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            disabled={loading}
            className="chat-input"
          />
          <button 
            type="submit" 
            disabled={loading || !inputMessage.trim()}
            className="send-button"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
