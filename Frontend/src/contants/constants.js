const redirectBaseUri = 'https://27y5d88znf.execute-api.us-east-1.amazonaws.com';
const cognitoConfig = {
    clientId: '2lg7ibg0kuj53brvmudl1b6mee',
    redirectUri: `${redirectBaseUri}/dev/auth/callback`,
    authUrl: 'https://dalscooter-auth-47700.auth.us-east-1.amazoncognito.com/oauth2/authorize',
    signupUrl: 'https://dalscooter-auth-47700.auth.us-east-1.amazoncognito.com/signup',
    logoutUrl: 'https://dalscooter-auth-47700.auth.us-east-1.amazoncognito.com/logout',
    scope: 'email openid profile'
  };
export { redirectBaseUri, cognitoConfig };
