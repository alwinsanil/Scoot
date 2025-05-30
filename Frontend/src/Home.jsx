import { withAuthenticator } from '@aws-amplify/ui-react';

function Home({ signOut, user }) {
  return (
    <div style={styles.container}>
      <h1>Welcome to DalScooter</h1>
      {user && (
        <div style={styles.userInfo}>
          <p>Logged in as: {user.username}</p>
          <p>Email: {user.attributes?.email}</p>
          <button onClick={signOut} style={styles.button}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    textAlign: 'center'
  },
  userInfo: {
    marginTop: '20px',
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '5px'
  },
  button: {
    backgroundColor: '#ff9900',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    marginTop: '10px'
  }
};

export default withAuthenticator(Home);