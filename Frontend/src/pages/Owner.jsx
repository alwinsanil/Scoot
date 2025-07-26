import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Save, X, Battery, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { redirectBaseUri } from '../contants/constants';

const VehicleManagement = () => {
  const [vehicles, setVehicles] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // API Gateway endpoint
  const API_BASE_URL = `${redirectBaseUri}/dev/owner`;
  
  const [formData, setFormData] = useState({
    vehicleType: 'anebike',
    model: '',
    accessCode: '',
    hourlyRate: '',
    batteryLife: '',
    heightAdjustment: false,
    gpsTracking: true,
    antiTheft: true,
    ledLights: false,
    phoneHolder: false,
    bluetooth: false,
    speedModes: false,
    discountCode: '',
    discountPercentage: '',
    status: 'available',
    location: ''
  });

  const vehicleTypes = [
    { value: 'anebike', label: 'E-Bike', icon: '🚴' },
    { value: 'gyroscooter', label: 'Gyroscooter', icon: '🛴' },
    { value: 'segway', label: 'Segway', icon: '🛴' }
  ];

  // Create axios instance with interceptors
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000, // 10 second timeout
  });

  // Request interceptor to add auth token
  apiClient.interceptors.request.use(
    (config) => {
      const token = sessionStorage.getItem('jwt');
      
      console.log('Making API request:', {
        url: config.url,
        method: config.method,
        baseURL: config.baseURL,
        token: token ? `${token.substring(0, 20)}...` : 'No token'
      });

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn('No JWT token found in sessionStorage');
        showNotification('Please log in to continue', 'error');
        throw new axios.Cancel('No authentication token available');
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle auth errors
  apiClient.interceptors.response.use(
    (response) => {
      console.log('API Success:', {
        status: response.status,
        url: response.config.url,
        data: response.data
      });
      return response;
    },
    (error) => {
      console.error('API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        data: error.response?.data,
        headers: error.response?.headers
      });

      if (error.response?.status === 401) {
        console.log('401 Unauthorized - clearing session');
        sessionStorage.removeItem('jwt');
        sessionStorage.removeItem('user');
        showNotification('Session expired. Please log in again.', 'error');
        
        // Optionally redirect to login
        // window.location.href = '/login';
      }

      return Promise.reject(error);
    }
  );

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/vehicles');
      setVehicles(response.data.vehicles || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      
      if (axios.isCancel(error)) {
        console.log('Request cancelled:', error.message);
        return;
      }
      
      let errorMessage = 'Failed to load vehicles';
      if (error.response?.data?.message) {
        errorMessage += ': ' + error.response.data.message;
      } else if (error.message) {
        errorMessage += ': ' + error.message;
      }
      
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('jwt');
    console.log('Component mounted. Token check:', {
      hasToken: !!token,
      tokenStart: token?.substring(0, 20) + '...' || 'No token'
    });

    if (token) {
      loadVehicles();
    } else {
      showNotification('Please log in to access vehicle management', 'error');
    }
  }, []);

  const resetForm = () => {
    setFormData({
      vehicleType: 'anebike',
      model: '',
      accessCode: '',
      hourlyRate: '',
      batteryLife: '',
      heightAdjustment: false,
      gpsTracking: true,
      antiTheft: true,
      ledLights: false,
      phoneHolder: false,
      bluetooth: false,
      speedModes: false,
      discountCode: '',
      discountPercentage: '',
      status: 'available',
      location: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate required fields
      if (!formData.model || !formData.accessCode || !formData.hourlyRate || !formData.batteryLife) {
        throw new Error('Please fill in all required fields');
      }

      const vehicleData = {
        vehicleType: formData.vehicleType,
        model: formData.model.trim(),
        accessCode: formData.accessCode.trim().toUpperCase(),
        hourlyRate: parseFloat(formData.hourlyRate),
        batteryLife: parseInt(formData.batteryLife),
        discountCode: formData.discountCode ? formData.discountCode.trim().toUpperCase() : null,
        discountPercentage: formData.discountPercentage ? parseInt(formData.discountPercentage) : 0,
        status: formData.status,
        location: formData.location ? formData.location.trim() : null,
        features: {
          heightAdjustment: formData.heightAdjustment,
          gpsTracking: formData.gpsTracking,
          antiTheft: formData.antiTheft,
          ledLights: formData.ledLights,
          phoneHolder: formData.phoneHolder,
          bluetooth: formData.bluetooth,
          speedModes: formData.speedModes
        }
      };

      console.log('Submitting vehicle data:', vehicleData);

      let response;
      if (editingVehicle) {
        // Update existing vehicle
        response = await apiClient.put(`/vehicles/${editingVehicle.vehicleId}`, vehicleData);
        showNotification('Vehicle updated successfully!');
      } else {
        // Create new vehicle
        response = await apiClient.post('/vehicles', vehicleData);
        showNotification('Vehicle created successfully!');
      }

      resetForm();
      setShowAddForm(false);
      setEditingVehicle(null);
      await loadVehicles(); // Reload the list
      
    } catch (error) {
      console.error('Error saving vehicle:', error);
      
      if (axios.isCancel(error)) {
        return;
      }
      
      let errorMessage = 'Error saving vehicle';
      if (error.response?.data?.message) {
        errorMessage += ': ' + error.response.data.message;
      } else if (error.message) {
        errorMessage += ': ' + error.message;
      }
      
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vehicle) => {
    setFormData({
      vehicleType: vehicle.vehicleType,
      model: vehicle.model,
      accessCode: vehicle.accessCode,
      hourlyRate: vehicle.hourlyRate.toString(),
      batteryLife: vehicle.batteryLife.toString(),
      heightAdjustment: vehicle.features?.heightAdjustment || false,
      gpsTracking: vehicle.features?.gpsTracking !== false,
      antiTheft: vehicle.features?.antiTheft !== false,
      ledLights: vehicle.features?.ledLights || false,
      phoneHolder: vehicle.features?.phoneHolder || false,
      bluetooth: vehicle.features?.bluetooth || false,
      speedModes: vehicle.features?.speedModes || false,
      discountCode: vehicle.discountCode || '',
      discountPercentage: vehicle.discountPercentage ? vehicle.discountPercentage.toString() : '',
      status: vehicle.status,
      location: vehicle.location || ''
    });
    setEditingVehicle(vehicle);
    setShowAddForm(true);
  };

  const handleDelete = async (vehicleId) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      setLoading(true);
      try {
        await apiClient.delete(`/vehicles/${vehicleId}`);
        showNotification('Vehicle deleted successfully!');
        await loadVehicles(); // Reload the list
      } catch (error) {
        console.error('Error deleting vehicle:', error);
        
        let errorMessage = 'Error deleting vehicle';
        if (error.response?.data?.message) {
          errorMessage += ': ' + error.response.data.message;
        } else if (error.message) {
          errorMessage += ': ' + error.message;
        }
        
        showNotification(errorMessage, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'rented': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Debug function you can call from console
  window.debugAuth = () => {
    const token = sessionStorage.getItem('jwt');
    const user = sessionStorage.getItem('user');
    console.log('Auth Debug:', {
      token,
      user,
      apiBaseUrl: API_BASE_URL
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
            notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}>
            {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            {notification.message}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Franchise Vehicle Management</h1>
                <p className="text-gray-600 mt-1">Manage your e-bikes, gyroscooters, and segways</p>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setEditingVehicle(null);
                  setShowAddForm(true);
                }}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Plus size={20} />
                Add Vehicle
              </button>
            </div>
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingVehicle(null);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Vehicle Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type *</label>
                    <select
                      value={formData.vehicleType}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicleType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      {vehicleTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Urban Cruiser X1"
                      required
                    />
                  </div>

                  {/* Access Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Access Code *</label>
                    <input
                      type="text"
                      value={formData.accessCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, accessCode: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., BIKE001"
                      required
                    />
                  </div>

                  {/* Hourly Rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="15.00"
                      required
                    />
                  </div>

                  {/* Battery Life */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Battery Life (hours) *</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.batteryLife}
                      onChange={(e) => setFormData(prev => ({ ...prev, batteryLife: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="8"
                      required
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="available">Available</option>
                      <option value="rented">Rented</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Station A, Building 1"
                    />
                  </div>

                  {/* Discount Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Code</label>
                    <input
                      type="text"
                      value={formData.discountCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, discountCode: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., SUMMER20"
                    />
                  </div>

                  {/* Discount Percentage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.discountPercentage}
                      onChange={(e) => setFormData(prev => ({ ...prev, discountPercentage: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="20"
                    />
                  </div>
                </div>

                {/* Features */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Features</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { key: 'heightAdjustment', label: 'Height Adjustment' },
                      { key: 'gpsTracking', label: 'GPS Tracking' },
                      { key: 'antiTheft', label: 'Anti-Theft' },
                      { key: 'ledLights', label: 'LED Lights' },
                      { key: 'phoneHolder', label: 'Phone Holder' },
                      { key: 'bluetooth', label: 'Bluetooth' },
                      { key: 'speedModes', label: 'Speed Modes' }
                    ].map(feature => (
                      <label key={feature.key} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData[feature.key]}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            [feature.key]: e.target.checked 
                          }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{feature.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save size={16} />
                    {loading ? 'Saving...' : (editingVehicle ? 'Update Vehicle' : 'Add Vehicle')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Vehicle List */}
          <div className="p-6">
            {loading && vehicles.length === 0 ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading vehicles...</p>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🚴</div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No vehicles yet</h3>
                <p className="text-gray-600">Add your first vehicle to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vehicles.map(vehicle => (
                  <div key={vehicle.vehicleId} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">
                            {vehicleTypes.find(t => t.value === vehicle.vehicleType)?.icon}
                          </span>
                          <h3 className="font-semibold text-gray-900">{vehicle.model}</h3>
                        </div>
                        <p className="text-sm text-gray-600">Code: {vehicle.accessCode}</p>
                        {vehicle.location && (
                          <p className="text-sm text-gray-500">📍 {vehicle.location}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                        {vehicle.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <DollarSign size={16} />
                        <span>${vehicle.hourlyRate}/hour</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Battery size={16} />
                        <span>{vehicle.batteryLife}h battery</span>
                      </div>
                      {vehicle.discountCode && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <span className="text-green-600">🏷️</span>
                          <span>{vehicle.discountCode} ({vehicle.discountPercentage}% off)</span>
                        </div>
                      )}
                      {vehicle.totalRides > 0 && (
                        <div className="text-sm text-gray-500">
                          {vehicle.totalRides} rides • ${vehicle.totalRevenue?.toFixed(2) || '0.00'} revenue
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {vehicle.features?.heightAdjustment && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Height Adj.</span>}
                      {vehicle.features?.gpsTracking && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">GPS</span>}
                      {vehicle.features?.antiTheft && <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">Anti-Theft</span>}
                      {vehicle.features?.ledLights && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">LED</span>}
                      {vehicle.features?.phoneHolder && <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">Phone Holder</span>}
                      {vehicle.features?.bluetooth && <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded">Bluetooth</span>}
                      {vehicle.features?.speedModes && <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">Speed Modes</span>}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(vehicle)}
                        disabled={loading}
                        className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        <Edit3 size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(vehicle.vehicleId)}
                        disabled={loading || vehicle.status === 'rented'}
                        className="flex-1 bg-red-100 text-red-700 px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>

                    {vehicle.status === 'rented' && (
                      <p className="text-xs text-gray-500 mt-2 text-center">Cannot delete while rented</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleManagement;