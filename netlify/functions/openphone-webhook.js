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
      console.log('Full payload:', JSON.stringify(payload, null, 2));

      // Reset daily stats if needed
      resetDailyStats();

      // Try multiple possible field names for the event type
      const eventType = payload.type || payload.event || payload.eventType;
      const callData = payload.data || payload.object || payload; // Added payload.object here!
      
      console.log('Event type detected:', eventType);
      console.log('Call direction:', callData.direction);
      console.log('Call data structure:', Object.keys(callData));

      // Count incoming calls on ringing
      if (eventType === 'call.ringing' || eventType === 'call_ringing') {
        // Only count incoming calls - check multiple possible values
        if (callData.direction === 'incoming' || callData.direction === 'inbound') {
          callStats.today.total++;
          callStats.today.lastUpdated = new Date().toISOString();
          console.log(`Incoming call counted. Total: ${callStats.today.total}`);
        } else {
          console.log(`Skipped non-incoming call. Direction: ${callData.direction}`);
        }
      }

      // Count missed calls on completion
      if (eventType === 'call.completed' || eventType === 'call_completed') {
        // Only check incoming calls
        if (callData.direction === 'incoming' || callData.direction === 'inbound') {
          // Simple missed call check - check for multiple statuses
          if (callData.status === 'missed' || 
              callData.status === 'no-answer' || 
              !callData.answeredAt) {
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
      console.error('Raw body:', event.body);
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
