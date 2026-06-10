import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import LoginComponent from './components/auth/LoginComponent';
import DashboardComponent from './components/dashboard/DashboardComponent';
import LoanManagementComponent from './components/loans/LoanManagementComponent';
import MessageManagement from './components/admin/MessageManagement';
import UsersManagement from './components/users/UsersManagement';
import ApiService from './services/apiService';
import { toast } from '@/components/ui/use-toast';

// Navigation Component
const Navigation = ({ onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', path: '/' },
    { id: 'loans', label: 'Loan Management', icon: '💰', path: '/loans' },
    { id: 'messages', label: 'Message Logs', icon: '📨', path: '/messages' },
    { id: 'users', label: 'User Management', icon: '👥', path: '/users' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex space-x-8">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={item.path}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    window.location.pathname === item.path
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <button
              onClick={onLogout}
              className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Main App Component
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = ApiService.getAuthToken();
      
      if (!token) {
        setLoading(false);
        return;
      }

      // Verify token with backend
      const response = await ApiService.getProfile();
      
      if (response.success) {
        setIsAuthenticated(true);
        setUser(response.data.user || response.data);
      } else {
        // Invalid token
        ApiService.removeAuthToken();
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      ApiService.removeAuthToken();
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    setCurrentPage('dashboard');
  };

  const handleLogout = async () => {
    try {
      await ApiService.logout();
      setIsAuthenticated(false);
      setUser(null);
      setCurrentPage('dashboard');
      
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out',
        variant: 'success'
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      ApiService.removeAuthToken();
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardComponent user={user} onLogout={handleLogout} />;
      case 'loans':
        return <LoanManagementComponent />;
      case 'messages':
        return <MessageManagement />;
      case 'users':
        return <UsersManagement />;
      default:
        return <DashboardComponent user={user} onLogout={handleLogout} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading MiraCore Admin...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LoginComponent onLogin={handleLogin} />
        <Toaster />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation 
          onLogout={handleLogout} 
        />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <Routes>
              <Route path="/" element={<DashboardComponent user={user} onLogout={handleLogout} />} />
              <Route path="/dashboard" element={<DashboardComponent user={user} onLogout={handleLogout} />} />
              <Route path="/loans" element={<LoanManagementComponent />} />
              <Route path="/messages" element={<MessageManagement />} />
              <Route path="/users" element={<UsersManagement />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        <Toaster />
      </div>
    </Router>
  );
};

export default App;