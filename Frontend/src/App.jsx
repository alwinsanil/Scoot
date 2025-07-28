import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Auth from './pages/auth/Auth';
import Cipher from './pages/auth/Cipher';
import QnA from './pages/auth/QnA';
import Owner from './pages/Owner';
import User from './pages/User';
import FeedbackSentimentDisplay from './pages/Feedback';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<User />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/qna/callback" element={<QnA />} />
        <Route path="/owner" element={<Owner />} />
        <Route path="/feedback" element={<FeedbackSentimentDisplay />} />
        <Route path="/auth/cipher/callback" element={<Cipher />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;