import { useState, useEffect } from 'react';
import { AlertCircle, Lock, User, UserPlus } from 'lucide-react';

function Auth() {
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'

  // AWS Cognito Configuration
  const cognitoConfig = {
    clientId: '3tcb78k8ksrv41965lh8hfpqla',
    redirectUri: "https://tupiqo0472.execute-api.us-east-1.amazonaws.com/dev/auth/callback",
    authUrl: 'https://dalscooter-auth-21645.auth.us-east-1.amazoncognito.com/oauth2/authorize',
    signupUrl: 'https://dalscooter-auth-21645.auth.us-east-1.amazoncognito.com/signup',
    scope: 'email openid profile'
  };

  // Check for auth data from POST redirect handler
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error) setError('Authentication failed: ' + error.replace('_', ' '));
  }, []);

  const handleCognitoLogin = () => {
    const authUrl = `${cognitoConfig.authUrl}?response_type=code&client_id=${cognitoConfig.clientId}&redirect_uri=${encodeURIComponent(cognitoConfig.redirectUri)}&scope=${encodeURIComponent(cognitoConfig.scope)}`;
    window.location.href = authUrl;
  };

  const handleCognitoSignup = () => {
    const signupUrl = `${cognitoConfig.signupUrl}?response_type=code&client_id=${cognitoConfig.clientId}&redirect_uri=${encodeURIComponent(cognitoConfig.redirectUri)}&scope=${encodeURIComponent(cognitoConfig.scope)}`;
    window.location.href = signupUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {authMode === 'signup' ? (
              <UserPlus className="w-8 h-8 text-blue-600" />
            ) : (
              <Lock className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {authMode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-gray-600">
            {authMode === 'signup'
              ? 'Create a new account using AWS Cognito'
              : 'Sign in to your account using AWS Cognito'
            }
          </p>
        </div>

        {/* Auth Mode Toggle */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${authMode === 'login'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${authMode === 'signup'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {authMode === 'signup' ? (
            <button
              onClick={handleCognitoSignup}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Create Account with AWS Cognito
            </button>
          ) : (
            <button
              onClick={handleCognitoLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <User className="w-5 h-5" />
              Sign in with AWS Cognito
            </button>
          )}
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Secure authentication powered by AWS Cognito
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Client ID:</strong> {cognitoConfig.clientId}</p>
            <p><strong>API Gatzeway:</strong> {cognitoConfig.redirectUri}</p>
            <p><strong>Mode:</strong> {authMode === 'signup' ? 'Sign Up' : 'Sign In'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;