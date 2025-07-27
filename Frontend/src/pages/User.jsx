import React, { useState, useEffect } from 'react';
import { Search, Calendar, Clock, MapPin, Battery, Star, Filter, X, Plus, Edit, Trash2, Eye, Car, Bike, AlertCircle, MessageSquare, ThumbsUp, ThumbsDown, Send } from 'lucide-react';
import { redirectBaseUri } from '../contants/constants'; 

const User = () => {
  const [activeTab, setActiveTab] = useState('browse');
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    location: '',
    maxRate: '',
    showFilters: false
  });
  const [reservationForm, setReservationForm] = useState({
    startDate: '',
    endDate: '',
    discountCode: '',
    notes: ''
  });
  const [feedbackForm, setFeedbackForm] = useState({
    reservationId: '',
    vehicleId: '',
    rating: 0,
    vehicleCondition: '',
    serviceQuality: '',
    overallExperience: '',
    suggestions: '',
    wouldRecommend: null,
    category: 'general' // general, vehicle, service, app
  });

  // API Configuration
  const API_BASE_URL = `${redirectBaseUri}/dev`;
  const JWT_TOKEN = sessionStorage.getItem('jwt');

  const apiHeaders = {
    'Content-Type': 'application/json',
    'Authorization': JWT_TOKEN ? `Bearer ${JWT_TOKEN}` : ''
  };

  // Load data on component mount and tab changes
  useEffect(() => {
    if (activeTab === 'browse') {
      loadVehicles();
    } else if (activeTab === 'reservations') {
      loadReservations();
    } else if (activeTab === 'feedback') {
      loadFeedback();
    }
  }, [activeTab]);

  // Load available vehicles from API
  const loadVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.maxRate) queryParams.append('maxRate', filters.maxRate);
      
      const url = `${API_BASE_URL}/user/vehicles${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: apiHeaders
      });

      if (!response.ok) {
        throw new Error(`Failed to load vehicles: ${response.statusText}`);
      }

      const data = await response.json();
      setVehicles(data.vehicles || []);
    } catch (err) {
      console.error('Error loading vehicles:', err);
      setError('Failed to load available vehicles. Please try again.');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  // Load user reservations from API
  const loadReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/user/reservations`, {
        method: 'GET',
        headers: apiHeaders
      });

      if (!response.ok) {
        throw new Error(`Failed to load reservations: ${response.statusText}`);
      }

      const data = await response.json();
      setReservations(data.reservations || []);
    } catch (err) {
      console.error('Error loading reservations:', err);
      setError('Failed to load reservations. Please try again.');
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  // Load user feedback from API
  const loadFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/user/feedback`, {
        method: 'GET',
        headers: apiHeaders
      });

      if (!response.ok) {
        throw new Error(`Failed to load feedback: ${response.statusText}`);
      }

      const data = await response.json();
      setFeedback(data.feedback || []);
    } catch (err) {
      console.error('Error loading feedback:', err);
      setError('Failed to load feedback. Please try again.');
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  };

  // Create new reservation via API
  const createReservation = async (reservationData) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/reservations`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(reservationData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to create reservation: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error creating reservation:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Submit feedback via API
  const submitFeedback = async (feedbackData) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/feedback`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(feedbackData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to submit feedback: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error submitting feedback:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Cancel reservation via API
  const cancelReservationAPI = async (reservationId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: apiHeaders
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to cancel reservation: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error cancelling reservation:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and reload vehicles
  useEffect(() => {
    if (activeTab === 'browse') {
      loadVehicles();
    }
  }, [filters.type, filters.location, filters.maxRate]);

  const getVehicleIcon = (type) => {
    switch (type) {
      case 'anebike':
        return <Bike className="w-6 h-6" />;
      case 'gyroscooter':
      case 'segway':
        return <Car className="w-6 h-6" />;
      default:
        return <Car className="w-6 h-6" />;
    }
  };

  const getBatteryColor = (batteryLife) => {
    if (batteryLife >= 80) return 'text-green-500';
    if (batteryLife >= 60) return 'text-yellow-500';
    if (batteryLife >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'active':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return 'text-green-500';
    if (rating >= 3) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const hours = Math.ceil((end - start) / (1000 * 60 * 60));
    return hours;
  };

  const calculateCost = (vehicle, startDate, endDate, discountCode) => {
    const hours = calculateDuration(startDate, endDate);
    let total = hours * vehicle.hourlyRate;
    
    if (discountCode && discountCode.toUpperCase() === vehicle.discountCode && vehicle.discountPercentage > 0) {
      const discount = total * (vehicle.discountPercentage / 100);
      total -= discount;
    }
    
    return { hours, total: Math.round(total * 100) / 100 };
  };

  const handleReserveClick = (vehicle) => {
    setSelectedVehicle(vehicle);
    setReservationForm({
      startDate: '',
      endDate: '',
      discountCode: '',
      notes: ''
    });
    setShowReservationModal(true);
  };

  const handleFeedbackClick = (reservation = null) => {
    setSelectedReservation(reservation);
    setFeedbackForm({
      reservationId: reservation?.reservationId || '',
      vehicleId: reservation?.vehicleId || '',
      rating: 0,
      vehicleCondition: '',
      serviceQuality: '',
      overallExperience: '',
      suggestions: '',
      wouldRecommend: null,
      category: 'general'
    });
    setShowFeedbackModal(true);
  };

  const handleReservationSubmit = async () => {
    if (!reservationForm.startDate || !reservationForm.endDate) {
      alert('Please select both start and end dates');
      return;
    }

    const startDate = new Date(reservationForm.startDate);
    const endDate = new Date(reservationForm.endDate);
    
    if (startDate >= endDate) {
      alert('End date must be after start date');
      return;
    }

    if (startDate < new Date()) {
      alert('Start date cannot be in the past');
      return;
    }

    try {
      const reservationData = {
        vehicleId: selectedVehicle.vehicleId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        discountCode: reservationForm.discountCode || undefined,
        notes: reservationForm.notes || undefined
      };
      
      const result = await createReservation(reservationData);
      
      if (result.success) {
        setShowReservationModal(false);
        setActiveTab('reservations');
        alert('Reservation created successfully!');
      } else {
        throw new Error(result.message || 'Failed to create reservation');
      }
    } catch (err) {
      alert(`Error creating reservation: ${err.message}`);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (feedbackForm.rating === 0) {
      alert('Please provide a rating');
      return;
    }

    if (!feedbackForm.overallExperience.trim()) {
      alert('Please share your overall experience');
      return;
    }

    try {
      const result = await submitFeedback(feedbackForm);
      
      if (result.success) {
        setShowFeedbackModal(false);
        setActiveTab('feedback');
        alert('Feedback submitted successfully! Thank you for sharing your experience.');
      } else {
        throw new Error(result.message || 'Failed to submit feedback');
      }
    } catch (err) {
      alert(`Error submitting feedback: ${err.message}`);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    if (confirm('Are you sure you want to cancel this reservation?')) {
      try {
        const result = await cancelReservationAPI(reservationId);
        
        if (result.success) {
          await loadReservations();
          alert('Reservation cancelled successfully');
        } else {
          throw new Error(result.message || 'Failed to cancel reservation');
        }
      } catch (err) {
        alert(`Error cancelling reservation: ${err.message}`);
      }
    }
  };

  const StarRating = ({ rating, onRatingChange, readonly = false }) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => !readonly && onRatingChange && onRatingChange(star)}
            className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
            disabled={readonly}
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Car className="w-8 h-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">Dalscooter</h1>
              </div>
            </div>
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('browse')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'browse'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Browse Vehicles
              </button>
              <button
                onClick={() => setActiveTab('reservations')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'reservations'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                My Reservations
              </button>
              <button
                onClick={() => setActiveTab('feedback')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'feedback'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Feedback
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        )}

        {activeTab === 'browse' && !loading && (
          <div>
            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Find Your Ride</h2>
                <button
                  onClick={() => setFilters({...filters, showFilters: !filters.showFilters})}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </button>
              </div>

              {filters.showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters({...filters, type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Types</option>
                      <option value="anebike">E-Bike</option>
                      <option value="gyroscooter">Gyro Scooter</option>
                      <option value="segway">Segway</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={filters.location}
                      onChange={(e) => setFilters({...filters, location: e.target.value})}
                      placeholder="Search location..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Rate ($/hour)</label>
                    <input
                      type="number"
                      value={filters.maxRate}
                      onChange={(e) => setFilters({...filters, maxRate: e.target.value})}
                      placeholder="Enter max rate..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map((vehicle) => (
                <div key={vehicle.vehicleId} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {getVehicleIcon(vehicle.vehicleType)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{vehicle.model}</h3>
                          <p className="text-sm text-gray-500 capitalize">{vehicle.vehicleType.replace('anebike', 'E-Bike')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">${vehicle.hourlyRate}</p>
                        <p className="text-sm text-gray-500">per hour</p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {vehicle.location && (
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{vehicle.location}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Battery className={`w-4 h-4 ${getBatteryColor(vehicle.batteryLife)}`} />
                        <span className="text-sm text-gray-600">{vehicle.batteryLife}% battery</span>
                      </div>
                    </div>

                    {vehicle.discountCode && vehicle.discountPercentage > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center space-x-2">
                          <Star className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">
                            {vehicle.discountPercentage}% off with code "{vehicle.discountCode}"
                          </span>
                        </div>
                      </div>
                    )}

                    {vehicle.features && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {Object.entries(vehicle.features).filter(([key, value]) => value).map(([feature, _]) => (
                          <div key={feature} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                            {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => handleReserveClick(vehicle)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : 'Reserve Now'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {vehicles.length === 0 && !loading && (
              <div className="text-center py-12">
                <Car className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles available</h3>
                <p className="text-gray-600">No vehicles match your current filters, or none are available right now.</p>
                <button
                  onClick={() => setFilters({ type: '', location: '', maxRate: '', showFilters: false })}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reservations' && !loading && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Reservations</h2>
              <button
                onClick={loadReservations}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>

            {reservations.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No reservations yet</h3>
                <p className="text-gray-600 mb-4">Start by browsing available vehicles and make your first reservation.</p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Browse Vehicles
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {reservations.map((reservation) => (
                  <div key={reservation.reservationId} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {getVehicleIcon(reservation.vehicleType)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{reservation.vehicleModel}</h3>
                          <p className="text-sm text-gray-500 capitalize">
                            {reservation.vehicleType.replace('anebike', 'E-Bike')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(reservation.status)}`}>
                          {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                        </span>
                        {reservation.status === 'completed' && (
                          <button
                            onClick={() => handleFeedbackClick(reservation)}
                            className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-sm">Feedback</span>
                          </button>
                        )}
                        {reservation.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancelReservation(reservation.reservationId)}
                            className="text-red-600 hover:text-red-800"
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                        <p className="text-sm text-gray-900">{formatDate(reservation.startDate)}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                        <p className="text-sm text-gray-900">{formatDate(reservation.endDate)}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                        <p className="text-sm text-gray-900">{reservation.durationHours} hours</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">
                          ${reservation.hourlyRate}/hour
                        </span>
                        {reservation.discountPercentage > 0 && (
                          <span className="text-sm text-green-600 font-medium">
                            {reservation.discountPercentage}% discount applied
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">${reservation.totalCost}</p>
                        <p className="text-xs text-gray-500">Total cost</p>
                      </div>
                    </div>

                    {reservation.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Notes:</span> {reservation.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'feedback' && !loading && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Feedback</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleFeedbackClick()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Feedback</span>
                </button>
                <button
                  onClick={loadFeedback}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>

            {feedback.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback submitted yet</h3>
                <p className="text-gray-600 mb-4">Share your experience with DALScooter to help us improve our service.</p>
                <button
                  onClick={() => handleFeedbackClick()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Submit Feedback</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {feedback.map((item) => (
                  <div key={item.feedbackId} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <MessageSquare className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {item.vehicleModel ? `${item.vehicleModel} Feedback` : 'General Feedback'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {formatDate(item.createdAt)} • {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <StarRating rating={item.rating} readonly />
                        <span className={`text-sm font-medium ${getRatingColor(item.rating)}`}>
                          {item.rating}/5
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {item.vehicleCondition && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Vehicle Condition</label>
                          <p className="text-sm text-gray-900">{item.vehicleCondition}</p>
                        </div>
                      )}
                      {item.serviceQuality && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Service Quality</label>
                          <p className="text-sm text-gray-900">{item.serviceQuality}</p>
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Overall Experience</label>
                      <p className="text-sm text-gray-900">{item.overallExperience}</p>
                    </div>

                    {item.suggestions && (
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Suggestions</label>
                        <p className="text-sm text-gray-900">{item.suggestions}</p>
                      </div>
                    )}

                    {item.wouldRecommend !== null && (
                      <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                        <span className="text-sm text-gray-600">Would recommend:</span>
                        {item.wouldRecommend ? (
                          <div className="flex items-center space-x-1 text-green-600">
                            <ThumbsUp className="w-4 h-4" />
                            <span className="text-sm font-medium">Yes</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 text-red-600">
                            <ThumbsDown className="w-4 h-4" />
                            <span className="text-sm font-medium">No</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Reservation Modal */}
      {showReservationModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Reserve Vehicle</h3>
                <button
                  onClick={() => setShowReservationModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {getVehicleIcon(selectedVehicle.vehicleType)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{selectedVehicle.model}</h4>
                    <p className="text-sm text-gray-500">${selectedVehicle.hourlyRate}/hour</p>
                  </div>
                </div>
                {selectedVehicle.discountCode && selectedVehicle.discountPercentage > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      Use code "{selectedVehicle.discountCode}" for {selectedVehicle.discountPercentage}% off
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={reservationForm.startDate}
                    onChange={(e) => setReservationForm({...reservationForm, startDate: e.target.value})}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={reservationForm.endDate}
                    onChange={(e) => setReservationForm({...reservationForm, endDate: e.target.value})}
                    min={reservationForm.startDate || new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Code (Optional)</label>
                  <input
                    type="text"
                    value={reservationForm.discountCode}
                    onChange={(e) => setReservationForm({...reservationForm, discountCode: e.target.value})}
                    placeholder="Enter discount code..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={reservationForm.notes}
                    onChange={(e) => setReservationForm({...reservationForm, notes: e.target.value})}
                    rows={3}
                    placeholder="Any special requirements or notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {reservationForm.startDate && reservationForm.endDate && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-800">Estimated Cost:</span>
                      <span className="text-lg font-bold text-blue-900">
                        ${calculateCost(selectedVehicle, reservationForm.startDate, reservationForm.endDate, reservationForm.discountCode).total}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {calculateCost(selectedVehicle, reservationForm.startDate, reservationForm.endDate, reservationForm.discountCode).hours} hours
                    </p>
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowReservationModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReservationSubmit}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Confirm Reservation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Share Your Feedback</h3>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {selectedReservation && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {getVehicleIcon(selectedReservation.vehicleType)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{selectedReservation.vehicleModel}</h4>
                      <p className="text-sm text-gray-600">{formatDate(selectedReservation.startDate)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overall Rating *</label>
                  <div className="flex items-center space-x-2">
                    <StarRating 
                      rating={feedbackForm.rating} 
                      onRatingChange={(rating) => setFeedbackForm({...feedbackForm, rating})}
                    />
                    <span className="text-sm text-gray-600 ml-2">
                      {feedbackForm.rating === 0 ? 'Select rating' : `${feedbackForm.rating}/5`}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Feedback Category</label>
                  <select
                    value={feedbackForm.category}
                    onChange={(e) => setFeedbackForm({...feedbackForm, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="general">General</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="service">Service</option>
                    <option value="app">App Experience</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Condition</label>
                  <select
                    value={feedbackForm.vehicleCondition}
                    onChange={(e) => setFeedbackForm({...feedbackForm, vehicleCondition: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select condition...</option>
                    <option value="excellent">Excellent - Like new</option>
                    <option value="good">Good - Minor wear</option>
                    <option value="fair">Fair - Some issues but functional</option>
                    <option value="poor">Poor - Needs maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service Quality</label>
                  <select
                    value={feedbackForm.serviceQuality}
                    onChange={(e) => setFeedbackForm({...feedbackForm, serviceQuality: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select quality...</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="average">Average</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overall Experience *</label>
                  <textarea
                    value={feedbackForm.overallExperience}
                    onChange={(e) => setFeedbackForm({...feedbackForm, overallExperience: e.target.value})}
                    rows={4}
                    placeholder="Please describe your overall experience with our service..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Suggestions for Improvement</label>
                  <textarea
                    value={feedbackForm.suggestions}
                    onChange={(e) => setFeedbackForm({...feedbackForm, suggestions: e.target.value})}
                    rows={3}
                    placeholder="How can we improve our service? (Optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Would you recommend DALScooter?</label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setFeedbackForm({...feedbackForm, wouldRecommend: true})}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-md border transition-colors ${
                        feedbackForm.wouldRecommend === true
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>Yes</span>
                    </button>
                    <button
                      onClick={() => setFeedbackForm({...feedbackForm, wouldRecommend: false})}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-md border transition-colors ${
                        feedbackForm.wouldRecommend === false
                          ? 'bg-red-100 border-red-300 text-red-800'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span>No</span>
                    </button>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFeedbackSubmit}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                    disabled={loading}
                  >
                    <Send className="w-4 h-4" />
                    <span>{loading ? 'Submitting...' : 'Submit Feedback'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default User;