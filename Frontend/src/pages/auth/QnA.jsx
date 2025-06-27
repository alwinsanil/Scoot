import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Loader2, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

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

function QnA() {
  const navigate = useNavigate();
  const location = useLocation();

  const [qnaAnswers, setQnaAnswers] = useState({});
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectBaseUri = 'https://tupiqo0472.execute-api.us-east-1.amazonaws.com';
  const authData = location.state?.authData;
  const allQuestionsAnswered = qnaQuestions.every(q => qnaAnswers[q.id]?.trim());

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
      const response = await fetch(`${redirectBaseUri}/dev/auth/qna`, {
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

      setIsFirstTimeSetup(result.isFirstTimeSetup);

      if (result.nextStep === 'cipher') {
        alert(`${result.message}\n\nNext step: ${result.nextStep}`);
        // Optionally move to next step here

        const searchParams = location.search; // e.g., ?data=abc123...
        navigate(`/auth/cipher/callback${searchParams}`, { 
          replace: true,
          state: { result: result }
        });
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

export default QnA;