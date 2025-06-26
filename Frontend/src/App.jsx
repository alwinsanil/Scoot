import React, { useState, useEffect } from 'react';
import { AlertCircle, Lock, User, ArrowRight, Loader2, UserPlus, CheckCircle } from 'lucide-react';

const LoginSignupPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authData, setAuthData] = useState(null);
  const [currentStep, setCurrentStep] = useState('auth'); // 'auth', 'login', 'signup', or 'qna'
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [qnaAnswers, setQnaAnswers] = useState({});
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);

  // AWS Cognito Configuration
  const cognitoConfig = {
    clientId: '5bc52eofgvj1latldpn713d0g7',
    redirectUri: 'https://yu48pvemy7.execute-api.us-east-1.amazonaws.com/dev/auth/callback',
    authUrl: 'https://dalscooter-auth-16840.auth.us-east-1.amazoncognito.com/oauth2/authorize',
    signupUrl: 'https://dalscooter-auth-16840.auth.us-east-1.amazoncognito.com/signup',
    scope: 'email openid profile'
  };

  // Check for auth data from POST redirect handler
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    const error = urlParams.get('error');

    if (encodedData) {
      try {
        const authResponse = JSON.parse(atob(encodedData));
        setAuthData(authResponse);

        if (authResponse.nextStep === 'qna') {
          setCurrentStep('qna');
          // Check if this is likely a first-time setup based on the auth flow
          setIsFirstTimeSetup(authResponse.isFirstTimeSetup || false);
        }
      } catch (err) {
        setError('Failed to process authentication data.');
        console.error('Data decode error:', err);
      }
    } else if (error) {
      setError('Authentication failed: ' + error.replace('_', ' '));
    }
  }, []);

  const handleCognitoLogin = () => {
    const authUrl = `${cognitoConfig.authUrl}?response_type=code&client_id=${cognitoConfig.clientId}&redirect_uri=${encodeURIComponent(cognitoConfig.redirectUri)}&scope=${encodeURIComponent(cognitoConfig.scope)}`;
    window.location.href = authUrl;
  };

  const handleCognitoSignup = () => {
    const signupUrl = `${cognitoConfig.signupUrl}?response_type=code&client_id=${cognitoConfig.clientId}&redirect_uri=${encodeURIComponent(cognitoConfig.redirectUri)}&scope=${encodeURIComponent(cognitoConfig.scope)}`;
    window.location.href = signupUrl;
  };

  const handleQnaSubmit = async () => {
    setIsLoading(true);
    setError('');

    // Validate all questions are answered
    const unansweredQuestions = qnaQuestions.filter(q => !qnaAnswers[q.id]?.trim());
    if (unansweredQuestions.length > 0) {
      setError('Please answer all security questions.');
      setIsLoading(false);
      return;
    }

    const answersArray = qnaQuestions.map(q => qnaAnswers[q.id].trim());

    try {
      const response = await fetch('https://yu48pvemy7.execute-api.us-east-1.amazonaws.com/dev/auth/qna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempToken: authData?.tempToken,
          answers: answersArray
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Q&A verification failed');
      }

      setAuthData(result);
      setIsFirstTimeSetup(result.isFirstTimeSetup);

      if (result.nextStep === 'cipher') {
        alert(`${result.message}\n\nNext step: ${result.nextStep}`);
        // Optionally move to next step here
      } else {
        alert('Authentication complete!');
      }
    } catch (err) {
      setError(err.message || 'Q&A verification failed. Please try again.');
      console.error('Q&A submission error:', err);
    } finally {
      setIsLoading(false);
    }
  };


  const handleQnaChange = (question, answer) => {
    setQnaAnswers(prev => ({
      ...prev,
      [question]: answer
    }));
  };

  const qnaQuestions = [
    {
      id: 'security_question_1',
      question: 'What was the name of your first pet?',
      type: 'text'
    },
    {
      id: 'security_question_2',
      question: 'In what city were you born?',
      type: 'text'
    },
    {
      id: 'security_question_3',
      question: 'What is your best friend\'s name?',
      type: 'text'
    }
  ];

  // Check if all questions are answered
  const allQuestionsAnswered = qnaQuestions.every(q => qnaAnswers[q.id]?.trim());

  if (currentStep === 'qna') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isFirstTimeSetup ? 'bg-green-100' : 'bg-blue-100'
              }`}>
              {isFirstTimeSetup ? (
                <UserPlus className={`w-8 h-8 ${isFirstTimeSetup ? 'text-green-600' : 'text-blue-600'}`} />
              ) : (
                <Lock className="w-8 h-8 text-blue-600" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isFirstTimeSetup ? 'Setup Security Questions' : 'Security Verification'}
            </h1>
            <p className="text-gray-600">
              {isFirstTimeSetup
                ? 'Please set up your security questions for future logins'
                : 'Please answer your security questions to continue'
              }
            </p>
            {authData?.message && (
              <p className="text-sm text-gray-500 mt-2">{authData.message}</p>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-6">
            {qnaQuestions.map((q, index) => (
              <div key={q.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {index + 1}. {q.question}
                  </span>
                  {qnaAnswers[q.id]?.trim() && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <input
                  type={q.type}
                  value={qnaAnswers[q.id] || ''}
                  onChange={(e) => handleQnaChange(q.id, e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder={isFirstTimeSetup ? "Set your answer" : "Enter your answer"}
                />
              </div>
            ))}

            <div className="pt-4">
              <button
                onClick={handleQnaSubmit}
                disabled={isLoading || !allQuestionsAnswered}
                className={`w-full font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${allQuestionsAnswered && !isLoading
                    ? isFirstTimeSetup
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isFirstTimeSetup ? 'Setting up...' : 'Verifying...'}
                  </>
                ) : (
                  <>
                    {isFirstTimeSetup ? (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Complete Setup
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-5 h-5" />
                        Verify Answers
                      </>
                    )}
                  </>
                )}
              </button>
            </div>

            {!allQuestionsAnswered && (
              <p className="text-sm text-gray-500 text-center">
                Please answer all questions to continue
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

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

        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Processing authentication...</p>
          </div>
        ) : (
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
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Client ID:</strong> {cognitoConfig.clientId}</p>
            <p><strong>API Gateway:</strong> {cognitoConfig.redirectUri}</p>
            <p><strong>Mode:</strong> {authMode === 'signup' ? 'Sign Up' : 'Sign In'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginSignupPage;