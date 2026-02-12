// Simple test component to verify React app is working
import React from 'react';

function SimpleTest() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🧪 Simple React Test</h1>
      <p>✅ React is working!</p>
      <p>🔧 API URL: {process.env.REACT_APP_API_URL || 'Not set'}</p>
      <p>🌐 Current URL: {window.location.href}</p>
      <button onClick={() => alert('Button clicked!')}>
        Test Button
      </button>
    </div>
  );
}

export default SimpleTest;
