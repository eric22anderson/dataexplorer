import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data
const users = [
  { id: 1, username: 'admin', password: 'password' },
  { id: 2, username: 'user', password: '123456' },
  { id: 3, username: 'demo', password: 'demo' }
];

// Simple token generation
const generateToken = (user) => {
  return `mock_token_${user.id}_${Date.now()}`;
};

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log(`Login attempt: ${username}`);
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username }
    });
    console.log(`Login successful for: ${username}`);
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
    console.log(`Login failed for: ${username}`);
  }
});

// Chat endpoint
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  const authHeader = req.headers.authorization;
  
  console.log(`Chat message received: ${message}`);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }
  
  // Simple chat responses
  const responses = [
    `You said: "${message}" at ${new Date().toLocaleTimeString()}`,
    `I received your message: "${message}". How can I help you?`,
    `Thanks for your message: "${message}". I'm a simple echo bot!`,
    `Message acknowledged: "${message}". Is there anything else you'd like to discuss?`,
    `Your message "${message}" has been processed successfully.`
  ];
  
  // Pick a random response
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  
  // Simulate some processing delay
  setTimeout(() => {
    res.json({ response: randomResponse });
    console.log(`Chat response sent for message: ${message}`);
  }, 500 + Math.random() * 1000); // Random delay between 500-1500ms
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/login - Authentication endpoint');
  console.log('  POST /api/chat - Chat message endpoint');
  console.log('  GET /api/health - Health check endpoint');
  console.log('\nTest credentials:');
  console.log('  admin / password');
  console.log('  user / 123456');
  console.log('  demo / demo');
});
