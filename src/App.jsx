import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Auth from './pages/auth/Auth';
import Cipher from './pages/auth/Cipher';
import QnA from './pages/auth/QnA';
import Owner from './pages/Owner';
import User from './pages/User';
import FeedbackSentimentDisplay from './pages/Feedback';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import ChatBot from './pages/ChatBot'; 

function App() {
  return (
    <BrowserRouter>
      {/* All Routes */}
      <Routes>
        <Route path="/" element={<User />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/qna/callback" element={<QnA />} />
        <Route path="/owner" element={<Owner />} />
        <Route path="/feedback" element={<FeedbackSentimentDisplay />} />
        <Route path="/auth/cipher/callback" element={<Cipher />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
      </Routes>

      {/* ✅ Floating ChatBot available on all pages */}
      <ChatBot />
    </BrowserRouter>
  );
}

export default App;
