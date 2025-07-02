const https = require('https');

exports.handler = async (event) => {
  const AIRIQ_USERNAME = process.env.AIRIQ_USERNAME;
  const AIRIQ_PASSWORD = process.env.AIRIQ_PASSWORD;
  
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
    const { endpoint } = JSON.parse(event.body);
    
    // Create Basic Auth header
    const auth = Buffer.from(`${AIRIQ_USERNAME}:${AIRIQ_PASSWORD}`).toString('base64');
    
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.airiqfleet.com',
        path: endpoint,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
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
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
