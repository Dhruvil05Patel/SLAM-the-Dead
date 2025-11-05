import React, { createContext, useContext } from 'react';

type Theme = {
  mode: 'light' | 'dark';
};

const ThemeContext = createContext<{ theme: Theme }>({ theme: { mode: 'light' } });

export const ThemeProvider: React.FC<{ children: React.ReactNode; initialMode?: 'light' | 'dark' }> = ({ children, initialMode = 'light' }) => {
  return (
    <ThemeContext.Provider value={{ theme: { mode: initialMode } }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
