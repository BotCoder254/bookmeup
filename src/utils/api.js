// API configuration and utilities
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    
    // Bind methods to preserve 'this' context
    this.request = this.request.bind(this);
    this.getCSRFToken = this.getCSRFToken.bind(this);
    this.ensureCSRFToken = this.ensureCSRFToken.bind(this);
    this.autoLogin = this.autoLogin.bind(this);
    this.login = this.login.bind(this);
    this.register = this.register.bind(this);
    this.logout = this.logout.bind(this);
    this.getCurrentUser = this.getCurrentUser.bind(this);
    this.getBookmarks = this.getBookmarks.bind(this);
    this.getBookmarksLibrary = this.getBookmarksLibrary.bind(this);
    this.getBookmark = this.getBookmark.bind(this);
    this.createBookmark = this.createBookmark.bind(this);
    this.quickAddBookmark = this.quickAddBookmark.bind(this);
    this.updateBookmark = this.updateBookmark.bind(this);
    this.deleteBookmark = this.deleteBookmark.bind(this);
    this.toggleFavorite = this.toggleFavorite.bind(this);
    this.toggleArchive = this.toggleArchive.bind(this);
    this.visitBookmark = this.visitBookmark.bind(this);
    this.getTags = this.getTags.bind(this);
    this.createTag = this.createTag.bind(this);
    this.updateTag = this.updateTag.bind(this);
    this.deleteTag = this.deleteTag.bind(this);
    this.reorderTags = this.reorderTags.bind(this);
    this.getRecentTagSuggestions = this.getRecentTagSuggestions.bind(this);
    this.getCollections = this.getCollections.bind(this);
    this.createCollection = this.createCollection.bind(this);
    this.updateCollection = this.updateCollection.bind(this);
    this.deleteCollection = this.deleteCollection.bind(this);
    this.reorderCollections = this.reorderCollections.bind(this);
    this.setCollectionCoverImage = this.setCollectionCoverImage.bind(this);
    this.searchBookmarks = this.searchBookmarks.bind(this);
    this.getSearchSuggestions = this.getSearchSuggestions.bind(this);
    this.getSavedViews = this.getSavedViews.bind(this);
    this.createSavedView = this.createSavedView.bind(this);
    this.updateSavedView = this.updateSavedView.bind(this);
    this.deleteSavedView = this.deleteSavedView.bind(this);
    this.useSavedView = this.useSavedView.bind(this);
    this.reorderSavedViews = this.reorderSavedViews.bind(this);
    this.getStats = this.getStats.bind(this);
    this.getActivities = this.getActivities.bind(this);
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for session auth
      ...options,
    };

    // Add CSRF token for non-GET requests
    if (config.method !== 'GET') {
      let csrfToken = this.getCSRFToken();
      if (!csrfToken) {
        csrfToken = await this.ensureCSRFToken();
      }
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      // Handle CSRF token errors by retrying once
      if (response.status === 403 && config.method !== 'GET') {
        const errorText = await response.text();
        if (errorText.includes('CSRF') || errorText.includes('Forbidden')) {
          // Clear and retry with new CSRF token
          document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          const newToken = await this.ensureCSRFToken();
          if (newToken) {
            config.headers['X-CSRFToken'] = newToken;
            const retryResponse = await fetch(url, config);
            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse.json().catch(() => ({ error: `HTTP ${retryResponse.status}` }));
              throw new Error(retryErrorData.message || retryErrorData.error || `HTTP ${retryResponse.status}`);
            }
            const contentType = retryResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              return await retryResponse.json();
            }
            return retryResponse;
          }
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return response;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  getCSRFToken() {
    // First, try to get from cookies
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrftoken') {
        return decodeURIComponent(value);
      }
    }
    
    // If not found in cookies, try meta tag
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
      return csrfMeta.getAttribute('content');
    }
    
    return null;
  }
  
  async ensureCSRFToken() {
    const token = this.getCSRFToken();
    if (!token) {
      // Make a GET request to get CSRF token
      try {
        const response = await fetch(`${this.baseURL}/auth/me/`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        });
        // The token should now be set in cookies
        return this.getCSRFToken();
      } catch (error) {
        console.warn('Failed to get CSRF token:', error);
        return null;
      }
    }
    return token;
  }

  // Auto-login for single-user mode
  async autoLogin() {
    try {
      const response = await this.request('/auth/auto-login/', {
        method: 'POST',
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Authentication methods
  async login(credentials) {
    return this.request('/auth/login/', {
      method: 'POST',
      body: credentials,
    });
  }

  async register(userData) {
    return this.request('/auth/register/', {
      method: 'POST',
      body: userData,
    });
  }

  async logout() {
    return this.request('/auth/logout/', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    try {
      return await this.request('/auth/me/');
    } catch (error) {
      // If we get 401/403, try auto-login for single-user mode
      if ((error.message.includes('401') || error.message.includes('403')) && 
          window.location.hostname === 'localhost') {
        try {
          const autoLoginResponse = await this.autoLogin();
          if (autoLoginResponse && autoLoginResponse.user) {
            return autoLoginResponse.user;
          }
        } catch (autoLoginError) {
          console.warn('Auto-login failed:', autoLoginError);
        }
      }
      throw error;
    }
  }

  // Bookmark methods
  async getBookmarks(params = {}) {
    const searchParams = new URLSearchParams(params);
    return this.request(`/bookmarks/?${searchParams}`);
  }
  
  async getBookmarksLibrary(params = {}) {
    const searchParams = new URLSearchParams(params);
    return this.request(`/bookmarks/library/?${searchParams}`);
  }

  async getBookmark(id) {
    return this.request(`/bookmarks/${id}/`);
  }

  async createBookmark(bookmark) {
    return this.request('/bookmarks/', {
      method: 'POST',
      body: bookmark,
    });
  }

  async quickAddBookmark(bookmarkData) {
    return this.request('/bookmarks/quick-add/', {
      method: 'POST',
      body: bookmarkData,
    });
  }

  async updateBookmark(id, bookmark) {
    return this.request(`/bookmarks/${id}/`, {
      method: 'PATCH',
      body: bookmark,
    });
  }

  async deleteBookmark(id) {
    return this.request(`/bookmarks/${id}/`, {
      method: 'DELETE',
    });
  }

  async toggleFavorite(id) {
    return this.request(`/bookmarks/${id}/toggle_favorite/`, {
      method: 'POST',
    });
  }

  async toggleArchive(id) {
    return this.request(`/bookmarks/${id}/toggle_archive/`, {
      method: 'POST',
    });
  }

  async visitBookmark(id) {
    return this.request(`/bookmarks/${id}/visit/`, {
      method: 'POST',
    });
  }

  // Tag methods
  async getTags() {
    return this.request('/tags/');
  }

  async createTag(tag) {
    return this.request('/tags/', {
      method: 'POST',
      body: tag,
    });
  }

  async updateTag(id, tag) {
    return this.request(`/tags/${id}/`, {
      method: 'PATCH',
      body: tag,
    });
  }

  async deleteTag(id) {
    return this.request(`/tags/${id}/`, {
      method: 'DELETE',
    });
  }

  async reorderTags(tagOrders) {
    return this.request('/tags/reorder/', {
      method: 'POST',
      body: { tag_orders: tagOrders },
    });
  }

  async getRecentTagSuggestions() {
    return this.request('/tags/recent_suggestions/');
  }

  // Collection methods
  async getCollections() {
    return this.request('/collections/');
  }

  async createCollection(collection) {
    return this.request('/collections/', {
      method: 'POST',
      body: collection,
    });
  }

  async updateCollection(id, collection) {
    return this.request(`/collections/${id}/`, {
      method: 'PATCH',
      body: collection,
    });
  }

  async deleteCollection(id) {
    return this.request(`/collections/${id}/`, {
      method: 'DELETE',
    });
  }

  async reorderCollections(collectionOrders) {
    return this.request('/collections/reorder/', {
      method: 'POST',
      body: { collection_orders: collectionOrders },
    });
  }

  async setCollectionCoverImage(id, coverImageUrl) {
    return this.request(`/collections/${id}/set_cover_image/`, {
      method: 'POST',
      body: { cover_image: coverImageUrl },
    });
  }

  // Advanced Search methods
  async searchBookmarks(params = {}) {
    const searchParams = new URLSearchParams(params);
    return this.request(`/bookmarks/search/?${searchParams}`);
  }

  async getSearchSuggestions(query) {
    const searchParams = new URLSearchParams({ q: query });
    return this.request(`/bookmarks/search_suggestions/?${searchParams}`);
  }

  // Saved Views methods
  async getSavedViews() {
    return this.request('/saved-views/');
  }

  async createSavedView(savedView) {
    return this.request('/saved-views/', {
      method: 'POST',
      body: savedView,
    });
  }

  async updateSavedView(id, savedView) {
    return this.request(`/saved-views/${id}/`, {
      method: 'PATCH',
      body: savedView,
    });
  }

  async deleteSavedView(id) {
    return this.request(`/saved-views/${id}/`, {
      method: 'DELETE',
    });
  }

  async useSavedView(id) {
    return this.request(`/saved-views/${id}/use_view/`, {
      method: 'POST',
    });
  }

  async reorderSavedViews(viewOrders) {
    return this.request('/saved-views/reorder/', {
      method: 'POST',
      body: { view_orders: viewOrders },
    });
  }

  // Stats
  async getStats() {
    return this.request('/stats/');
  }

  // Activities
  async getActivities(params = {}) {
    const searchParams = new URLSearchParams(params);
    return this.request(`/activities/?${searchParams}`);
  }
}

export const apiClient = new ApiClient();

// Utility functions
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const extractDomain = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

export const getFaviconUrl = (url) => {
  try {
    const domain = new URL(url).origin;
    return `${domain}/favicon.ico`;
  } catch {
    return null;
  }
};

export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const generateColorFromString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// Search utilities
export const parseSearchQuery = (query) => {
  if (!query) return { filters: {}, textQuery: '' };
  
  const filters = {};
  let remainingQuery = query;
  
  // Extract filter patterns
  const patterns = {
    tag: /tag:([^\s]+)/g,
    domain: /domain:([^\s]+)/g,
    collection: /collection:([^\s]+)/g,
    unread: /unread:(true|false)/g,
    favorite: /favorite:(true|false)/g,
    archived: /archived:(true|false)/g,
    after: /after:(\d{4}-\d{2}-\d{2})/g,
    before: /before:(\d{4}-\d{2}-\d{2})/g,
  };
  
  Object.entries(patterns).forEach(([key, pattern]) => {
    const matches = [...remainingQuery.matchAll(pattern)];
    matches.forEach(match => {
      if (key === 'tag') {
        if (!filters.tags) filters.tags = [];
        filters.tags.push(match[1]);
      } else if (['unread', 'favorite', 'archived'].includes(key)) {
        filters[key] = match[1] === 'true';
      } else {
        filters[key] = match[1];
      }
      remainingQuery = remainingQuery.replace(match[0], ' ');
    });
  });
  
  // Extract quoted phrases
  const quotedPhrases = [];
  const quoteMatches = [...remainingQuery.matchAll(/"([^"]*)"/g)];
  quoteMatches.forEach(match => {
    quotedPhrases.push(match[1]);
    remainingQuery = remainingQuery.replace(match[0], ' ');
  });
  
  // Get remaining text
  const words = remainingQuery.split(/\s+/).filter(word => word.trim());
  const textQuery = [...quotedPhrases, ...words].join(' ').trim();
  
  return { filters, textQuery };
};

export const buildSearchQuery = (filters, textQuery) => {
  const parts = [];
  
  if (textQuery) {
    if (textQuery.includes(' ') && !textQuery.includes('"')) {
      parts.push(`"${textQuery}"`);
    } else {
      parts.push(textQuery);
    }
  }
  
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => parts.push(`${key}:${item}`));
    } else if (value !== undefined && value !== null && value !== '') {
      parts.push(`${key}:${value}`);
    }
  });
  
  return parts.join(' ');
};

export const getFilterChips = (filters) => {
  const chips = [];
  
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => {
        chips.push({
          type: key,
          value: item,
          label: `${key}: ${item}`,
          key: `${key}-${item}`
        });
      });
    } else if (value !== undefined && value !== null && value !== '') {
      chips.push({
        type: key,
        value: value,
        label: `${key}: ${value}`,
        key: `${key}-${value}`
      });
    }
  });
  
  return chips;
};