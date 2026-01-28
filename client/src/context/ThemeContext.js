import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

const ThemeContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Helper to get the effective theme (resolves 'system' to 'light' or 'dark')
const getEffectiveTheme = (theme) => {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
};

export const ThemeProvider = ({ children }) => {
  const { isSignedIn, getToken } = useAuth();
  
  // Main theme state: can be 'light', 'dark', or 'system'
  const [theme, setThemeState] = useState(() => {
    const savedTheme = localStorage.getItem('docsy-theme');
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      return savedTheme;
    }
    return 'system';
  });
  
  const [isLoading, setIsLoading] = useState(true);

  // Fetch theme from backend for authenticated users
  useEffect(() => {
    const fetchThemeFromDB = async () => {
      if (!isSignedIn) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/api/preferences`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const dbTheme = data.preferences?.theme || 'system';
          
          // Apply theme from database
          setThemeState(dbTheme);
          localStorage.setItem('docsy-theme', dbTheme);
        }
      } catch (error) {
        console.error('Failed to fetch theme from database:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThemeFromDB();
  }, [isSignedIn, getToken]);

  // Apply effective theme to DOM
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      const effectiveTheme = getEffectiveTheme(theme);

      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // Update localStorage for guest users
    if (!isSignedIn) {
      localStorage.setItem('docsy-theme', theme);
    }
  }, [theme, isSignedIn]);

  // Listen for OS theme changes ONLY when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      // Force re-render by updating a dummy state or re-applying theme
      const root = window.document.documentElement;
      const effectiveTheme = getEffectiveTheme('system');
      
      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } 
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [theme]);

  // Listen for localStorage changes from other tabs (guest users only)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'docsy-theme' && 
          ['light', 'dark', 'system'].includes(e.newValue) && 
          !isSignedIn) {
        setThemeState(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isSignedIn]);

  // Set theme and persist to backend or localStorage
  const setTheme = async (newTheme) => {
    if (!['light', 'dark', 'system'].includes(newTheme)) {
      console.error('Invalid theme value:', newTheme);
      return;
    }

    // Update local state immediately
    setThemeState(newTheme);

    // Persist to backend for authenticated users
    if (isSignedIn) {
      try {
        const token = await getToken();
        await fetch(`${API_URL}/api/preferences`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ theme: newTheme })
        });
      } catch (error) {
        console.error('Failed to save theme to database:', error);
        // Still update localStorage as fallback
        localStorage.setItem('docsy-theme', newTheme);
      }
    } else {
      // For guest users, save to localStorage
      localStorage.setItem('docsy-theme', newTheme);
    }
  };

  // Toggle between light and dark (maintains manual override)
  const toggleTheme = () => {
    const currentEffective = getEffectiveTheme(theme);
    const newTheme = currentEffective === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Get the current effective theme for UI display
  const effectiveTheme = getEffectiveTheme(theme);

  return (
    <ThemeContext.Provider value={{ 
      theme,           // The actual theme setting ('light', 'dark', or 'system')
      effectiveTheme,  // The resolved theme ('light' or 'dark')
      setTheme, 
      toggleTheme, 
      isLoading 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};