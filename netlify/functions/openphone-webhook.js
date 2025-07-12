const https = require('https');

// In-memory storage for call stats
let callStats = {
  today: {
    total: 0,
    missed: 0,
    lastReset: new Date().toDateString(),
    lastUpdated: null,
    recentCalls: [] // Store last 10 calls for debugging
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
      lastUpdated: null,
      recentCalls: []
    };
    console.log('Daily stats reset for new day:', today);
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
        lastReset: callStats.today.lastReset,
        recentCalls: callStats.today.recentCalls
      })
    };
  }

  // Handle POST requests - webhook events from OpenPhone
  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body);
      
      // Log the webhook for debugging
      console.log('Webhook received:', payload.type || payload.event);
      console.log('Call data:', JSON.stringify(payload.data || payload, null, 2));

      // Reset daily stats if needed
      resetDailyStats();

      // Handle call.completed events
      if (payload.type === 'call.completed' || payload.event === 'call.completed') {
        const callData = payload.data || payload;
        
        // Increment total calls
        callStats.today.total++;
        
        // Check if missed (multiple conditions to catch different formats)
        const isMissed = 
          callData.status === 'missed' ||
          callData.disposition === 'missed' ||
          callData.answeredAt === null ||
          callData.answered === false ||
          callData.voicemail === true;
        
        if (isMissed) {
          callStats.today.missed++;
        }
        
        // Update last updated time
        callStats.today.lastUpdated = new Date().toISOString();
        
        // Store recent call info (keep last 10)
        callStats.today.recentCalls.unshift({
          time: new Date().toISOString(),
          from: callData.from,
          to: callData.to,
          phoneNumberId: callData.phoneNumberId,
          missed: isMissed,
          duration: callData.duration
        });
        
        if (callStats.today.recentCalls.length > 10) {
          callStats.today.recentCalls.pop();
        }
        
        console.log(`Call processed - Total: ${callStats.today.total}, Missed: ${callStats.today.missed}`);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true })
      };

    } catch (error) {
      console.error('Webhook processing error:', error);
      
      // Still return 200 to acknowledge receipt
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: 'Processing error but acknowledged' })
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
