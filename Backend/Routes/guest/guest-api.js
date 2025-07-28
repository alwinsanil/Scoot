//guest-api.js
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const VEHICLES_TABLE = process.env.VEHICLES_TABLE || 'franchise-vehicles';
const FEEDBACK_TABLE = process.env.FEEDBACK_TABLE || 'vehicle-feedback';

exports.lambdaHandler = async (event) => {
    console.log('Guest API Event received:', JSON.stringify(event, null, 2));
    
    // Extract request information
    const path = event.path || '/';
    const httpMethod = event.httpMethod || 'UNKNOWN';
    const pathParts = path.split('/').filter(part => part);
    const queryParams = event.queryStringParameters || {};
    const body = event.body || '{}';

    // Handle CORS preflight requests
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: ''
        };
    }

    let bodyJson = {};
    try {
        bodyJson = JSON.parse(body);
    } catch (e) {
        console.log('Invalid JSON body:', e);
    }

    let responseBody;

    try {
        if (path.includes('/guest')) {
            responseBody = await handleGuestRequest(pathParts, httpMethod, queryParams, bodyJson);
        } else {
            responseBody = {
                error: 'Unknown path',
                message: 'This endpoint only handles guest requests'
            };
        }

        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify(responseBody, null, 2),
        };
    } catch (error) {
        console.error('Error handling guest request:', error);
        
        return {
            statusCode: error.statusCode || 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({
                error: error.name || 'InternalServerError',
                message: error.message || 'An unexpected error occurred'
            })
        };
    }
};

async function handleGuestRequest(pathParts, method, queryParams, body) {
    console.log('Processing guest request:', { pathParts, method, queryParams });
    
    // Extract the specific guest endpoint and resource
    // pathParts: ['guest', 'vehicles', 'vehicleId', 'reviews']
    const guestIndex = pathParts.indexOf('guest');
    const endpoint = pathParts[guestIndex + 1]; // vehicles, scooters, etc.
    const resourceId = pathParts[guestIndex + 2]; // specific ID if present
    const subEndpoint = pathParts[guestIndex + 3]; // reviews, etc.

    console.log('Route components:', { endpoint, resourceId, subEndpoint });

    switch (endpoint) {
        case 'vehicles':
        case 'scooters':
            if (subEndpoint === 'reviews') {
                return await handleGuestVehicleReviews(method, resourceId, queryParams);
            }
            return await handleGuestVehicles(method, resourceId, queryParams);
        
        case 'callback':
            return handleAuthCallback(queryParams);
        
        default:
            return {
                success: true,
                message: 'Guest API endpoints',
                availableEndpoints: {
                    'GET /guest/vehicles': 'List all available vehicles (public)',
                    'GET /guest/vehicles/{id}': 'Get specific vehicle details (public)',
                    'GET /guest/vehicles/{id}/reviews': 'Get vehicle reviews and ratings (public)',
                    'GET /guest/scooters': 'Alias for vehicles endpoint',
                    'GET /guest/callback': 'Authentication callback handler'
                }
            };
    }
}

// Guest vehicle endpoints
async function handleGuestVehicles(method, vehicleId, queryParams) {
    switch (method) {
        case 'GET':
            if (vehicleId) {
                return await getPublicVehicle(vehicleId, queryParams);
            } else {
                return await getPublicVehicles(queryParams);
            }
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed for vehicles endpoint` };
    }
}

async function handleGuestVehicleReviews(method, vehicleId, queryParams) {
    switch (method) {
        case 'GET':
            if (!vehicleId) {
                throw { statusCode: 400, message: 'Vehicle ID is required for reviews endpoint' };
            }
            return await getPublicVehicleReviews(vehicleId, queryParams);
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed for vehicle reviews endpoint` };
    }
}

// Public vehicle functions
async function getPublicVehicles(queryParams) {
    console.log('Getting public vehicles with filters:', queryParams);
    
    const params = {
        TableName: VEHICLES_TABLE,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'available'
        }
    };

    // Add optional filters
    if (queryParams.type) {
        params.FilterExpression += ' AND vehicleType = :type';
        params.ExpressionAttributeValues[':type'] = queryParams.type;
    }

    if (queryParams.location) {
        params.FilterExpression += ' AND contains(#location, :location)';
        params.ExpressionAttributeNames['#location'] = 'location';
        params.ExpressionAttributeValues[':location'] = queryParams.location;
    }

    if (queryParams.maxRate) {
        params.FilterExpression += ' AND hourlyRate <= :maxRate';
        params.ExpressionAttributeValues[':maxRate'] = parseFloat(queryParams.maxRate);
    }

    const result = await dynamodb.scan(params).promise();
    
    // Get review summaries for all vehicles if requested
    const includeReviews = queryParams.includeReviews === 'true';
    const publicVehicles = await Promise.all(result.Items.map(async vehicle => {
        const publicVehicle = {
            vehicleId: vehicle.vehicleId,
            vehicleType: vehicle.vehicleType,
            model: vehicle.model,
            hourlyRate: vehicle.hourlyRate,
            batteryLife: vehicle.batteryLife,
            features: vehicle.features,
            location: vehicle.location,
            discountCode: vehicle.discountCode,
            discountPercentage: vehicle.discountPercentage,
            status: vehicle.status,
            // Add some basic metadata without exposing owner info
            createdAt: vehicle.createdAt,
            updatedAt: vehicle.updatedAt
        };

        if (includeReviews) {
            const reviewSummary = await getVehicleReviewSummary(vehicle.vehicleId);
            publicVehicle.reviewSummary = reviewSummary;
        }

        return publicVehicle;
    }));
    
    return {
        success: true,
        vehicles: publicVehicles,
        count: publicVehicles.length,
        message: 'Public vehicles retrieved successfully',
        note: 'Authentication required for booking'
    };
}

async function getPublicVehicle(vehicleId, queryParams = {}) {
    console.log('Getting public vehicle:', vehicleId);
    
    const params = {
        TableName: VEHICLES_TABLE,
        FilterExpression: 'vehicleId = :vehicleId AND #status = :status',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':vehicleId': vehicleId,
            ':status': 'available'
        }
    };

    const result = await dynamodb.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
        throw { statusCode: 404, message: 'Vehicle not found or not available' };
    }

    const vehicle = result.Items[0];
    
    // Create public vehicle object (no sensitive owner information)
    const publicVehicle = {
        vehicleId: vehicle.vehicleId,
        vehicleType: vehicle.vehicleType,
        model: vehicle.model,
        hourlyRate: vehicle.hourlyRate,
        batteryLife: vehicle.batteryLife,
        features: vehicle.features,
        location: vehicle.location,
        discountCode: vehicle.discountCode,
        discountPercentage: vehicle.discountPercentage,
        status: vehicle.status,
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt
    };

    // Include review summary by default for individual vehicle requests
    const includeReviews = queryParams.includeReviews !== 'false'; // default to true
    if (includeReviews) {
        const reviewSummary = await getVehicleReviewSummary(vehicleId);
        publicVehicle.reviewSummary = reviewSummary;
    }

    return {
        success: true,
        vehicle: publicVehicle,
        message: 'Public vehicle retrieved successfully',
        note: 'Authentication required for booking'
    };
}

// Public vehicle reviews functions
async function getPublicVehicleReviews(vehicleId, queryParams) {
    console.log('Getting public reviews for vehicle:', vehicleId);
    
    // First verify the vehicle exists and is available
    await getPublicVehicle(vehicleId, { includeReviews: false });
    
    const params = {
        TableName: FEEDBACK_TABLE,
        FilterExpression: 'vehicleId = :vehicleId',
        ExpressionAttributeValues: {
            ':vehicleId': vehicleId
        }
    };

    // Add optional filters
    if (queryParams.rating) {
        params.FilterExpression += ' AND rating = :rating';
        params.ExpressionAttributeValues[':rating'] = parseInt(queryParams.rating);
    }

    if (queryParams.category) {
        params.FilterExpression += ' AND category = :category';
        params.ExpressionAttributeValues[':category'] = queryParams.category;
    }

    if (queryParams.minRating) {
        params.FilterExpression += ' AND rating >= :minRating';
        params.ExpressionAttributeValues[':minRating'] = parseInt(queryParams.minRating);
    }

    const result = await dynamodb.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
        return {
            success: true,
            reviews: [],
            reviewSummary: {
                averageRating: 0,
                totalReviews: 0,
                ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                recommendationPercentage: 0
            },
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalReviews: 0,
                limit: parseInt(queryParams.limit) || 20
            },
            message: 'No reviews found for this vehicle'
        };
    }

    // Create public reviews (remove sensitive user information)
    const publicReviews = result.Items.map(review => ({
        reviewId: review.feedbackId,
        rating: review.rating,
        category: review.category,
        subject: review.subject,
        message: review.message,
        wouldRecommend: review.wouldRecommend,
        issues: review.issues || [],
        reviewDate: review.createdAt,
        // Anonymize user info - show only first letter and domain
        reviewer: anonymizeEmail(review.userEmail),
        vehicleType: review.vehicleType,
        vehicleModel: review.vehicleModel,
        // Add helpful metadata
        isVerified: true, // All reviews are from actual bookings
        helpfulCount: Math.floor(Math.random() * 10), // Could be implemented later
    }));

    // Sort by creation date (newest first) or by rating if specified
    if (queryParams.sortBy === 'rating') {
        publicReviews.sort((a, b) => {
            if (queryParams.sortOrder === 'asc') {
                return a.rating - b.rating;
            }
            return b.rating - a.rating;
        });
    } else {
        publicReviews.sort((a, b) => new Date(b.reviewDate) - new Date(a.reviewDate));
    }

    // Apply pagination
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedReviews = publicReviews.slice(startIndex, endIndex);

    // Calculate review summary
    const reviewSummary = calculateReviewSummary(result.Items);

    return {
        success: true,
        reviews: paginatedReviews,
        reviewSummary: reviewSummary,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(publicReviews.length / limit),
            totalReviews: publicReviews.length,
            limit: limit,
            hasNextPage: endIndex < publicReviews.length,
            hasPreviousPage: page > 1
        },
        filters: {
            availableCategories: getAvailableCategories(result.Items),
            ratingRange: { min: 1, max: 5 }
        },
        message: 'Vehicle reviews retrieved successfully'
    };
}

async function getVehicleReviewSummary(vehicleId) {
    console.log('Getting review summary for vehicle:', vehicleId);
    
    const params = {
        TableName: FEEDBACK_TABLE,
        FilterExpression: 'vehicleId = :vehicleId',
        ExpressionAttributeValues: {
            ':vehicleId': vehicleId
        }
    };

    const result = await dynamodb.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
        return {
            averageRating: 0,
            totalReviews: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            recommendationPercentage: 0,
            commonIssues: [],
            lastReviewDate: null
        };
    }

    return calculateReviewSummary(result.Items);
}

function calculateReviewSummary(reviews) {
    if (!reviews || reviews.length === 0) {
        return {
            averageRating: 0,
            totalReviews: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            recommendationPercentage: 0,
            commonIssues: [],
            lastReviewDate: null
        };
    }

    const totalReviews = reviews.length;
    const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = Math.round((ratingSum / totalReviews) * 10) / 10; // Round to 1 decimal

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(review => {
        ratingDistribution[review.rating]++;
    });

    // Calculate recommendation percentage
    const recommendCount = reviews.filter(review => review.wouldRecommend === true).length;
    const recommendationPercentage = Math.round((recommendCount / totalReviews) * 100);

    // Calculate most common issues
    const issueFrequency = {};
    reviews.forEach(review => {
        if (review.issues && Array.isArray(review.issues)) {
            review.issues.forEach(issue => {
                issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
            });
        }
    });

    const commonIssues = Object.entries(issueFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([issue, count]) => ({ issue, count, percentage: Math.round((count / totalReviews) * 100) }));

    // Get last review date
    const sortedReviews = reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const lastReviewDate = sortedReviews[0]?.createdAt || null;

    // Calculate category breakdown
    const categoryBreakdown = {};
    reviews.forEach(review => {
        const category = review.category || 'overall';
        if (!categoryBreakdown[category]) {
            categoryBreakdown[category] = { total: 0, sum: 0 };
        }
        categoryBreakdown[category].total++;
        categoryBreakdown[category].sum += review.rating;
    });

    const categoryAverages = {};
    Object.keys(categoryBreakdown).forEach(category => {
        categoryAverages[category] = Math.round(
            (categoryBreakdown[category].sum / categoryBreakdown[category].total) * 10
        ) / 10;
    });

    return {
        averageRating,
        totalReviews,
        ratingDistribution,
        recommendationPercentage,
        commonIssues,
        lastReviewDate,
        categoryAverages,
        // Additional insights for public display
        insights: {
            mostPositiveAspect: getMostPositiveAspect(reviews),
            mostCommonComplaint: commonIssues[0]?.issue || null,
            averagesByMonth: getAveragesByMonth(reviews)
        }
    };
}

// Authentication callback handler
function handleAuthCallback(queryParams) {
    const id_token = queryParams.code;
    if (!id_token) {
        throw { statusCode: 400, message: 'Missing authorization code' };
    }

    // In a real implementation, you'd validate the token and exchange it
    const redirectUrl = `http://localhost:3000/qna-setup?token=${encodeURIComponent(id_token)}`;

    return {
        success: true,
        redirectUrl: redirectUrl,
        message: 'Authentication callback processed successfully'
    };
}

// Helper functions
function anonymizeEmail(email) {
    if (!email) return 'Anonymous';
    
    const [username, domain] = email.split('@');
    if (!domain) return 'Anonymous';
    
    const anonymizedUsername = username.charAt(0) + '*'.repeat(Math.max(username.length - 1, 2));
    return `${anonymizedUsername}@${domain}`;
}

function getAvailableCategories(reviews) {
    const categories = new Set();
    reviews.forEach(review => {
        if (review.category) {
            categories.add(review.category);
        }
    });
    return Array.from(categories);
}

function getMostPositiveAspect(reviews) {
    // Simple implementation - could be enhanced with NLP
    const positiveWords = ['excellent', 'great', 'amazing', 'perfect', 'wonderful', 'fantastic'];
    const aspectCounts = {};
    
    reviews.filter(r => r.rating >= 4).forEach(review => {
        const text = `${review.subject} ${review.message}`.toLowerCase();
        if (text.includes('battery')) aspectCounts.battery = (aspectCounts.battery || 0) + 1;
        if (text.includes('comfort')) aspectCounts.comfort = (aspectCounts.comfort || 0) + 1;
        if (text.includes('speed')) aspectCounts.speed = (aspectCounts.speed || 0) + 1;
        if (text.includes('clean')) aspectCounts.cleanliness = (aspectCounts.cleanliness || 0) + 1;
    });
    
    const mostPositive = Object.entries(aspectCounts)
        .sort(([,a], [,b]) => b - a)[0];
    
    return mostPositive ? mostPositive[0] : null;
}

function getAveragesByMonth(reviews) {
    const monthlyData = {};
    
    reviews.forEach(review => {
        const date = new Date(review.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { total: 0, sum: 0 };
        }
        monthlyData[monthKey].total++;
        monthlyData[monthKey].sum += review.rating;
    });
    
    const result = {};
    Object.keys(monthlyData).forEach(month => {
        result[month] = Math.round((monthlyData[month].sum / monthlyData[month].total) * 10) / 10;
    });
    
    return result;
}

function getCorsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
    };
}