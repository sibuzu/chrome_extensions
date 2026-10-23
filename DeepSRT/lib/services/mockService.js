import { showAlert } from '../ui/alerts.js';

// Global mock state
const mockState = {
  enabled: false,
  errorType: '429',
  target: 'all',
  targets: {}
};

// Add user-friendly mock function for console use
export function userMock(errorType = '429', target = 'all') {
  console.log('[Mock] User triggered mock with:', { errorType, target });
  
  // If target is 'all', toggle everything. Otherwise only toggle specified target
  if (target === 'all') {
    mockState.enabled = !mockState.enabled;
    mockState.errorType = errorType;
    mockState.target = target;
  } else {
    // Initialize targets if not exists
    mockState.targets = mockState.targets || {};
    
    // Toggle specific target
    if (mockState.targets[target]) {
      delete mockState.targets[target];
    } else {
      mockState.targets[target] = errorType;
    }
    
    // Update overall enabled state
    mockState.enabled = Object.keys(mockState.targets).length > 0;
  }
  
  const message = mockState.enabled ? 
    `Mock mode enabled (${errorType})${target !== 'all' ? ` for ${target}` : ''}` : 
    'Mock mode disabled';
  
  // Show alert with error styling
  const alert = showAlert(message, 5000);
  if (alert) {
    alert.classList.add('error-alert');
  }
  
  // Update UI to show mock mode state
  updateMockModeIndicator();
  
  console.log('[Mock] Mode:', mockState);
  return message;
}

// Mock response functions
function getMockErrorResponse(status = 429) {
  const errors = {
    429: {
      status: 429,
      error: 'Too many requests. Please wait a moment and try again.',
      json: () => Promise.resolve({ 
        error: 'Too many requests. Please wait a moment and try again.' 
      })
    },
    500: {
      status: 500,
      error: 'Internal server error',
      json: () => Promise.resolve({ error: 'Internal server error' })
    },
    404: {
      status: 404,
      error: 'Resource not found',
      json: () => Promise.resolve({ error: 'Resource not found' })
    }
  };

  return {
    ok: false,
    status: status,
    ...errors[status],
  };
}

// Mock fetch function with target support
export async function mockFetch(url, options) {
  if (mockState.enabled) {
    // Determine which API is being called
    const isTranscript = url.includes('/transcript') && options.body;
    const requestBody = isTranscript ? JSON.parse(options.body) : null;
    const isSummary = isTranscript && requestBody?.action === 'summarize';
    const isTranslate = isTranscript && requestBody?.action === 'translate';
    
    // Check if this type of request should be mocked
    const shouldMock = mockState.target === 'all' ||
      (isSummary && mockState.targets?.summary) ||
      (isTranslate && mockState.targets?.translate);
    
    if (shouldMock) {
      const errorType = mockState.target === 'all' ? 
        mockState.errorType : 
        mockState.targets[isSummary ? 'summary' : 'translate'];
        
      console.log('[Mock] Returning mock error response:', {
        errorType,
        requestType: isSummary ? 'summary' : isTranslate ? 'translate' : 'transcript'
      });
      return getMockErrorResponse(parseInt(errorType));
    }
  }
  return fetch(url, options);
}

// Toggle mock mode
export function toggleMockMode(errorType = '429') {
  console.log('[Mock] Toggling mock mode with error type:', errorType);
  
  mockState.enabled = !mockState.enabled;
  mockState.errorType = errorType;
  
  // Show indicator
  showAlert(`Mock mode ${mockState.enabled ? 'enabled' : 'disabled'}${mockState.enabled ? ` (${errorType})` : ''}`, 2000);
  
  // Update UI to show mock mode state
  updateMockModeIndicator();
  
  console.log('[Mock] Mode:', mockState);
}

// Update mock mode indicator
function updateMockModeIndicator() {
  let indicator = document.querySelector('.mock-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'mock-indicator';
    document.querySelector('.controls-right')?.prepend(indicator);
  }
  
  if (mockState.enabled) {
    const targets = mockState.target === 'all' ? 
      `ALL (${mockState.errorType})` :
      Object.entries(mockState.targets)
        .map(([target, code]) => `${target}:${code}`)
        .join(', ');
    
    indicator.textContent = `MOCK [${targets}]`;
    indicator.classList.add('active');
  } else {
    indicator.textContent = 'MOCK';
    indicator.classList.remove('active');
  }
}

// Export mock state for external access
export const getMockState = () => ({ ...mockState });
