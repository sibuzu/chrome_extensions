// Show alert
export function showAlert(message, duration = 5000) {
  const alertContainer = document.querySelector('.alert-container');
  if (!alertContainer) {
    console.error('[Sidebar] Alert container not found');
    return;
  }

  // Remove existing alerts with the same message to prevent duplicates
  const existingAlerts = alertContainer.querySelectorAll('.alert');
  existingAlerts.forEach(existing => {
    if (existing.querySelector('.alert-content')?.textContent === message) {
      removeAlert(existing);
    }
  });

  // Create alert element
  const alert = document.createElement('div');
  alert.className = 'alert';
  
  const content = document.createElement('div');
  content.className = 'alert-content';
  content.textContent = message;
  
  const closeButton = document.createElement('button');
  closeButton.className = 'alert-close';
  closeButton.innerHTML = '×';
  closeButton.onclick = () => removeAlert(alert);
  
  alert.appendChild(content);
  alert.appendChild(closeButton);
  
  // Add to container
  alertContainer.appendChild(alert);
  alertContainer.classList.add('visible');
  
  // Ensure the alert is visible by scrolling it into view if needed
  setTimeout(() => {
    alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
  
  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => removeAlert(alert), duration);
  }
  
  return alert;
}

// Remove alert
export function removeAlert(alert) {
  if (!alert || !alert.parentElement) return;
  
  // Start fade out
  alert.style.opacity = '0';
  
  // Remove after animation
  setTimeout(() => {
    alert.remove();
    
    // Hide container if no more alerts
    const alertContainer = document.querySelector('.alert-container');
    if (alertContainer && !alertContainer.children.length) {
      alertContainer.classList.remove('visible');
    }
  }, 300);
}

// Handle error display
export function handleError(error) {
  console.error('[Sidebar] Error:', error);
  const message = error.message || 'An unexpected error occurred. Please try refreshing the page.';
  console.log('[Sidebar] Showing error alert:', message);
  showAlert(message);
}
