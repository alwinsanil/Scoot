import React, { useEffect, useState } from 'react';
import { Auth, Hub } from 'aws-amplify';
import { useNavigate } from 'react-router-dom';

const Callback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Parse the URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`Authentication error: ${error}`);
        }

        if (code) {
          // Handle authorization code flow
          await Auth.currentAuthenticatedUser();
          console.log('User authenticated successfully');
          
          // Redirect to main app or dashboard
          navigate('/dashboard');
        } else {
          // Handle implicit flow (tokens in URL fragment)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const idToken = hashParams.get('id_token');
          
          if (accessToken && idToken) {
            // Store tokens and redirect
            navigate('/dashboard');
          } else {
            throw new Error('No authorization code or tokens found');
          }
        }
      } catch (err) {
        console.error('Authentication error:', err);
        setError(err.message);
        // Redirect to login after a delay
        setTimeout(() => navigate('/login'), 3000);
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">Authentication failed: {error}</p>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default Callback;