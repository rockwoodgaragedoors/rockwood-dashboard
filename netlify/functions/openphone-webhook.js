const https = require('https');

// In-memory storage for call stats
let callStats = {
  today: {
    total: 0,
    missed: 0,
    lastReset: new Date().toDateString(),
    lastUpdated: null,
    recentCalls: [],
    activeCalls: {} // Track calls from ringing to completed
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
      recentCalls: [],
      activeCalls: {}
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
        recentCalls: callStats.today.recentCalls,
        activeCalls: Object.keys(callStats.today.activeCalls).length
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

      const callData = payload.data || payload;
      const callId = callData.id || callData.callId || callData.sid;

      // Handle call.ringing events
      if (payload.type === 'call.ringing' || payload.event === 'call.ringing') {
        // Only count incoming calls
        if (callData.direction === 'incoming' || callData.direction === 'inbound') {
          // Increment total calls when it starts ringing
          callStats.today.total++;
          
          // Track this call
          callStats.today.activeCalls[callId] = {
            startTime: new Date().toISOString(),
            from: callData.from,
            to: callData.to,
            phoneNumberId: callData.phoneNumberId,
            status: 'ringing'
          };
          
          // Update last updated time
          callStats.today.lastUpdated = new Date().toISOString();
          
          console.log(`Incoming call ringing - Total: ${callStats.today.total}, Call ID: ${callId}`);
        }
      }

      // Handle call.completed events
      if (payload.type === 'call.completed' || payload.event === 'call.completed') {
        // Check if this was a tracked incoming call
        if (callStats.today.activeCalls[callId]) {
          // Check if missed
          const isMissed = 
            callData.status === 'missed' ||
            callData.disposition === 'missed' ||
            callData.answeredAt === null ||
            callData.answered === false ||
            (callData.duration && callData.duration === 0);
          
          if (isMissed) {
            callStats.today.missed++;
            console.log(`Missed call detected - Total missed: ${callStats.today.missed}`);
          }
          
          // Store completed call info
          callStats.today.recentCalls.unshift({
            time: new Date().toISOString(),
            from: callData.from,
            to: callData.to,
            phoneNumberId: callData.phoneNumberId,
            missed: isMissed,
            duration: callData.duration,
            direction: 'incoming'
          });
          
          if (callStats.today.recentCalls.length > 10) {
            callStats.today.recentCalls.pop();
          }
          
          // Remove from active calls
          delete callStats.today.activeCalls[callId];
          
          // Update last updated time
          callStats.today.lastUpdated = new Date().toISOString();
          
          console.log(`Call completed - Missed: ${isMissed}, Total: ${callStats.today.total}, Missed: ${callStats.today.missed}`);
        } else if (callData.direction === 'incoming' || callData.direction === 'inbound') {
          // This is an incoming call we didn't track during ringing (maybe webhook was added mid-call)
          // Still count it
          callStats.today.total++;
          
          const isMissed = 
            callData.status === 'missed' ||
            callData.disposition === 'missed' ||
            callData.answeredAt === null ||
            callData.answered === false ||
            (callData.duration && callData.duration === 0);
          
          if (isMissed) {
            callStats.today.missed++;
          }
          
          console.log(`Untracked incoming call completed - Total: ${callStats.today.total}, Missed: ${callStats.today.missed}`);
        }
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
