import React from 'react';
import { useLocation } from 'react-router-dom';

function Home() {
  const location = useLocation();
  const data = location.state;

  // If no data passed, show error
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">No Data Available</h1>
          <p className="text-gray-600">Please authenticate first</p>
        </div>
      </div>
    );
  }
  console.log('Received data:', data.idToken);
  // Parse JWT token to extract user info
  const parseJWT = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  };

  // Extract user information from the passed data
  const accessTokenData = data?.accessToken ? parseJWT(data.accessToken) : null;
  const idTokenData = data?.idToken ? parseJWT(data.idToken) : null;

  // Determine user role
  const getUserRole = (groups) => {
    if (!groups || groups.length === 0) return 'user';
    if (groups.includes('admins')) return 'admin';
    if (groups.includes('owners')) return 'owner';
    return 'user';
  };

  const userRole = getUserRole(idTokenData?.['cognito:groups']);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to DalScooter! 🛴
          </h1>
          <p className="text-gray-600">
            {data.message}
          </p>
        </div>

        {/* User Information Card */}
        {idTokenData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              User Profile
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Name</label>
                  <p className="text-lg text-gray-900">{idTokenData.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Email</label>
                  <p className="text-lg text-gray-900">{idTokenData.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-lg text-gray-900">{idTokenData.phone_number || 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Gender</label>
                  <p className="text-lg text-gray-900 capitalize">{idTokenData.gender || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Role</label>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    userRole === 'admin' ? 'bg-red-100 text-red-800' :
                    userRole === 'owner' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {userRole.toUpperCase()}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Email Verified</label>
                  <span className={`inline-flex px-2 py-1 rounded text-sm ${
                    idTokenData.email_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {idTokenData.email_verified ? 'Verified ✓' : 'Not Verified ✗'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Role-based Actions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Available Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* User Actions */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">🚀 User Features</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Find nearby scooters</li>
                <li>• Reserve scooters</li>
                <li>• Start/end rides</li>
                <li>• View ride history</li>
                <li>• Manage profile</li>
              </ul>
            </div>

            {/* Owner Actions */}
            {userRole === 'owner' && (
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <h3 className="text-lg font-medium text-blue-900 mb-3">👑 Owner Features</h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li>• Manage scooter fleet</li>
                  <li>• Add new scooters</li>
                  <li>• View earnings</li>
                  <li>• Analytics dashboard</li>
                  <li>• Manage bookings</li>
                </ul>
              </div>
            )}

            {/* Admin Actions */}
            {userRole === 'admin' && (
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <h3 className="text-lg font-medium text-red-900 mb-3">⚡ Admin Features</h3>
                <ul className="space-y-2 text-sm text-red-700">
                  <li>• Manage all users</li>
                  <li>• System analytics</li>
                  <li>• Platform settings</li>
                  <li>• Dispute resolution</li>
                  <li>• Full system access</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Token Information (for development) */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Token Information
          </h2>
          <div className="space-y-4">
            {accessTokenData && (
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">Access Token Data</h3>
                <div className="bg-gray-100 rounded p-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div><strong>User ID:</strong> {accessTokenData.sub}</div>
                    <div><strong>Client ID:</strong> {accessTokenData.client_id}</div>
                    <div><strong>Groups:</strong> {accessTokenData['cognito:groups']?.join(', ') || 'None'}</div>
                    <div><strong>Scope:</strong> {accessTokenData.scope}</div>
                    <div><strong>Expires:</strong> {new Date(accessTokenData.exp * 1000).toLocaleString()}</div>
                    <div><strong>Issued:</strong> {new Date(accessTokenData.iat * 1000).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">🔑 Authentication Status</h4>
              <p className="text-sm text-yellow-700">
                You are successfully authenticated as <strong>{userRole}</strong>. 
                Your tokens are valid and ready to use for API calls.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 pt-4">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                View Scooters
              </button>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Start Ride
              </button>
              {userRole === 'owner' && (
                <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                  Owner Dashboard
                </button>
              )}
              <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                Profile Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;