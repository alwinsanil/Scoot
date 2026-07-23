const redirectBaseUri = 'https://bu163qsqe6.execute-api.us-east-1.amazonaws.com';
const cognitoConfig = {
    clientId: '5iq7f5dptcr06qmto60mnvftdl',
    redirectUri: `${redirectBaseUri}/dev/auth/callback`,
    authUrl: 'https://scoot-auth-76410.auth.us-east-1.amazoncognito.com/oauth2/authorize',
    signupUrl: 'https://scoot-auth-76410.auth.us-east-1.amazoncognito.com/signup',
    logoutUrl: 'https://scoot-auth-76410.auth.us-east-1.amazoncognito.com/logout',
    scope: 'email openid profile'
  };
export { redirectBaseUri, cognitoConfig };