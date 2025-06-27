import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Auth from './pages/auth/Auth';
import Cipher from './pages/auth/Cipher';
import QnA from './pages/auth/QnA';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/qna/callback" element={<QnA />} />
        <Route path="/auth/cipher/callback" element={<Cipher />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;