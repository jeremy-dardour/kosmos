2. How to get the Google client ID

Use Google Cloud / Google Auth Platform:

1. Open the Google Cloud Console clients page.
2. Create/select a project.
3. Create an OAuth client.
4. Choose Web application.
5. Add authorized JavaScript origins:
   - local: http://localhost and http://localhost:<web-port>
   - production later: https://your-domain

6. Copy the generated client ID, which looks like:
   1234567890-abc123def456.apps.googleusercontent.com

For this app, put it in:

# apps/web/.env

VITE_GOOGLE_CLIENT_ID=...

# apps/api/.env

AUTH_CLIENT_ID=...

Google’s docs specifically say Sign in with Google needs an OAuth 2.0
client ID and that local development should add both http://localhost
and http://localhost:<port> as authorized JavaScript origins. Source:
Google Identity Services setup docs:
https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
