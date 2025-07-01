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
          'Authorization': `Bearer ${OPENPHONE_API_KEY}`
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: 200,
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
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};