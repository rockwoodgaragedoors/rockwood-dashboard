const https = require('https');

exports.handler = async (event) => {
  const CLIENT_ID = process.env.JOBBER_CLIENT_ID;
  const CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;
  
  // Get refresh token from query parameter
  const { refresh_token } = event.queryStringParameters || {};
  
  if (!refresh_token) {
    return {
      statusCode: 400,
      body: 'Please provide refresh_token as query parameter'
    };
  }

  try {
    // Exchange refresh token for new access token
    const tokenData = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refresh_token,
        grant_type: 'refresh_token'
      });

      const options = {
        hostname: 'api.getjobber.com',
        path: '/api/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    // Return HTML page showing the new token
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Jobber Token Refreshed</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .token-box {
              background: #f0f0f0;
              padding: 15px;
              border-radius: 5px;
              margin: 10px 0;
              word-break: break-all;
              font-family: monospace;
            }
            h1 { color: #333; }
            h2 { color: #666; }
            .success { color: #4CAF50; }
            button {
              background: #ff661a;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              margin: 5px;
            }
            button:hover { background: #e55a15; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✅ Token Refreshed Successfully!</h1>
            
            <h2>Your New Access Token:</h2>
            <div class="token-box" id="access-token">${tokenData.access_token || 'No access token received'}</div>
            <button onclick="copyToClipboard('access-token')">Copy Access Token</button>
            
            <h2>Your Refresh Token (unchanged):</h2>
            <div class="token-box" id="refresh-token">${tokenData.refresh_token || refresh_token}</div>
            <button onclick="copyToClipboard('refresh-token')">Copy Refresh Token</button>
            
            <h3>Next Steps:</h3>
            <ol>
              <li>Copy the new access token above</li>
              <li>Go to Netlify → Site settings → Environment variables</li>
              <li>Update JOBBER_API_KEY with this new access token</li>
              <li>Redeploy your site</li>
            </ol>
            
            <p><strong>Tip:</strong> Access tokens expire every 2 weeks. Bookmark this URL to easily refresh your token:
            <br><code>https://rgddash.netlify.app/.netlify/functions/jobber-refresh?refresh_token=${refresh_token}</code></p>
          </div>
          
          <script>
            function copyToClipboard(elementId) {
              const text = document.getElementById(elementId).textContent;
              navigator.clipboard.writeText(text).then(() => {
                alert('Copied to clipboard!');
              });
            }
          </script>
        </body>
        </html>
      `
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      statusCode: 500,
      body: `Error refreshing token: ${error.message}`
    };
  }
};
