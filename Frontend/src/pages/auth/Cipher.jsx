import { useNavigate, useLocation } from 'react-router-dom';

function Cipher() {
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const location = useLocation();

  const result = JSON.stringify(location.state.result, null, 2);

  return (
    <div>
      <div>This is cipher</div>
      <div>{result}</div>
    </div>
  );
}

export default Cipher;