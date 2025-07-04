const https = require('https');

// Store the refresh token (in production, use a database)
const REFRESH_TOKEN = '9aad5d461674d14cfb02c6bf7aa8db15';

// Helper function to refresh the access token
async function refreshAccessToken() {
  const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID;
  const JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;
  
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
      client_id: JOBBER_CLIENT_ID,
      client_secret: JOBBER_CLIENT_SECRET
    }).toString();

    const options = {
      hostname: 'api.getjobber.com',
      path: '/api/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('Refreshing Jobber access token...');

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.access_token) {
            console.log('Successfully refreshed access token');
            resolve(response.access_token);
          } else {
            console.error('Failed to refresh token:', response);
            reject(new Error('Failed to refresh token'));
          }
        } catch (error) {
          console.error('Error parsing refresh response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Main handler with auto-refresh logic
exports.handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { query, variables } = JSON.parse(event.body);
    
    // Function to make the API call
    const makeApiCall = (accessToken) => {
      return new Promise((resolve) => {
        const postData = JSON.stringify({
          query,
          variables
        });

        const options = {
          hostname: 'api.getjobber.com',
          path: '/api/graphql',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'X-JOBBER-GRAPHQL-VERSION': '2023-11-15'
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
              data: responseData
            });
          });
        });

        req.on('error', (error) => {
          resolve({
            statusCode: 500,
            data: JSON.stringify({ error: error.message })
          });
        });

        req.write(postData);
        req.end();
      });
    };

    // Try with current token first
    let accessToken = process.env.JOBBER_API_KEY;
    let response = await makeApiCall(accessToken);
    
    // If we get a 401 or token expired message, refresh and retry
    if (response.statusCode === 401 || 
        (response.statusCode === 200 && response.data.includes('Access token expired'))) {
      console.log('Token expired, refreshing...');
      
      try {
        // Get new access token
        const newAccessToken = await refreshAccessToken();
        
        // IMPORTANT: You need to update the environment variable
        // In production, you'd update this in your database
        console.log('NEW ACCESS TOKEN:', newAccessToken);
        console.log('UPDATE YOUR NETLIFY ENV VARIABLE WITH THIS TOKEN!');
        
        // Retry the API call with new token
        response = await makeApiCall(newAccessToken);
        
        // Add a note in the response about the new token
        const responseData = JSON.parse(response.data);
        responseData._tokenRefreshed = true;
        responseData._newToken = newAccessToken;
        response.data = JSON.stringify(responseData);
        
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to refresh token',
            message: 'Please check your refresh token'
          })
        };
      }
    }

    return {
      statusCode: response.statusCode,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: response.data
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
