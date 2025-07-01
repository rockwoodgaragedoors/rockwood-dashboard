const https = require('https');

exports.handler = async (event) => {
  const JOBBER_API_KEY = process.env.JOBBER_API_KEY;
  
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
    const { query } = JSON.parse(event.body);
    
    return new Promise((resolve) => {
      const data = JSON.stringify({ query });
      
      const options = {
        hostname: 'api.getjobber.com',
        path: '/api/graphql',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JOBBER_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
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
      
      req.write(data);
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