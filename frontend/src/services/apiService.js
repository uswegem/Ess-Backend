/**
 * API Service for Admin Portal
 * Handles all HTTP requests to ESS backend
 */

import { API_CONFIG as CONFIG } from '../config/index.js';

const API_CONFIG = {
  BASE_URL: CONFIG.BASE_URL,
  TIMEOUT: CONFIG.TIMEOUT,
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

const AUTH_CONFIG = {
  TOKEN_KEY: 'mira_admin_token',
  USER_KEY: 'mira_admin_user',
  TOKEN_HEADER: 'Authorization',
  TOKEN_PREFIX: 'Bearer '
};

class ApiService {
  /**
   * Get stored authentication token
   */
  static getAuthToken() {
    return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
  }

  /**
   * Store authentication token
   */
  static setAuthToken(token) {
    localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
  }

  /**
   * Remove authentication data
   */
  static removeAuthToken() {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    localStorage.removeItem(AUTH_CONFIG.USER_KEY);
  }

  /**
   * Get headers with authentication
   */
  static getAuthHeaders() {
    const token = this.getAuthToken();
    const headers = { ...API_CONFIG.DEFAULT_HEADERS };
    
    if (token) {
      headers[AUTH_CONFIG.TOKEN_HEADER] = `${AUTH_CONFIG.TOKEN_PREFIX}${token}`;
    }
    
    return headers;
  }

  /**
   * Make HTTP request with error handling
   */
  static async request(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      timeout: API_CONFIG.TIMEOUT,
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      // Handle authentication errors
      if (response.status === 401) {
        this.removeAuthToken();
        window.location.href = '/login';
        throw new Error('Authentication required');
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request Failed:', { endpoint, error: error.message });
      throw error;
    }
  }

  // =====================
  // Authentication APIs
  // =====================

  /**
   * Login user
   */
  static async login(credentials) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (response.success && response.data.token) {
      this.setAuthToken(response.data.token);
      localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(response.data.user));
    }

    return response;
  }

  /**
   * Get user profile
   */
  static async getProfile() {
    return await this.request('/auth/profile');
  }

  /**
   * Logout user
   */
  static async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.removeAuthToken();
    }
  }

  // =====================
  // Loan Management APIs
  // =====================

  /**
   * Get loan products
   */
  static async getLoanProducts() {
    return await this.request('/loan/list-products');
  }

  /**
   * Get employee loans with pagination and filtering
   */
  static async getEmployeeLoans(params = {}) {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    const endpoint = `/loan/list-employee-loan${queryParams.toString() ? `?${queryParams}` : ''}`;
    return await this.request(endpoint);
  }

  /**
   * Get loan statistics
   */
  static async getLoanStats(dateRange = {}) {
    const queryParams = new URLSearchParams();
    
    if (dateRange.startDate) queryParams.append('startDate', dateRange.startDate);
    if (dateRange.endDate) queryParams.append('endDate', dateRange.endDate);

    const endpoint = `/loan/stats${queryParams.toString() ? `?${queryParams}` : ''}`;
    return await this.request(endpoint);
  }

  // =====================
  // User Management APIs
  // =====================

  /**
   * Get all users
   */
  static async getAllUsers(params = {}) {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });

    const endpoint = `/admin/get_all_users${queryParams.toString() ? `?${queryParams}` : ''}`;
    return await this.request(endpoint);
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId) {
    return await this.request(`/admin/get_user_details/${userId}`);
  }

  /**
   * Delete user
   */
  static async deleteUser(userId) {
    return await this.request(`/admin/delete_user/${userId}`, {
      method: 'DELETE'
    });
  }

  // =====================
  // Admin Profile APIs
  // =====================

  /**
   * Get admin profile
   */
  static async getAdmin() {
    return await this.request('/admin/get_admin');
  }

  /**
   * Update admin profile
   */
  static async updateAdmin(adminData) {
    return await this.request('/admin/edit_admin', {
      method: 'PUT',
      body: JSON.stringify(adminData)
    });
  }

  /**
   * Change password
   */
  static async changePassword(passwordData) {
    return await this.request('/admin/change_password', {
      method: 'POST',
      body: JSON.stringify(passwordData)
    });
  }

  // =====================
  // Dashboard/Stats APIs
  // =====================

  /**
   * Get dashboard statistics
   */
  static async getDashboardStats() {
    try {
      const [loanStats, userStats] = await Promise.all([
        this.getLoanStats(),
        this.getAllUsers({ summary: true })
      ]);

      return {
        success: true,
        data: {
          loans: loanStats.data,
          users: userStats.data
        }
      };
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      return {
        success: false,
        message: error.message,
        data: {
          loans: { total: 0, approved: 0, pending: 0, cancelled: 0 },
          users: { total: 0, active: 0 }
        }
      };
    }
  }

  // =====================
  // Message/Log APIs (For existing components)
  // =====================

  /**
   * Get message logs (compatibility with existing MessageManagement component)
   */
  static async getMessageLogs(params = {}) {
    // Map to employee loans for now, or implement specific message logging
    const loans = await this.getEmployeeLoans(params);
    
    // Transform loan data to message format for compatibility
    const transformedMessages = loans.data?.loans?.map(loan => ({
      id: loan._id,
      messageType: loan.requestType || 'LOAN_REQUEST',
      applicationNumber: loan.essApplicationNumber,
      status: loan.status,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
      details: loan
    })) || [];

    return {
      success: true,
      data: {
        messages: transformedMessages,
        pagination: loans.data?.pagination || { total: 0, page: 1, pages: 1 }
      }
    };
  }

  /**
   * Get message types
   */
  static async getMessageTypes() {
    return {
      success: true,
      data: [
        'LOAN_OFFER_REQUEST',
        'TOP_UP_OFFER_REQUEST', 
        'LOAN_TAKEOVER_OFFER_REQUEST',
        'LOAN_FINAL_APPROVAL_NOTIFICATION',
        'LOAN_CANCELLATION_NOTIFICATION'
      ]
    };
  }

  /**
   * Get message statistics
   */
  static async getMessageStats() {
    const stats = await this.getLoanStats();
    return {
      success: true,
      data: {
        total: stats.data?.total || 0,
        processed: stats.data?.approved || 0,
        pending: stats.data?.pending || 0,
        failed: stats.data?.cancelled || 0
      }
    };
  }
}

export default ApiService;
export { API_CONFIG, AUTH_CONFIG };