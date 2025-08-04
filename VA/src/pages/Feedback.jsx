import React, { useState, useEffect } from 'react';
import { X, Filter, TrendingUp, AlertTriangle } from 'lucide-react';
import { redirectBaseUri } from '../contants/constants';

const FeedbackModalDisplay = ({ isOpen, onClose }) => {
    const [feedback, setFeedback] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        sentiment: '',
        rating: '',
        severity: ''
    });

    useEffect(() => {
        if (isOpen) {
            loadFeedbackData();
        }
    }, [filters, isOpen]);

    const loadFeedbackData = async () => {
        try {
            setLoading(true);
            
            const queryParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) queryParams.append(key, value);
            });
            
            const response = await fetch(`${redirectBaseUri}/dev/guest/feedback?${queryParams.toString()}`);
            const data = await response.json();
            
            setFeedback(data.feedback || []);
            setAnalytics(data.analytics || null);
        } catch (error) {
            console.error('Error loading feedback:', error);
        } finally {
            setLoading(false);
        }
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Customer Feedback Analysis</h2>
                        <p className="text-gray-600 text-sm">AI-powered sentiment analysis and insights</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content Area - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                            <div className="text-xl text-gray-600">Loading sentiment analysis...</div>
                        </div>
                    ) : (
                        <>
                            {/* Analytics Summary */}
                            {analytics && (
                                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <TrendingUp className="w-5 h-5 text-blue-600" />
                                        <h3 className="text-lg font-semibold">Sentiment Overview</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="bg-white p-4 rounded-lg border">
                                            <h4 className="font-semibold text-blue-900 text-sm">Total Analyzed</h4>
                                            <p className="text-xl font-bold text-blue-600">{analytics.totalAnalyzed}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border">
                                            <h4 className="font-semibold text-green-900 text-sm">Positive</h4>
                                            <p className="text-xl font-bold text-green-600">
                                                {analytics.sentimentDistribution?.percentages?.POSITIVE || 0}%
                                            </p>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border">
                                            <h4 className="font-semibold text-red-900 text-sm">Negative</h4>
                                            <p className="text-xl font-bold text-red-600">
                                                {analytics.sentimentDistribution?.percentages?.NEGATIVE || 0}%
                                            </p>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border">
                                            <h4 className="font-semibold text-purple-900 text-sm">Confidence</h4>
                                            <p className="text-xl font-bold text-purple-600">{analytics.insights?.analysisQuality || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {/* Top Emotions & Themes - Compact for Modal */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-4 rounded-lg border">
                                            <h4 className="font-semibold mb-3 text-sm">Top Emotions</h4>
                                            <div className="space-y-2">
                                                {(analytics.topEmotions || []).slice(0, 3).map((emotion, idx) => (
                                                    <div key={idx} className="flex justify-between items-center">
                                                        <span className="capitalize text-sm">{emotion.emotion}</span>
                                                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{emotion.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border">
                                            <h4 className="font-semibold mb-3 text-sm">Key Themes</h4>
                                            <div className="space-y-2">
                                                {(analytics.topKeyPhrases || []).slice(0, 3).map((phrase, idx) => (
                                                    <div key={idx} className="flex justify-between items-center">
                                                        <span className="text-sm">{phrase.phrase}</span>
                                                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{phrase.percentage}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Filters - Compact */}
                            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <Filter className="w-4 h-4 text-gray-600" />
                                    <h3 className="font-semibold text-sm">Filter Feedback</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <select 
                                        value={filters.sentiment} 
                                        onChange={(e) => setFilters({...filters, sentiment: e.target.value})}
                                        className="border border-gray-300 rounded px-3 py-2 text-sm"
                                    >
                                        <option value="">All Sentiments</option>
                                        <option value="POSITIVE">Positive</option>
                                        <option value="NEGATIVE">Negative</option>
                                        <option value="NEUTRAL">Neutral</option>
                                        <option value="MIXED">Mixed</option>
                                    </select>
                                    
                                    <select 
                                        value={filters.rating} 
                                        onChange={(e) => setFilters({...filters, rating: e.target.value})}
                                        className="border border-gray-300 rounded px-3 py-2 text-sm"
                                    >
                                        <option value="">All Ratings</option>
                                        <option value="5">5 Stars</option>
                                        <option value="4">4 Stars</option>
                                        <option value="3">3 Stars</option>
                                        <option value="2">2 Stars</option>
                                        <option value="1">1 Star</option>
                                    </select>
                                    
                                    <select 
                                        value={filters.severity} 
                                        onChange={(e) => setFilters({...filters, severity: e.target.value})}
                                        className="border border-gray-300 rounded px-3 py-2 text-sm"
                                    >
                                        <option value="">All Severity</option>
                                        <option value="HIGH">High Priority</option>
                                        <option value="MEDIUM">Medium Priority</option>
                                        <option value="LOW">Low Priority</option>
                                    </select>
                                </div>
                            </div>

                            {/* Feedback Cards - Optimized for Modal */}
                            <div className="space-y-4">
                                {feedback.map((item) => (
                                    <div key={item.feedbackId} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                                        {/* Header Row - Compact */}
                                        <div className="flex flex-wrap justify-between items-start mb-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-gray-900 text-sm truncate">{item.subject}</h4>
                                                <p className="text-xs text-gray-600">
                                                    {item.vehicleType} - {item.vehicleModel} | {item.userEmail}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-2 ml-2">
                                                <div className="flex text-yellow-400 text-sm">
                                                    {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                                                </div>
                                                <span className="text-xs text-gray-600">({item.rating}/5)</span>
                                            </div>
                                        </div>

                                        {/* Message - Truncated for Modal */}
                                        <div className="mb-3">
                                            <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">{item.message}</p>
                                        </div>

                                        {/* Sentiment Analysis Section - Compact */}
                                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                            <h5 className="font-semibold text-gray-900 mb-2 text-sm">AI Sentiment Analysis</h5>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {/* Primary Sentiment */}
                                                <div>
                                                    <label className="text-xs text-gray-500 uppercase tracking-wider">Sentiment</label>
                                                    <div className="mt-1">
                                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getSentimentBadge(item.sentimentAnalysis?.sentiment)}`}>
                                                            {item.sentimentAnalysis?.sentiment || 'UNKNOWN'}
                                                        </span>
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            Confidence: {item.sentimentAnalysis?.confidence || 'LOW'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Emotions */}
                                                <div>
                                                    <label className="text-xs text-gray-500 uppercase tracking-wider">Emotions</label>
                                                    <div className="mt-1">
                                                        {(item.sentimentAnalysis?.emotions || []).slice(0, 2).map((emotion, idx) => {
                                                            const emotionName = typeof emotion === 'object' ? emotion.emotion : emotion;
                                                            return (
                                                                <span key={idx} className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded mr-1 mb-1">
                                                                    {emotionName}
                                                                </span>
                                                            );
                                                        })}
                                                        {(item.sentimentAnalysis?.emotions?.length || 0) === 0 && (
                                                            <span className="text-xs text-gray-400">None detected</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Severity */}
                                                <div>
                                                    <label className="text-xs text-gray-500 uppercase tracking-wider">Priority</label>
                                                    <div className="mt-1">
                                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getSeverityBadge(item.sentimentAnalysis?.severity)}`}>
                                                            {item.sentimentAnalysis?.severity || 'LOW'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Key Phrases - Compact */}
                                            {(item.sentimentAnalysis?.keyPhrases || []).length > 0 && (
                                                <div className="mt-3">
                                                    <label className="text-xs text-gray-500 uppercase tracking-wider">Key Themes</label>
                                                    <div className="mt-1">
                                                        <p className="text-xs text-indigo-600">
                                                            {item.sentimentAnalysis.keyPhrases.slice(0, 3).join(', ')}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Issues Section - Compact */}
                                        {(item.issues || []).length > 0 && (
                                            <div className="border-t pt-3 mb-3">
                                                <div className="flex items-center gap-1 mb-2">
                                                    <AlertTriangle className="w-3 h-3 text-red-500" />
                                                    <h6 className="font-medium text-gray-900 text-xs">Reported Issues</h6>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.issues.slice(0, 3).map((issue, idx) => (
                                                        <span key={idx} className="inline-flex px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                                                            {issue}
                                                        </span>
                                                    ))}
                                                    {item.issues.length > 3 && (
                                                        <span className="text-xs text-gray-500">+{item.issues.length - 3} more</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer - Compact */}
                                        <div className="flex justify-between items-center pt-3 border-t text-xs text-gray-500">
                                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                                            <span>
                                                {item.wouldRecommend ? 'Recommends' : 'Won\'t Recommend'}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {feedback.length === 0 && (
                                    <div className="text-center py-12">
                                        <div className="text-4xl mb-4 text-gray-400">📝</div>
                                        <h3 className="text-lg text-gray-900 mb-2">No feedback found</h3>
                                        <p className="text-gray-600 text-sm">Try adjusting your filters or check back later.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 bg-gray-50 p-4 text-center">
                    <p className="text-gray-700 text-xs">
                        <strong>AI-Powered Analysis:</strong> All sentiment analysis is automatically generated using advanced natural language processing. 
                        Feedback is from verified customers who completed vehicle reservations.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FeedbackModalDisplay;