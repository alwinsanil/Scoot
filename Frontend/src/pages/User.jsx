import React, { useState, useEffect } from 'react';
import { Search, Calendar, Clock, MapPin, Battery, Star, Filter, X, Plus, Edit, Trash2, Eye, Car, Bike, AlertCircle, MessageSquare, ThumbsUp, ThumbsDown, Send, CheckCircle, ChevronDown, ChevronUp, Users, BarChart3, LogIn, LogOut } from 'lucide-react';
import { redirectBaseUri, cognitoConfig } from '../contants/constants';

const User = () => {
  // State management
  const [activeTab, setActiveTab] = useState('browse');
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackAnalytics, setFeedbackAnalytics] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    sentiment: '',
    rating: '',
    severity: '',
    vehicleId: ''
  });

  // Modal states
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showFeedbackAnalyticsModal, setShowFeedbackAnalyticsModal] = useState(false);

  // Selected items
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [expandedVehicles, setExpandedVehicles] = useState({});

  // Form states
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
    rating: 5,
    category: 'overall',
    subject: '',
    message: '',
    wouldRecommend: true,
    issues: []
  });

  // API Configuration
  const API_BASE_URL = `${redirectBaseUri}/dev`;

  const getApiHeaders = (requireAuth = false) => {
    const headers = { 'Content-Type': 'application/json' };
    if (requireAuth) {
      const token = sessionStorage.getItem('jwt');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Check authentication on mount
  useEffect(() => {
    const isAuth = !!sessionStorage.getItem('jwt');
    setIsAuthenticated(isAuth);
    if (isAuth) {
      checkUserRole();
    }
  }, []);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'browse') loadVehicles();
    else if (activeTab === 'reservations' && isAuthenticated) loadReservations();
    else if (activeTab === 'feedback' && isAuthenticated) loadFeedback();
  }, [activeTab, isAuthenticated]);

  // Load vehicles when filters change
  useEffect(() => {
    if (activeTab === 'browse') loadVehicles();
  }, [filters.type, filters.location, filters.maxRate]);

  useEffect(() => {
    if (showFeedbackAnalyticsModal) {
      loadFeedbackAnalytics();
    }
  }, [showFeedbackAnalyticsModal, analyticsFilters]);

  // API Functions

  const checkUserRole = () => {
    const token = sessionStorage.getItem('jwt');
    if (token) {
      try {
        // Decode JWT to get role (assuming it's in the payload)
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || payload['cognito:groups']?.[0] || null);
        console.log('User role:', payload.role || payload['cognito:groups']?.[0] || null);
      } catch (error) {
        console.error('Error decoding token:', error);
        setUserRole(null);
      }
    } else {
      setUserRole(null);
    }
  };

  const loadVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.location) params.append('location', filters.location);
      if (filters.maxRate) params.append('maxRate', filters.maxRate);
      params.append('includeReviews', 'true');

      const response = await fetch(`${API_BASE_URL}/guest/vehicles?${params}`, {
        headers: getApiHeaders(false)
      });

      if (!response.ok) throw new Error('Failed to load vehicles');
      const data = await response.json();
      setVehicles(data.vehicles || []);
    } catch (err) {
      setError('Failed to load vehicles. Please try again.');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReservations = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/reservations`, {
        headers: getApiHeaders(true)
      });
      if (!response.ok) throw new Error('Failed to load reservations');
      const data = await response.json();
      setReservations(data.reservations || []);
    } catch (err) {
      setError('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const loadFeedback = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/feedback`, {
        headers: getApiHeaders(true)
      });
      if (!response.ok) throw new Error('Failed to load feedback');
      const data = await response.json();
      setFeedback(data.feedback || []);
    } catch (err) {
      setError('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };



  const createReservation = async (reservationData) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/reservations`, {
        method: 'POST',
        headers: getApiHeaders(true),
        body: JSON.stringify(reservationData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create reservation');
      }
      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (feedbackData) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/feedback`, {
        method: 'POST',
        headers: getApiHeaders(true),
        body: JSON.stringify(feedbackData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit feedback');
      }
      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  const cancelReservation = async (reservationId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: getApiHeaders(true)
      });
      if (!response.ok) throw new Error('Failed to cancel reservation');
      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  const completeReservation = async (reservationId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/reservations/${reservationId}`, {
        method: 'PUT',
        headers: getApiHeaders(true),
        body: JSON.stringify({ action: 'complete' })
      });
      if (!response.ok) throw new Error('Failed to complete reservation');
      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbackAnalytics = async () => {
    try {
      setAnalyticsLoading(true);

      const queryParams = new URLSearchParams();
      Object.entries(analyticsFilters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/guest/feedback?${queryParams.toString()}`);
      const data = await response.json();
      console.log('Feedback data:', data);
      setFeedbackAnalytics(data.feedback || []);
      setAnalyticsData(data.analytics || null);
    } catch (error) {
      console.error('Error loading feedback analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const deleteFeedback = async (feedbackId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/feedback/${feedbackId}`, {
        method: 'DELETE',
        headers: getApiHeaders(true)
      });
      if (!response.ok) throw new Error('Failed to delete feedback');
      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  // Event Handlers
  const handleLogin = () => window.location.href = '/auth';

  const handleLogout = () => {
    // Clear any stored tokens/session data
    sessionStorage.clear();
    localStorage.clear();
    setUserRole(null);

    // Redirect to Cognito logout
    const logoutUrl = `${cognitoConfig.logoutUrl}?client_id=${cognitoConfig.clientId}&logout_uri=${encodeURIComponent(window.location.origin)}`;
    window.location.href = logoutUrl;
  };

  const handleReserveClick = (vehicle) => {
    if (!isAuthenticated) {
      alert('Please sign in to make a reservation');
      handleLogin();
      return;
    }
    setSelectedVehicle(vehicle);
    setReservationForm({ startDate: '', endDate: '', discountCode: '', notes: '' });
    setShowReservationModal(true);
  };

  const handleViewReviewsClick = async (vehicle) => {
    // Reset filters and open feedback analytics modal
    setAnalyticsFilters({
      sentiment: '',
      rating: '',
      severity: '',
      vehicleId: vehicle.vehicleId
    });
    setShowFeedbackAnalyticsModal(true);
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
      const result = await createReservation({
        vehicleId: selectedVehicle.vehicleId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        discountCode: reservationForm.discountCode || undefined,
        notes: reservationForm.notes || undefined
      });

      if (result.success) {
        setShowReservationModal(false);
        setActiveTab('reservations');
        alert('Reservation created successfully!');
      }
    } catch (err) {
      alert(`Error creating reservation: ${err.message}`);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackForm.subject.trim() || !feedbackForm.message.trim()) {
      alert('Please provide both subject and message');
      return;
    }

    try {
      const result = await submitFeedback({
        reservationId: selectedReservation.reservationId,
        vehicleId: selectedReservation.vehicleId,
        vehicleType: selectedReservation.vehicleType,
        vehicleModel: selectedReservation.vehicleModel,
        rating: feedbackForm.rating,
        category: feedbackForm.category,
        subject: feedbackForm.subject.trim(),
        message: feedbackForm.message.trim(),
        wouldRecommend: feedbackForm.wouldRecommend,
        issues: feedbackForm.issues
      });

      if (result.success) {
        setShowFeedbackModal(false);
        setActiveTab('feedback');
        alert('Feedback submitted successfully!');
        loadFeedback();
      }
    } catch (err) {
      alert(`Error submitting feedback: ${err.message}`);
    }
  };

  // Utility Functions
  const getVehicleIcon = (type) => {
    return type === 'anebike' ? <Bike className="w-6 h-6" /> : <Car className="w-6 h-6" />;
  };

  const getBatteryColor = (level) => {
    if (level >= 80) return 'text-green-500';
    if (level >= 60) return 'text-yellow-500';
    if (level >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getStatusColor = (status) => {
    const colors = {
      confirmed: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      active: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const calculateCost = (vehicle, startDate, endDate, discountCode) => {
    const hours = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60));
    let total = hours * vehicle.hourlyRate;

    if (discountCode?.toUpperCase() === vehicle.discountCode && vehicle.discountPercentage > 0) {
      total -= total * (vehicle.discountPercentage / 100);
    }

    return { hours, total: Math.round(total * 100) / 100 };
  };

  const renderStars = (rating, interactive = false, onChange = null) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-5 h-5 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'} 
              ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
            onClick={interactive ? () => onChange(star) : undefined}
          />
        ))}
      </div>
    );
  };

  const renderReviewSummary = (summary) => {
    if (!summary?.totalReviews) {
      return <div className="bg-gray-50 rounded-lg p-3 text-center text-sm text-gray-500">No reviews yet</div>;
    }

    return (
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {renderStars(Math.round(summary.averageRating))}
            <span className="font-medium">{summary.averageRating}</span>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-600">{summary.totalReviews} reviews</p>
            <p className="text-green-600">{summary.recommendationPercentage}% recommend</p>
          </div>
        </div>

        {summary.commonIssues?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Common mentions:</p>
            <div className="flex flex-wrap gap-1">
              {summary.commonIssues.slice(0, 3).map((issue, idx) => (
                <span key={idx} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                  {issue.issue} ({issue.count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getCompletedReservationsForFeedback = () => {
    const completed = reservations.filter(r => r.status === 'completed');
    const feedbackIds = feedback.map(f => f.reservationId);
    return completed.filter(r => !feedbackIds.includes(r.reservationId));
  };

  const getSentimentBadge = (sentiment) => {
    const colors = {
      'POSITIVE': 'bg-green-100 text-green-800 border-green-300',
      'NEGATIVE': 'bg-red-100 text-red-800 border-red-300',
      'NEUTRAL': 'bg-gray-100 text-gray-800 border-gray-300',
      'MIXED': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    };
    return colors[sentiment] || 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      'HIGH': 'bg-red-100 text-red-700 border-red-300',
      'MEDIUM': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'LOW': 'bg-green-100 text-green-700 border-green-300',
    };
    return colors[severity] || 'bg-gray-100 text-gray-600 border-gray-200';
  };

  // Component Constants
  const feedbackCategories = [
    { value: 'overall', label: 'Overall Experience' },
    { value: 'vehicle_condition', label: 'Vehicle Condition' },
    { value: 'battery_performance', label: 'Battery Performance' },
    { value: 'comfort', label: 'Comfort & Ergonomics' },
    { value: 'safety', label: 'Safety Features' },
    { value: 'booking_process', label: 'Booking Process' },
    { value: 'customer_service', label: 'Customer Service' }
  ];

  const commonIssues = [
    'Battery died quickly', 'Vehicle was dirty', 'Mechanical problems',
    'Uncomfortable ride', 'Poor GPS tracking', 'Difficulty finding vehicle',
    'Charging issues', 'App problems'
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Car className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Dalscooter</h1>
            </div>

            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('browse')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'browse' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Browse Vehicles
              </button>

              {isAuthenticated && (
                <>
                  <button
                    onClick={() => setActiveTab('reservations')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'reservations' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    My Reservations
                  </button>
                  <button
                    onClick={() => setActiveTab('feedback')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'feedback' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Feedback
                  </button>

                  {/* Owner-only buttons */}
                  {userRole === 'owners' && (
                    <>
                      <button
                        onClick={() => window.location.href = '/owner'}
                        className="px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-200 rounded-md hover:bg-purple-50"
                      >
                        Owner Dashboard
                      </button>
                      <button
                        onClick={() => window.location.href = '/analytics'}
                        className="px-3 py-2 text-sm font-medium text-green-600 hover:text-green-700 border border-green-200 rounded-md hover:bg-green-50"
                      >
                        Analytics
                      </button>
                    </>
                  )}
                </>
              )}

              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
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

        {/* Browse Tab */}
        {activeTab === 'browse' && !loading && (
          <div>
            {/* Auth Prompt for Guests */}
            {!isAuthenticated && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    <span className="text-blue-800">
                      <strong>Sign in to book vehicles</strong> - You can browse and read reviews without an account
                    </span>
                  </div>
                  <button
                    onClick={handleLogin}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center space-x-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Find Your Ride</h2>
                <button
                  onClick={() => setFilters({ ...filters, showFilters: !filters.showFilters })}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </button>
              </div>

              {filters.showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
                      onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                      placeholder="Search location..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Rate ($/hour)</label>
                    <input
                      type="number"
                      value={filters.maxRate}
                      onChange={(e) => setFilters({ ...filters, maxRate: e.target.value })}
                      placeholder="Enter max rate..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map(vehicle => (
                <div key={vehicle.vehicleId} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* Vehicle Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {getVehicleIcon(vehicle.vehicleType)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{vehicle.model}</h3>
                          <p className="text-sm text-gray-500 capitalize">
                            {vehicle.vehicleType.replace('anebike', 'E-Bike')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">${vehicle.hourlyRate}</p>
                        <p className="text-sm text-gray-500">per hour</p>
                      </div>
                    </div>

                    {/* Vehicle Details */}
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

                    {/* Reviews */}
                    {vehicle.reviewSummary && (
                      <div className="mb-4">
                        {renderReviewSummary(vehicle.reviewSummary)}
                        {vehicle.reviewSummary.totalReviews > 0 && (
                          <div className="mt-2 flex justify-between items-center">
                            <button
                              onClick={() => handleViewReviewsClick(vehicle)}
                              className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                            >
                              <Eye className="w-4 h-4" />
                              <span>View Reviews</span>
                            </button>
                            <button
                              onClick={() => setExpandedVehicles({ ...expandedVehicles, [vehicle.vehicleId]: !expandedVehicles[vehicle.vehicleId] })}
                              className="text-sm text-gray-600 hover:text-gray-700 flex items-center space-x-1"
                            >
                              {expandedVehicles[vehicle.vehicleId] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              <span>{expandedVehicles[vehicle.vehicleId] ? 'Less' : 'Details'}</span>
                            </button>
                          </div>
                        )}

                        {/* Expanded Details */}
                        {expandedVehicles[vehicle.vehicleId] && vehicle.reviewSummary.totalReviews > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Stats</h4>
                                <div className="space-y-1 text-sm text-gray-600">
                                  <div className="flex items-center space-x-2">
                                    <Users className="w-4 h-4" />
                                    <span>{vehicle.reviewSummary.totalReviews} reviews</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <ThumbsUp className="w-4 h-4 text-green-500" />
                                    <span>{vehicle.reviewSummary.recommendationPercentage}% recommend</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Discount */}
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

                    {/* Features */}
                    {vehicle.features && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {Object.entries(vehicle.features).filter(([_, value]) => value).map(([feature]) => (
                          <div key={feature} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                            {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reserve Button */}
                    <button
                      onClick={() => handleReserveClick(vehicle)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
                    >
                      {isAuthenticated ? 'Reserve Now' : 'Sign In to Reserve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* No Vehicles */}
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

        {/* Reservations Tab */}
        {activeTab === 'reservations' && !loading && isAuthenticated && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Reservations</h2>
              <button
                onClick={loadReservations}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Browse Vehicles
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {reservations.map(reservation => (
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

                        {reservation.status === 'confirmed' && (
                          <>
                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to return this vehicle?')) {
                                  try {
                                    await completeReservation(reservation.reservationId);
                                    loadReservations();
                                    alert('Vehicle returned successfully!');
                                  } catch (err) {
                                    alert('Error returning vehicle: ' + err.message);
                                  }
                                }
                              }}
                              className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Return Vehicle</span>
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to cancel this reservation?')) {
                                  try {
                                    await cancelReservation(reservation.reservationId);
                                    loadReservations();
                                    alert('Reservation cancelled successfully');
                                  } catch (err) {
                                    alert('Error cancelling reservation: ' + err.message);
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-800"
                              title="Cancel Reservation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {reservation.status === 'completed' && !feedback.some(f => f.reservationId === reservation.reservationId) && (
                          <button
                            onClick={() => {
                              setSelectedReservation(reservation);
                              setFeedbackForm({
                                rating: 5, category: 'overall', subject: '', message: '',
                                wouldRecommend: true, issues: []
                              });
                              setShowFeedbackModal(true);
                            }}
                            className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>Leave Feedback</span>
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
                        <span className="text-sm text-gray-600">${reservation.hourlyRate}/hour</span>
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

        {/* Feedback Tab */}
        {activeTab === 'feedback' && !loading && isAuthenticated && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Feedback</h2>
              <div className="flex space-x-4">
                {getCompletedReservationsForFeedback().length > 0 && (
                  <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
                    {getCompletedReservationsForFeedback().length} rides awaiting feedback
                  </span>
                )}
                <button onClick={loadFeedback} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Refresh
                </button>
              </div>
            </div>

            {/* Pending Feedback */}
            {getCompletedReservationsForFeedback().length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold text-green-900 mb-4">
                  <MessageSquare className="w-5 h-5 inline mr-2" />
                  Completed Rides - Share Your Experience
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getCompletedReservationsForFeedback().map(reservation => (
                    <div key={reservation.reservationId} className="bg-white rounded-lg border p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {getVehicleIcon(reservation.vehicleType)}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{reservation.vehicleModel}</h4>
                          <p className="text-sm text-gray-500">{formatDate(reservation.endDate)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedReservation(reservation);
                          setShowFeedbackModal(true);
                        }}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-sm font-medium"
                      >
                        Leave Feedback
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submitted Feedback */}
            {feedback.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback submitted yet</h3>
                <p className="text-gray-600 mb-4">Complete a ride to share your experience and help us improve our service.</p>
                {getCompletedReservationsForFeedback().length === 0 && (
                  <button
                    onClick={() => setActiveTab('browse')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Browse Vehicles
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {feedback.map(item => (
                  <div key={item.feedbackId} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {getVehicleIcon(item.vehicleType)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{item.vehicleModel}</h3>
                          <p className="text-sm text-gray-500 capitalize">
                            {item.vehicleType.replace('anebike', 'E-Bike')}
                          </p>
                          <p className="text-xs text-gray-400">Submitted on {formatDate(item.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2 mb-2">
                          {renderStars(item.rating)}
                          <span className="text-sm font-medium">{item.rating}/5</span>
                          <button
                            onClick={async () => {
                              if (confirm('Are you sure you want to delete this feedback?')) {
                                try {
                                  await deleteFeedback(item.feedbackId);
                                  loadFeedback();
                                  alert('Feedback deleted successfully');
                                } catch (err) {
                                  alert('Error deleting feedback: ' + err.message);
                                }
                              }
                            }}
                            className="text-red-600 hover:text-red-800 ml-2"
                            title="Delete Feedback"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          {feedbackCategories.find(cat => cat.value === item.category)?.label || item.category}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Subject</h4>
                        <p className="text-sm text-gray-700">{item.subject}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Feedback</h4>
                        <p className="text-sm text-gray-700">{item.message}</p>
                      </div>

                      {item.issues?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Issues Reported</h4>
                          <div className="flex flex-wrap gap-2">
                            {item.issues.map((issue, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                {issue}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-4 pt-2 border-t border-gray-100">
                        <div className="flex items-center space-x-2">
                          {item.wouldRecommend ? (
                            <ThumbsUp className="w-4 h-4 text-green-600" />
                          ) : (
                            <ThumbsDown className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm text-gray-600">
                            {item.wouldRecommend ? 'Would recommend' : 'Would not recommend'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Auth Required Message */}
        {((activeTab === 'reservations' || activeTab === 'feedback') && !isAuthenticated) && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <LogIn className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sign in required</h3>
            <p className="text-gray-600 mb-4">
              Please sign in to access {activeTab === 'reservations' ? 'your reservations' : 'feedback management'}.
            </p>
            <button
              onClick={handleLogin}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2 mx-auto"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </main>

      {/* Reviews Modal */}
      {/* Feedback Analytics Modal */}
      {showFeedbackAnalyticsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Compact Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Customer Reviews</h3>
                <button
                  onClick={() => setShowFeedbackAnalyticsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {analyticsLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading reviews...</span>
                </div>
              ) : (
                <>
                  {/* Quick Stats Bar */}
                  {analyticsData && (
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-900">{analyticsData.totalAnalyzed}</p>
                          <p className="text-xs text-gray-600">Total Reviews</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {analyticsData.sentimentDistribution?.percentages?.POSITIVE || 0}%
                          </p>
                          <p className="text-xs text-gray-600">Positive</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600">
                            {analyticsData.sentimentDistribution?.percentages?.NEGATIVE || 0}%
                          </p>
                          <p className="text-xs text-gray-600">Negative</p>
                        </div>
                      </div>

                      {/* Compact Filters */}
                      <div className="flex items-center space-x-3">
                        <select
                          value={analyticsFilters.sentiment}
                          onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, sentiment: e.target.value })}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="">All Sentiments</option>
                          <option value="POSITIVE">Positive</option>
                          <option value="NEGATIVE">Negative</option>
                          <option value="NEUTRAL">Neutral</option>
                        </select>

                        <select
                          value={analyticsFilters.rating}
                          onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, rating: e.target.value })}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="">All Ratings</option>
                          <option value="5">5 Stars</option>
                          <option value="4">4 Stars</option>
                          <option value="3">3 Stars</option>
                          <option value="2">2 Stars</option>
                          <option value="1">1 Star</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Reviews List - Main Focus */}
                  <div className="space-y-4">
                    {feedbackAnalytics.map((item) => (
                      <div key={item.feedbackId} className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow">
                        {/* Review Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 text-lg mb-1">{item.subject}</h4>
                            <div className="flex items-center space-x-3 text-sm text-gray-600">
                              <span>{item.vehicleType} - {item.vehicleModel}</span>
                              <span>•</span>
                              <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex text-yellow-400 text-lg">
                              {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                            </div>
                            <span className="text-sm font-medium text-gray-700">({item.rating}/5)</span>
                          </div>
                        </div>

                        {/* Review Message */}
                        <div className="mb-4">
                          <p className="text-gray-800 leading-relaxed">{item.message}</p>
                        </div>

                        {/* Compact Sentiment Info */}
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">Sentiment:</span>
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getSentimentBadge(item.sentimentAnalysis?.sentiment)}`}>
                                {item.sentimentAnalysis?.sentiment || 'UNKNOWN'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            {item.sentimentAnalysis?.severity && (
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityBadge(item.sentimentAnalysis.severity)}`}>
                                {item.sentimentAnalysis.severity} Priority
                              </span>
                            )}

                            <div className="flex items-center space-x-1">
                              {item.wouldRecommend ? (
                                <ThumbsUp className="w-4 h-4 text-green-600" />
                              ) : (
                                <ThumbsDown className="w-4 h-4 text-red-600" />
                              )}
                              <span className="text-xs text-gray-600">
                                {item.wouldRecommend ? 'Recommends' : 'Not recommended'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Issues (if any) */}
                        {(item.issues || []).length > 0 && (
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-2">
                              {item.issues.slice(0, 3).map((issue, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 text-xs bg-red-50 text-red-700 rounded">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  {issue}
                                </span>
                              ))}
                              {item.issues.length > 3 && (
                                <span className="text-xs text-gray-500">+{item.issues.length - 3} more</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {feedbackAnalytics.length === 0 && (
                      <div className="text-center py-16">
                        <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h4 className="text-xl text-gray-900 mb-2">No reviews found</h4>
                        <p className="text-gray-600">Try adjusting your filters or check back later for new reviews.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reservation Modal */}
      {showReservationModal && selectedVehicle && isAuthenticated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Reserve Vehicle</h3>
                <button onClick={() => setShowReservationModal(false)} className="text-gray-400 hover:text-gray-600">
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
                {selectedVehicle.discountCode && (
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
                    onChange={(e) => setReservationForm({ ...reservationForm, startDate: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={reservationForm.endDate}
                    onChange={(e) => setReservationForm({ ...reservationForm, endDate: e.target.value })}
                    min={reservationForm.startDate || new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Code (Optional)</label>
                  <input
                    type="text"
                    value={reservationForm.discountCode}
                    onChange={(e) => setReservationForm({ ...reservationForm, discountCode: e.target.value })}
                    placeholder="Enter discount code..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={reservationForm.notes}
                    onChange={(e) => setReservationForm({ ...reservationForm, notes: e.target.value })}
                    rows={3}
                    placeholder="Any special requirements..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReservationSubmit}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
      {showFeedbackModal && selectedReservation && isAuthenticated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Share Your Experience</h3>
                <button onClick={() => setShowFeedbackModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {getVehicleIcon(selectedReservation.vehicleType)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{selectedReservation.vehicleModel}</h4>
                    <p className="text-sm text-gray-500">
                      {formatDate(selectedReservation.startDate)} - {formatDate(selectedReservation.endDate)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Overall Rating</label>
                  <div className="flex items-center space-x-3">
                    {renderStars(feedbackForm.rating, true, (rating) => setFeedbackForm({ ...feedbackForm, rating }))}
                    <span className="text-sm text-gray-600">
                      {['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][feedbackForm.rating - 1]}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={feedbackForm.category}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    {feedbackCategories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <input
                    type="text"
                    value={feedbackForm.subject}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, subject: e.target.value })}
                    placeholder="Brief summary of your experience..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Feedback</label>
                  <textarea
                    value={feedbackForm.message}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                    rows={4}
                    placeholder="Tell us about your experience..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Any Issues? (Select all that apply)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {commonIssues.map(issue => (
                      <label key={issue} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={feedbackForm.issues.includes(issue)}
                          onChange={() => {
                            const newIssues = feedbackForm.issues.includes(issue)
                              ? feedbackForm.issues.filter(i => i !== issue)
                              : [...feedbackForm.issues, issue];
                            setFeedbackForm({ ...feedbackForm, issues: newIssues });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">{issue}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Would you recommend this vehicle to others?
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="recommend"
                        checked={feedbackForm.wouldRecommend === true}
                        onChange={() => setFeedbackForm({ ...feedbackForm, wouldRecommend: true })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Yes</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="recommend"
                        checked={feedbackForm.wouldRecommend === false}
                        onChange={() => setFeedbackForm({ ...feedbackForm, wouldRecommend: false })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">No</span>
                    </label>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFeedbackSubmit}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center space-x-2"
                    disabled={loading || !feedbackForm.subject.trim() || !feedbackForm.message.trim()}
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