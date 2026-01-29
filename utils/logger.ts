/**
 * Simple logger utility for development
 * Set enabled to false in production builds
 */

const enabled = __DEV__; // Only log in development

export const logger = {
  info: (...args: any[]) => {
    if (enabled) console.log('ℹ️', ...args);
  },
  
  success: (...args: any[]) => {
    if (enabled) console.log('✅', ...args);
  },
  
  warn: (...args: any[]) => {
    if (enabled) console.warn('⚠️', ...args);
  },
  
  error: (...args: any[]) => {
    console.error('❌', ...args);
  },
  
  debug: (label: string, data: any) => {
    if (enabled) {
      console.log(`🔍 ${label}:`, data);
    }
  },
};