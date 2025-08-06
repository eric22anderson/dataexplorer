# AI In Healthcare High Risk Project

React based application with authentication and chat functionality built to provide a chat based interfact that analyzes back-end medical data and provides dynamic charting. 

## Features

- **Authentication**: Login screen that authenticates against `/api/login`
- **Protected Routes**: Chat interface only accessible after login
- **Real-time Chat**: Send messages to `/api/chat` and display responses
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, gradient-based design with smooth animations

## Project Structure

```
src/
├── components/
│   ├── Login.jsx          # Login form component
│   ├── Login.css          # Login styles
│   ├── Chat.jsx           # Chat interface component
│   ├── Chat.css           # Chat styles
│   └── PrivateRoute.jsx   # Route protection component
├── services/
│   └── api.js             # API service with authentication and chat functions
├── App.jsx                # Main app component with routing
├── App.css                # Global app styles
├── index.css              # CSS reset and global styles
└── main.jsx               # React entry point
```

## API Endpoints

The application expects the following API endpoints:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Development Server:**
   ```bash
   npm run dev
   ```

3. **Set up Backend API:**
   - Implement the `/api/login` and `/api/chat` endpoints
   - Or use the mock server script (see below)

## Mock Backend Server

For testing purposes, you can create a simple mock server:

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Mock login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'password') {
    res.json({
      token: 'mock_jwt_token_12345',
      user: { id: 1, username: 'admin' }
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Mock chat endpoint
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  
  // Simple echo with timestamp
  res.json({
    response: `You said: "${message}" at ${new Date().toLocaleTimeString()}`
  });
});

app.listen(3001, () => {
  console.log('Mock server running on http://localhost:3001');
});
```

## Technologies Used

- **React 19**: Modern React with hooks
- **Vite**: Fast build tool and development server
- **React Router**: Client-side routing
- **Axios**: HTTP client for API requests
- **CSS3**: Modern styling with gradients and animations

## Features Implementation

### Authentication
- Form validation
- JWT token storage in localStorage
- Automatic redirection based on auth status
- Protected routes

### Chat Interface
- Real-time message display
- Typing indicators
- Error handling
- Auto-scroll to newest messages
- Responsive design

### User Experience
- Loading states
- Error messages
- Smooth animations
- Mobile-friendly interface

## Development

- **Linting**: ESLint configuration included
- **Hot Reload**: Automatic refresh during development
- **Build**: Production build with `npm run build`
- **Preview**: Preview production build with `npm run preview`

## Notes

- The application uses localStorage for token persistence
- All API calls include authentication headers automatically
- The UI is fully responsive and works on mobile devices
- Error handling is implemented for network failures and API errors
