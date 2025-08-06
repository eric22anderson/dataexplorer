import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatService, authService } from '../services/api';
import Plot from 'react-plotly.js'; 
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);


  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);


  const MessageContent = ({ message }) => {
    switch (message.contentType) {
      case 'graph':
        return (
          <div className="message-graph">
            {message.text && message.text.trim() && (
              <div className="graph-description">
                {message.text.split('\n').map((line, index) => (
                  <div key={index}>{line || '\u00A0'}</div>
                ))}
              </div>
            )}
            <div className="graph-container">
              {message.graphType === 'plotly' && (
                <Plot
                  data={message.graphData.data}
                  layout={{
                    ...message.graphData.layout,
                    autosize: true,
                    margin: { l: 40, r: 40, t: 40, b: 40 }
                  }}
                  config={{
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ['pan2d', 'lasso2d']
                  }}
                  style={{ width: '100%', height: '400px' }}
                />
              )}
              {message.graphType === 'image' && (
                <img 
                  src={message.graphData.src} 
                  alt={message.graphData.alt || "Generated graph"}
                  className="graph-image"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              )}
              {message.graphType === 'html' && (
                <div 
                  dangerouslySetInnerHTML={{ __html: message.graphData.html }}
                  className="graph-html"
                />
              )}
            </div>
          </div>
        );
      
      case 'text':
      default:
        return (
          <div className="message-text">
            {message.text.split('\n').map((line, index) => (
              <div key={index}>{line || '\u00A0'}</div>
            ))}
          </div>
        );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    
    const newUserMessage = {
      id: Date.now(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date(),
      contentType: 'text'
    };

    setMessages(prev => [...prev, newUserMessage]);

    // (eric: Comverted from original batch to streaming so we can see chain of thought)
    const streamingId = Date.now() + 1;
    const initialStreamingMessage = {
      id: streamingId,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      isStreaming: true,
      contentType: 'text'
    };

    setStreamingMessage(initialStreamingMessage);
    let finalStreamingMessage = initialStreamingMessage;

    try {
      // Send message to API with streaming callback
      const result = await chatService.sendMessage(userMessage, (chunk) => {
        console.log('Received chunk:', chunk);
        
        if (chunk.type === 'message' && chunk.content) {
          setStreamingMessage(prev => {
            if (prev) {
              const newText = prev.text ? prev.text + '\n' + chunk.content + '\n' : chunk.content + '\n';
              const updated = { ...prev, text: newText };
              finalStreamingMessage = updated;
              return updated;
            }
            return null;
          });
        } else if (chunk.type === 'graph') {
          // Let's see if there is a graph, if so... handle it
          setStreamingMessage(prev => {
            if (prev) {
              // Preserve existing text and add description if provided
              const existingText = prev.text || '';
              const newDescription = chunk.description || '';
              const combinedText = existingText && newDescription 
                ? `${existingText}\n${newDescription}` 
                : existingText || newDescription;

              const updated = {
                ...prev,
                contentType: 'graph',
                graphType: chunk.graphType || 'plotly',
                graphData: chunk.graphData,
                text: combinedText,
                isStreaming: false
              };
              finalStreamingMessage = updated;
              return updated;
            }
            return null;
          });
        } else if (chunk.type === 'error') {
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
        const errorMessage = {
          id: streamingId,
          text: `Error: ${result.error}`,
          sender: 'bot',
          timestamp: new Date(),
          isError: true,
          contentType: 'text'
        };
        setMessages(prev => [...prev, errorMessage]);
      }

    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Failed to send message. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
        isError: true,
        contentType: 'text'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setStreamingMessage(null);
    }
  };


  const addGraphMessage = (graphData, description = '', graphType = 'plotly') => {
    const graphMessage = {
      id: Date.now(),
      text: description,
      sender: 'bot',
      timestamp: new Date(),
      contentType: 'graph',
      graphType: graphType,
      graphData: graphData
    };
    
    setMessages(prev => [...prev, graphMessage]);
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
            className={`message ${message.sender} ${message.isError ? 'error' : ''} ${message.contentType === 'graph' ? 'graph-message' : ''}`}
          >
            <div className="message-content">
              <MessageContent message={message} />
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
            className={`message ${streamingMessage.sender} ${streamingMessage.isError ? 'error' : ''} ${streamingMessage.isStreaming ? 'streaming' : ''} ${streamingMessage.contentType === 'graph' ? 'graph-message' : ''}`}
          >
            <div className="message-content">
              <MessageContent message={streamingMessage} />
              {streamingMessage.isStreaming && streamingMessage.contentType === 'text' && (
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
          <button type="submit" disabled={loading || !inputMessage.trim()} className="send-button">
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;