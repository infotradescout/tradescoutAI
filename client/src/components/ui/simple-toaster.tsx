import React from 'react';

// Simple toast system without hooks to avoid React context issues
export function SimpleToaster() {
  return (
    <div id="toast-container" className="fixed top-4 right-4 z-50 space-y-2">
      {/* Toasts will be dynamically added here */}
    </div>
  );
}

// Simple toast function that doesn't rely on React hooks
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `
    p-4 rounded-lg shadow-lg border max-w-sm transform transition-all duration-300 ease-in-out
    ${type === 'success' ? 'bg-green-600 border-green-500 text-white' :
      type === 'error' ? 'bg-red-600 border-red-500 text-white' :
      'bg-blue-600 border-blue-500 text-white'}
  `;
  
  toast.innerHTML = `
    <div class="flex items-center space-x-2">
      <div class="flex-1 text-sm font-medium">${message}</div>
      <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
        ×
      </button>
    </div>
  `;

  container.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}