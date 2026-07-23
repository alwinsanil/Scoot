const redirectBaseUri = 'https://eyoib5lnj8.execute-api.us-east-1.amazonaws.com';
const cognitoConfig = {
    clientId: '3itend8hpu9236609nkc8tct4g',
    redirectUri: `${redirectBaseUri}/dev/auth/callback`,
    authUrl: 'https://scoot-auth-24347.auth.us-east-1.amazoncognito.com/oauth2/authorize',
    signupUrl: 'https://scoot-auth-24347.auth.us-east-1.amazoncognito.com/signup',
    logoutUrl: 'https://scoot-auth-24347.auth.us-east-1.amazoncognito.com/logout',
    scope: 'email openid profile'
  };
export { redirectBaseUri, cognitoConfig };
