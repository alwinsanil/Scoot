import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, Lock } from 'lucide-react';
import {redirectBaseUri} from '../../contants/constants';

function Cipher() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    tempToken,
    cipherChallenge,
    cipherShift,
  } = location.state.result || {};

  console.log(location.state.result);

  const [cipherResponse, setCipherResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${redirectBaseUri}/dev/auth/cipher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempToken,
          cipherResponse: cipherResponse.trim(),
        }),
      });

      const data = await response.json();
      console.log(data);
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setIsValid(true);
      // Proceed to next step or show success
      setTimeout(() => {
        navigate('/', { state: data });
      }, 1000);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">
        Cipher Challenge
      </h2>

      <div>
        <div className="flex flex-col items-center gap-2 mb-2">
          <div>
          <span className="text-sm font-medium text-gray-700">
            Challenge: {' '}
            <span className="ml-2 font-mono bg-gray-100 px-2 py-1 rounded text-blue-700">
              {cipherChallenge}
            </span>
          </span>
          {cipherResponse.trim() && isValid && (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
          </div>
          <div>
          <span className="text-sm font-medium text-gray-700">
            Shift: {' '}
            <span className="ml-2 font-mono bg-gray-100 px-2 py-1 rounded text-blue-700">
              {cipherShift}
            </span>
            {cipherResponse.trim() && isValid && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
          </span>
          </div>
        </div>
        <input
          type="text"
          value={cipherResponse}
          onChange={(e) => setCipherResponse(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          placeholder="Enter the decoded word"
        />
        {errorMessage && (
          <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
        )}
      </div>

      <div className="pt-4">
        <button
          onClick={handleSubmit}
          disabled={isLoading || !cipherResponse.trim()}
          className={`w-full font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
            cipherResponse.trim() && !isLoading
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Lock className="w-5 h-5" />
              Decode and Continue
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default Cipher;