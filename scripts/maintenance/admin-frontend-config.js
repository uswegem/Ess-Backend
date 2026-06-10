/**
 * Admin Portal Frontend Configuration
 * Configuration for connecting MiraAdmin frontend to ESS backend
 */

// API Configuration
export const API_CONFIG = {
  // ESS Backend API Base URL
  BASE_URL: 'http://135.181.33.13:3002/api/v1',
  
  // API Endpoints
  ENDPOINTS: {
    // Authentication
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout', 
    PROFILE: '/auth/profile',
    
    // Loan Management
    LOAN_PRODUCTS: '/loan/list-products',
    EMPLOYEE_LOANS: '/loan/list-employee-loan',
    
    // User Management
    GET_ALL_USERS: '/admin/get_all_users',
    GET_USER_DETAILS: '/admin/get_user_details',
    DELETE_USER: '/admin/delete_user',
    
    // Admin Profile
    GET_ADMIN: '/admin/get_admin',
    EDIT_ADMIN: '/admin/edit_admin',
    CHANGE_PASSWORD: '/admin/change_password'
  },
  
  // Request Configuration
  TIMEOUT: 30000, // 30 seconds
  
  // Headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// Authentication Configuration
export const AUTH_CONFIG = {
  TOKEN_KEY: 'mira_admin_token',
  USER_KEY: 'mira_admin_user',
  TOKEN_HEADER: 'Authorization',
  TOKEN_PREFIX: 'Bearer '
};

// API Helper Functions
export class ApiService {
  static getAuthToken() {
    return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
  }
  
  static setAuthToken(token) {
    localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
  }
  
  static removeAuthToken() {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    localStorage.removeItem(AUTH_CONFIG.USER_KEY);
  }
  
  static getAuthHeaders() {
    const token = this.getAuthToken();
    if (!token) return API_CONFIG.DEFAULT_HEADERS;
    
    return {
      ...API_CONFIG.DEFAULT_HEADERS,
      [AUTH_CONFIG.TOKEN_HEADER]: `${AUTH_CONFIG.TOKEN_PREFIX}${token}`
    };
  }
  
  static async request(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      timeout: API_CONFIG.TIMEOUT,
      ...options
    };
    
    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token expired or invalid
        this.removeAuthToken();
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Request Failed:', error);
      throw error;
    }
  }
  
  // Authentication Methods
  static async login(credentials) {
    const response = await this.request(API_CONFIG.ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    
    if (response.success && response.data.token) {
      this.setAuthToken(response.data.token);
      localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(response.data.user));
    }
    
    return response;
  }
  
  static async logout() {
    try {
      await this.request(API_CONFIG.ENDPOINTS.LOGOUT, { method: 'POST' });
    } finally {
      this.removeAuthToken();
    }
  }
  
  // Data Methods
  static async getLoanProducts() {
    return await this.request(API_CONFIG.ENDPOINTS.LOAN_PRODUCTS);
  }
  
  static async getEmployeeLoans() {
    return await this.request(API_CONFIG.ENDPOINTS.EMPLOYEE_LOANS);
  }
  
  static async getAllUsers() {
    return await this.request(API_CONFIG.ENDPOINTS.GET_ALL_USERS);
  }
}

// Usage Examples:
/*
// Login
const loginResult = await ApiService.login({
  email: 'admin@example.com',
  password: 'password123'
});

// Get loan products
const products = await ApiService.getLoanProducts();

// Get employee loans  
const loans = await ApiService.getEmployeeLoans();

// Get all users
const users = await ApiService.getAllUsers();
*/

export default ApiService;