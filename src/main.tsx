import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Static version for cache-busting (only changes on actual deploys)
const APP_VERSION = 'v1.2.1'; // Only increment this manually when needed
const STORED_VERSION_KEY = 'collabcanvas_version';

// Clear all browser data if version changed
function clearOldDataIfNeeded() {
  const storedVersion = localStorage.getItem(STORED_VERSION_KEY);
  
  if (storedVersion && storedVersion !== APP_VERSION) {
    console.log('[Cache] Version changed, clearing all data:', storedVersion, '->', APP_VERSION);
    
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear IndexedDB if it exists
    if ('indexedDB' in window) {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      }).catch(console.error);
    }
    
    // Clear service worker caches
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
    }
    
    // Store new version BEFORE reload to prevent loop
    localStorage.setItem(STORED_VERSION_KEY, APP_VERSION);
    
    // Simple reload without query params
    window.location.reload();
    return;
  }
  
  // Store current version
  localStorage.setItem(STORED_VERSION_KEY, APP_VERSION);
}

// Run cache clearing check
clearOldDataIfNeeded();

// Register service worker for better cache control
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js') // Register service worker
      .then((registration) => {
        console.log('[SW] Registration successful:', registration);
        
        // Force update check
        registration.update();
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available - force reload immediately
                console.log('[SW] New version available - auto-updating');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                setTimeout(() => {
                  window.location.reload();
                }, 100);
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('[SW] Registration failed:', error);
      });
  });

  // Listen for service worker updates
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW] Controller changed - reloading');
    window.location.reload();
  });
}
