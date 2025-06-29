import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/home/Home';
import Auth from './pages/auth/Auth';
import Cipher from './pages/auth/Cipher';
import QnA from './pages/auth/QnA';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/qna/callback" element={<QnA />} />
        <Route path="/auth/cipher/callback" element={<Cipher />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;