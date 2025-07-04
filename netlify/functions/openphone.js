const https = require('https');

exports.handler = async (event) => {
  const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
  
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  try {
    const { startTime } = JSON.parse(event.body);
    
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.openphone.com',
        path: `/v1/calls?startTime=${startTime}`,
        method: 'GET',
        headers: {
          // Try without Bearer prefix first
          'Authorization': OPENPHONE_API_KEY,
          // Alternative: OpenPhone might use a different header
          'X-API-Key': OPENPHONE_API_KEY,
          'Content-Type': 'application/json'
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          // Pass through the actual status code from OpenPhone
          const statusCode = res.statusCode;
          
          // Log for debugging (will show in Netlify function logs)
          console.log('OpenPhone Response Status:', statusCode);
          console.log('Response Headers:', res.headers);
          
          // If we get a non-2xx status, include the error details
          if (statusCode >= 400) {
            console.error('OpenPhone Error Response:', responseData);
          }
          
          resolve({
            statusCode: statusCode,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: responseData
          });
        });
      });
      
      req.on('error', (error) => {
        console.error('Request Error:', error);
        resolve({
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: error.message })
        });
      });
      
      req.end();
    });
  } catch (error) {
    console.error('Handler Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
