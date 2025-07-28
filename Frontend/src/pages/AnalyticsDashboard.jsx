import React, { useState, useEffect } from 'react';
import { redirectBaseUri } from '../contants/constants';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Activity, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Shield,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  RefreshCw,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Pie, PieChart as RechartsPieChart, Cell } from 'recharts';
import axios from 'axios';

const AnalyticsDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [lastUpdated, setLastUpdated] = useState(null);

  // API setup 
  const API_BASE_URL = `${redirectBaseUri}/dev/owner/analytics`; 
  
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
  });

  apiClient.interceptors.request.use(
    (config) => {
      const token = sessionStorage.getItem('jwt');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get(`/dashboard?period=${selectedPeriod}`);
      setDashboardData(response.data.data);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load analytics data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  const periodOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' }
  ];

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  const statusColors = ['#10B981', '#F59E0B', '#EF4444', '#6B7280'];
  const groupColors = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-sm">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Analytics</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const pieChartData = Object.entries(dashboardData.charts.usersByStatus).map(([status, count]) => ({
    name: status.replace('_', ' '),
    value: count,
    percentage: ((count / dashboardData.kpis.totalUsers) * 100).toFixed(1)
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                <p className="text-gray-600 mt-1">User statistics and login analytics for your franchise</p>
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {periodOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadDashboardData}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-2">
                Last updated: {lastUpdated.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(dashboardData.kpis.totalUsers)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(dashboardData.kpis.activeUsers)}
                </p>
                <p className="text-xs text-green-600">
                  {dashboardData.kpis.engagementRate}% engagement
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserPlus className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">New Users</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(dashboardData.kpis.newUsers)}
                </p>
                <p className="text-xs text-gray-500">This period</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserCheck className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Verified Users</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(dashboardData.kpis.verifiedUsers)}
                </p>
                <p className="text-xs text-emerald-600">
                  {dashboardData.kpis.verificationRate}% verified
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Shield className="h-8 w-8 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Logins</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(dashboardData.kpis.totalLogins)}
                </p>
                <p className="text-xs text-indigo-600">
                  {dashboardData.kpis.loginSuccessRate}% success rate
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* User Registration Trend */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">User Registration Trend</h3>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboardData.charts.userRegistrationTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Login Activity Trend */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Login Activity Trend</h3>
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.charts.loginTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Users by Status */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Users by Status</h3>
              <PieChart className="h-5 w-5 text-purple-600" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  dataKey="value"
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={statusColors[index % statusColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          {/* Users by Group */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Users by Role</h3>
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(dashboardData.charts.usersByGroup).map(([group, count], index) => (
                <div key={group} className="text-center p-4 bg-gray-50 rounded-lg">
                  <div 
                    className="w-8 h-8 rounded-full mx-auto mb-2"
                    style={{ backgroundColor: groupColors[index % groupColors.length] }}
                  ></div>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(count)}</p>
                  <p className="text-sm text-gray-600 capitalize">{group.replace('-', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Insights Section */}
        {dashboardData.insights && dashboardData.insights.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Insights & Recommendations</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData.insights.map((insight, index) => (
                  <div key={index} className={`p-4 rounded-lg border-l-4 ${
                    insight.type === 'positive' ? 'bg-green-50 border-green-400' :
                    insight.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                    'bg-red-50 border-red-400'
                  }`}>
                    <div className="flex items-center mb-2">
                      {insight.type === 'positive' ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      ) : insight.type === 'warning' ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                      )}
                      <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                    </div>
                    <p className="text-sm text-gray-700">{insight.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Additional Metrics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Logins/Day</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {dashboardData.kpis.avgLoginsPerDay}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Engagement Rate</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {dashboardData.kpis.engagementRate}%
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Login Success Rate</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {dashboardData.kpis.loginSuccessRate}%
                </p>
              </div>
              <Shield className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;