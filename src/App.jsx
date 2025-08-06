import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Chat from './components/Chat';
import PrivateRoute from './components/PrivateRoute';
import { authService } from './services/api';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              authService.isAuthenticated() ? 
                <Navigate to="/chat" replace /> : 
                <Login />
            } 
          />
          <Route 
            path="/chat" 
            element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/" 
            element={
              <Navigate to={authService.isAuthenticated() ? "/chat" : "/login"} replace />
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
