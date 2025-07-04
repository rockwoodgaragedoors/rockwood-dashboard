const https = require('https');

// In-memory storage for call stats (resets when function cold starts)
// In production, you'd want to use a database like Supabase, Firebase, or FaunaDB
let callStats = {
  today: {
    total: 0,
    missed: 0,
    byHour: {},
    lastReset: new Date().toDateString()
  }
};

// Helper function to reset daily stats
function resetDailyStats() {
  const today = new Date().toDateString();
  if (callStats.today.lastReset !== today) {
    callStats.today = {
      total: 0,
      missed: 0,
      byHour: {},
      lastReset: today
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
        callsByHour: callStats.today.byHour,
        lastUpdated: new Date().toISOString()
      })
    };
  }

  // Handle POST requests - webhook events from OpenPhone
  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body);
      console.log('Webhook received:', payload.type);

      // Reset daily stats if needed
      resetDailyStats();

      // Handle different webhook events
      switch (payload.type) {
        case 'call.completed':
          const call = payload.data;
          
          // Only count calls for the Primary line
          if (call.phoneNumberId === 'PNDcUZEsVX') {
            callStats.today.total++;
            
            // Track missed calls
            if (!call.answeredAt || call.status === 'missed') {
              callStats.today.missed++;
            }
            
            // Track calls by hour
            const hour = new Date(call.createdAt).getHours();
            callStats.today.byHour[hour] = (callStats.today.byHour[hour] || 0) + 1;
            
            console.log(`Call tracked - Total: ${callStats.today.total}, Missed: ${callStats.today.missed}`);
          }
          break;

        case 'call.ringing':
          // You could track incoming calls in progress here
          console.log('Call ringing:', payload.data);
          break;

        default:
          console.log('Unhandled webhook type:', payload.type);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true })
      };

    } catch (error) {
      console.error('Webhook processing error:', error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid webhook payload' })
      };
    }
  }

  // Method not allowed
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
