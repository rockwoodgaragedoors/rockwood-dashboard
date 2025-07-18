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
    const requestBody = JSON.parse(event.body);
    const { startTime, phoneNumberId, participants } = requestBody;
    
    // If no phoneNumberId provided, we need to get the phone numbers first
    if (!phoneNumberId) {
      return new Promise((resolve) => {
        const options = {
          hostname: 'api.openphone.com',
          path: '/v1/phone-numbers',
          method: 'GET',
          headers: {
            'Authorization': OPENPHONE_API_KEY,
            'Content-Type': 'application/json'
          }
        };
        
        const req = https.request(options, (res) => {
          let responseData = '';
          
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: responseData
            });
          });
        });
        
        req.on('error', (error) => {
          resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
          });
        });
        
        req.end();
      });
    }
    
    // If we have phoneNumberId, get the calls
    return new Promise((resolve) => {
      // Build query parameters - OpenPhone API uses query params for GET requests
      const params = new URLSearchParams();
      
      // Required parameters
      params.append('phoneNumberId', phoneNumberId);
      
      // Add participants if provided - each participant needs to be added separately
      if (participants && participants.length > 0) {
        participants.forEach(participant => {
          params.append('participants', participant);
        });
      }
      // If no participants provided, we'll try without the parameter
      
      // Date filters
      const now = new Date();
      const start = new Date(startTime);
      params.append('createdAfter', start.toISOString());
      params.append('createdBefore', now.toISOString());
      
      // Pagination
      params.append('limit', '100');
      
      const options = {
        hostname: 'api.openphone.com',
        path: `/v1/calls?${params.toString()}`,
        method: 'GET',
        headers: {
          'Authorization': OPENPHONE_API_KEY,
          'Content-Type': 'application/json'
        }
      };
      
      console.log('OpenPhone API URL:', `https://api.openphone.com/v1/calls?${params.toString()}`);
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const statusCode = res.statusCode;
          
          console.log('OpenPhone Response Status:', statusCode);
          
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
