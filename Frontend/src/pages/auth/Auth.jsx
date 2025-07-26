import { useState, useEffect } from 'react';
import { AlertCircle, Lock, User, UserPlus, Shield, Zap, Sparkles } from 'lucide-react';

function Auth() {
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [isLoading, setIsLoading] = useState(false);

  // AWS Cognito Configuration
  const cognitoConfig = {
    clientId: '1hki99totvkb99vddorjkhh7bg',
    redirectUri: "https://tn4egaaps4.execute-api.us-east-1.amazonaws.com/dev/auth/callback",
    authUrl: 'https://dalscooter-auth-13288.auth.us-east-1.amazoncognito.com/oauth2/authorize',
    signupUrl: 'https://dalscooter-auth-13288.auth.us-east-1.amazoncognito.com/signup',
    scope: 'email openid profile'
  };

  // Check for auth data from POST redirect handler
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error) setError('Authentication failed: ' + error.replace('_', ' '));
  }, []);

  const handleCognitoLogin = () => {
    setIsLoading(true);
    const authUrl = `${cognitoConfig.authUrl}?response_type=code&client_id=${cognitoConfig.clientId}&redirect_uri=${encodeURIComponent(cognitoConfig.redirectUri)}&scope=${encodeURIComponent(cognitoConfig.scope)}`;
    window.location.href = authUrl;
  };

  const handleCognitoSignup = () => {
    setIsLoading(true);
    const signupUrl = `${cognitoConfig.signupUrl}?response_type=code&client_id=${cognitoConfig.clientId}&redirect_uri=${encodeURIComponent(cognitoConfig.redirectUri)}&scope=${encodeURIComponent(cognitoConfig.scope)}`;
    window.location.href = signupUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-pink-200 rounded-full opacity-40"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-purple-200 rounded-full opacity-40"></div>
        <div className="absolute bottom-32 left-40 w-28 h-28 bg-blue-200 rounded-full opacity-40"></div>
        <div className="absolute bottom-20 right-20 w-20 h-20 bg-yellow-200 rounded-full opacity-40"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-pink-100 shadow-xl p-8 w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-pink-200 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              {authMode === 'signup' ? (
                <UserPlus className="w-10 h-10 text-purple-600" />
              ) : (
                <Lock className="w-10 h-10 text-purple-600" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-3">
              {authMode === 'signup' ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-gray-600 text-lg">
              {authMode === 'signup'
                ? 'Join us and start your journey today'
                : 'Sign in to continue where you left off'
              }
            </p>
          </div>

          {/* Auth Mode Toggle */}
          <div className="flex mb-8 bg-gray-100/60 rounded-xl p-1 border border-gray-200/50">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-3 px-6 rounded-lg text-sm font-semibold transition-colors ${
                authMode === 'login'
                  ? 'bg-white text-purple-600 shadow-sm border border-purple-100'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-3 px-6 rounded-lg text-sm font-semibold transition-colors ${
                authMode === 'signup'
                  ? 'bg-white text-pink-600 shadow-sm border border-pink-100'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-6">
            {authMode === 'signup' ? (
              <button
                onClick={handleCognitoSignup}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <UserPlus className="w-5 h-5" />
                )}
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            ) : (
              <button
                onClick={handleCognitoLogin}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-400 to-indigo-400 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <User className="w-5 h-5" />
                )}
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            )}
            
            {/* Security Features */}
            <div className="bg-gray-50/60 rounded-xl p-4 border border-gray-200/50">
              <div className="flex items-center justify-center gap-6 text-gray-600">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium">Secure</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-medium">Fast</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-medium">Reliable</span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-gray-500 text-sm">
                Powered by{' '}
                <span className="text-purple-600 font-semibold">
                  AWS Cognito
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;