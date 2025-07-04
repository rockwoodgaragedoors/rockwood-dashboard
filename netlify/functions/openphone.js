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
    
    // First, let's try to get phone numbers to understand the API structure
    return new Promise((resolve) => {
      // Try the messages endpoint which might include call data
      // Or try the phone-numbers endpoint first to get valid phoneNumberIds
      const options = {
        hostname: 'api.openphone.com',
        path: '/v1/phone-numbers', // Start with getting phone numbers
        method: 'GET',
        headers: {
          'Authorization': OPENPHONE_API_KEY, // No Bearer prefix, just the key
          'Content-Type': 'application/json'
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const statusCode = res.statusCode;
          
          console.log('OpenPhone Response Status:', statusCode);
          console.log('Response Headers:', res.headers);
          
          if (statusCode >= 400) {
            console.error('OpenPhone Error Response:', responseData);
          }
          
          // If we successfully get phone numbers, we can then fetch calls
          if (statusCode === 200) {
            try {
              const phoneNumbers = JSON.parse(responseData);
              console.log('Phone numbers found:', phoneNumbers);
              
              // Return the phone numbers for now so we can see the structure
              resolve({
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phoneNumbers: phoneNumbers,
                  message: "Successfully retrieved phone numbers. Next step: use phoneNumberId to get calls."
                })
              });
            } catch (parseError) {
              resolve({
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: responseData
              });
            }
          } else {
            resolve({
              statusCode: statusCode,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: responseData
            });
          }
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
