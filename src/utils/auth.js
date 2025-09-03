// Auth utilities for token management
// This file provides token-related utilities for authentication with the API

/**
 * Gets the authentication token from local storage
 * @returns {string|null} The authentication token or null if not found
 */
export const getToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Saves the authentication token to local storage
 * @param {string} token - The authentication token to save
 */
export const setToken = (token) => {
  if (token) {
    localStorage.setItem('authToken', token);
  }
};

/**
 * Removes the authentication token from local storage
 */
export const removeToken = () => {
  localStorage.removeItem('authToken');
};

/**
 * Checks if the user is authenticated
 * @returns {boolean} True if the user has a token, false otherwise
 */
export const isAuthenticated = () => {
  return !!getToken();
};
