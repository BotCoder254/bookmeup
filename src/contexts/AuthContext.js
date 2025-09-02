import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { apiClient } from '../utils';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await apiClient.getCurrentUser();
        dispatch({ type: 'AUTH_SUCCESS', payload: user });
      } catch (error) {
        // For single-user mode, try auto-login
        if (window.location.hostname === 'localhost') {
          try {
            const autoLoginResponse = await apiClient.autoLogin();
            if (autoLoginResponse && autoLoginResponse.user) {
              dispatch({ type: 'AUTH_SUCCESS', payload: autoLoginResponse.user });
              return;
            }
          } catch (autoLoginError) {
            console.warn('Auto-login failed:', autoLoginError.message);
          }
        }
        dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    try {
      dispatch({ type: 'AUTH_START' });
      const response = await apiClient.login(credentials);
      dispatch({ type: 'AUTH_SUCCESS', payload: response.user });
      toast.success('Login successful!');
      return response;
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: 'AUTH_START' });
      const response = await apiClient.register(userData);
      dispatch({ type: 'AUTH_SUCCESS', payload: response.user });
      toast.success('Registration successful!');
      return response;
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      toast.error(error.message || 'Registration failed');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
      dispatch({ type: 'LOGOUT' });
      toast.success('Logged out successfully');
    } catch (error) {
      // Still logout on client side even if server request fails
      dispatch({ type: 'LOGOUT' });
      toast.error('Logout error, but you have been logged out locally');
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;