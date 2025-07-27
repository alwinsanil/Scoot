import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/home/Home';
import Auth from './pages/auth/Auth';
import Cipher from './pages/auth/Cipher';
import QnA from './pages/auth/QnA';
import Owner from './pages/Owner';
import User from './pages/User';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/qna/callback" element={<QnA />} />
        <Route path="/owner" element={<Owner />} />
        <Route path="/user" element={<User />} />
        <Route path="/auth/cipher/callback" element={<Cipher />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;