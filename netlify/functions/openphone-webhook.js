const https = require('https');

// In-memory storage for call stats
let callStats = {
  today: {
    total: 0,
    missed: 0,
    lastReset: new Date().toDateString(),
    lastUpdated: null
  }
};

// Helper function to reset daily stats
function resetDailyStats() {
  const today = new Date().toDateString();
  if (callStats.today.lastReset !== today) {
    callStats.today = {
      total: 0,
      missed: 0,
      lastReset: today,
      lastUpdated: null
    };
  }
}

exports.handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Handle GET requests - return current stats
  if (event.httpMethod === 'GET') {
    resetDailyStats();
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalCalls: callStats.today.total,
        missedCalls: callStats.today.missed,
        lastUpdated: callStats.today.lastUpdated,
        lastReset: callStats.today.lastReset
      })
    };
  }

  // Handle POST requests - webhook events from OpenPhone
  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body);
      console.log('=== WEBHOOK RECEIVED ===');
      console.log('Type:', payload.type);
      console.log('Data:', JSON.stringify(payload.data, null, 2));

      // Reset daily stats if needed
      resetDailyStats();

      // Count incoming calls on ringing
      if (payload.type === 'call.ringing') {
        const callData = payload.data;
        // Only count incoming calls
        if (callData.direction === 'incoming') {
          callStats.today.total++;
          callStats.today.lastUpdated = new Date().toISOString();
          console.log(`Incoming call counted. Total: ${callStats.today.total}`);
        }
      }

      // Count missed calls on completion
      if (payload.type === 'call.completed') {
        const callData = payload.data;
        // Only check incoming calls
        if (callData.direction === 'incoming') {
          // Simple missed call check
          if (callData.status === 'missed' || !callData.answeredAt) {
            callStats.today.missed++;
            callStats.today.lastUpdated = new Date().toISOString();
            console.log(`Missed call counted. Total missed: ${callStats.today.missed}`);
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true })
      };

    } catch (error) {
      console.error('Error processing webhook:', error);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: 'Processing error' })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
