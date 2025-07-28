//user-api.js
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Import the feedback service for sentiment analysis
const feedbackService = require('./feedback-service');

const VEHICLES_TABLE = process.env.VEHICLES_TABLE || 'franchise-vehicles';
const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE || 'vehicle-reservations';
const FEEDBACK_TABLE = process.env.FEEDBACK_TABLE || 'vehicle-feedback';

exports.lambdaHandler = async (event) => {
    console.log('User API Event received:', JSON.stringify(event, null, 2));
    
    const path = event.path || '/';
    const httpMethod = event.httpMethod || 'UNKNOWN';
    const queryParams = event.queryStringParameters || {};
    const headers = event.headers || {};
    const body = event.body || '{}';

    // Handle CORS preflight requests
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: ''
        };
    }

    // Parse body JSON
    let bodyJson = {};
    try {
        if (body) {
            bodyJson = JSON.parse(body);
        }
    } catch (e) {
        console.log('Invalid JSON body:', e);
        return {
            statusCode: 400,
            headers: getCorsHeaders(),
            body: JSON.stringify({
                error: 'BadRequest',
                message: 'Invalid JSON in request body'
            })
        };
    }

    // Extract user info from JWT token
    const userInfo = extractUserInfo(headers);
    
    if (!userInfo.isAuthenticated) {
        return {
            statusCode: 401,
            headers: getCorsHeaders(),
            body: JSON.stringify({
                error: 'Unauthorized',
                message: 'Valid JWT token required'
            })
        };
    }

    let responseBody;
    
    try {
        responseBody = await handleUserRequest(path, httpMethod, queryParams, bodyJson, userInfo);
        
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify(responseBody, null, 2),
        };
    } catch (error) {
        console.error('Error handling user request:', error);
        
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

function extractUserInfo(headers) {
    try {
        const authHeader = headers.Authorization || headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { isAuthenticated: false };
        }

        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        
        const userId = payload.sub;
        const email = payload.email;
        const groups = payload['cognito:groups'] || [];
        
        const isOwner = groups.includes('owners') || groups.includes('admins') || groups.includes('franchise-operators');
        const isAdmin = groups.includes('admins');
        
        return {
            isAuthenticated: true,
            userId: userId,
            email: email,
            groups: groups,
            isOwner: isOwner,
            isAdmin: isAdmin,
            role: isAdmin ? 'admin' : (isOwner ? 'owner' : 'user')
        };
    } catch (error) {
        console.error('Error extracting user info:', error);
        return { isAuthenticated: false };
    }
}

async function handleUserRequest(path, method, queryParams, body, userInfo) {
    console.log('Processing user request:', { path, method, queryParams });
    
    const pathParts = path.split('/').filter(part => part);
    console.log('Path parts:', pathParts);
    
    let userType, endpoint, resourceId;
    
    if (pathParts.includes('user')) {
        const userIndex = pathParts.indexOf('user');
        userType = 'user';
        endpoint = pathParts[userIndex + 1]; // reservations, feedback, profile, rides, etc.
        resourceId = pathParts[userIndex + 2]; // specific ID if present
    }
    
    console.log('Route components:', { userType, endpoint, resourceId });
    
    if (userType !== 'user') {
        throw { statusCode: 404, message: 'Endpoint not found' };
    }

    switch (endpoint) {
        case 'reservations':
            return await handleReservationEndpoint(method, resourceId, queryParams, body, userInfo);
        
        case 'feedback':
            return await handleFeedbackEndpoint(method, resourceId, queryParams, body, userInfo);
        
        case 'profile':
            return await handleProfileEndpoint(method, resourceId, queryParams, body, userInfo);
        
        case 'analytics':
            // New endpoint for feedback analytics
            return await handleAnalyticsEndpoint(method, resourceId, queryParams, body, userInfo);
        
        default:
            return {
                success: true,
                message: 'User API endpoints - Authenticated actions only',
                note: 'Vehicle browsing and reviews are now available via guest API',
                availableEndpoints: {
                    'POST /user/reservations': 'Create a new reservation',
                    'GET /user/reservations': 'Get user reservations',
                    'GET /user/reservations/{id}': 'Get specific reservation',
                    'PUT /user/reservations/{id}': 'Update reservation',
                    'DELETE /user/reservations/{id}': 'Cancel reservation',
                    'POST /user/feedback': 'Submit feedback with sentiment analysis',
                    'GET /user/feedback': 'Get user feedback history with analytics',
                    'GET /user/feedback/{id}': 'Get specific feedback with analysis',
                    'PUT /user/feedback/{id}': 'Update feedback (re-analyzes sentiment)',
                    'DELETE /user/feedback/{id}': 'Delete feedback',
                    'GET /user/analytics/feedback': 'Get personal feedback analytics',
                    'POST /user/rides': 'Start a ride from reservation',
                    'GET /user/rides': 'Get ride history',
                    'PUT /user/rides/{id}': 'Update ride status',
                    'GET /user/profile': 'Get user profile',
                    'PUT /user/profile': 'Update user profile'
                },
                publicEndpoints: {
                    'GET /guest/vehicles': 'Browse available vehicles (no auth required)',
                    'GET /guest/vehicles/{id}': 'Get vehicle details (no auth required)',
                    'GET /guest/vehicles/{id}/reviews': 'Get vehicle reviews (no auth required)'
                },
                newFeatures: {
                    sentimentAnalysis: 'All feedback now includes AI-powered sentiment analysis',
                    insights: 'Automatic insights generation for feedback patterns',
                    alerts: 'High-priority negative feedback triggers alerts',
                    analytics: 'Personal feedback analytics and trends'
                }
            };
    }
}

async function handleReservationEndpoint(method, reservationId, queryParams, body, userInfo) {
    switch (method) {
        case 'GET':
            if (reservationId) {
                return await getReservation(reservationId, userInfo);
            } else {
                return await getUserReservations(userInfo, queryParams);
            }
        
        case 'POST':
            return await createReservation(body, userInfo);
        
        case 'PUT':
            if (!reservationId) {
                throw { statusCode: 400, message: 'Reservation ID is required for updates' };
            }
            // Check if this is a completion request
            if (body.action === 'complete') {
                return await completeReservation(reservationId, userInfo);
            }
            return await updateReservation(reservationId, body, userInfo);
        
        case 'DELETE':
            if (!reservationId) {
                throw { statusCode: 400, message: 'Reservation ID is required for cancellation' };
            }
            return await cancelReservation(reservationId, userInfo);
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed for reservations endpoint` };
    }
}

async function handleFeedbackEndpoint(method, feedbackId, queryParams, body, userInfo) {
    switch (method) {
        case 'GET':
            if (feedbackId) {
                return await getFeedback(feedbackId, userInfo);
            } else {
                return await getUserFeedback(userInfo, queryParams);
            }
        
        case 'POST':
            // Use enhanced feedback submission with sentiment analysis
            return await submitFeedbackWithAnalysis(body, userInfo);
        
        case 'PUT':
            if (!feedbackId) {
                throw { statusCode: 400, message: 'Feedback ID is required for updates' };
            }
            return await updateFeedbackWithAnalysis(feedbackId, body, userInfo);
        
        case 'DELETE':
            if (!feedbackId) {
                throw { statusCode: 400, message: 'Feedback ID is required for deletion' };
            }
            return await deleteFeedback(feedbackId, userInfo);
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed for feedback endpoint` };
    }
}

async function handleAnalyticsEndpoint(method, resourceId, queryParams, body, userInfo) {
    switch (method) {
        case 'GET':
            if (resourceId === 'feedback') {
                return await getUserFeedbackAnalytics(userInfo, queryParams);
            } 
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed for analytics endpoint` };
    }
}

async function handleProfileEndpoint(method, resourceId, queryParams, body, userInfo) {
    switch (method) {
        case 'GET':
            return await getUserProfile(userInfo);
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed for profile endpoint` };
    }
}

// Helper function to get vehicle details (for reservation validation)
async function getVehicleForReservation(vehicleId) {
    console.log('Getting vehicle for reservation validation:', vehicleId);
    
    const params = {
        TableName: VEHICLES_TABLE,
        FilterExpression: 'vehicleId = :vehicleId',
        ExpressionAttributeValues: {
            ':vehicleId': vehicleId
        }
    };

    const result = await dynamodb.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
        throw { statusCode: 404, message: 'Vehicle not found' };
    }

    return result.Items[0];
}

// Reservation-related functions (unchanged from original)
async function createReservation(reservationData, userInfo) {
    console.log('Creating reservation:', reservationData, 'for user:', userInfo.userId);
    
    // Validate required fields
    const requiredFields = ['vehicleId', 'startDate', 'endDate'];
    for (const field of requiredFields) {
        if (!reservationData[field]) {
            throw { statusCode: 400, message: `${field} is required` };
        }
    }

    // Validate dates
    const startDate = new Date(reservationData.startDate);
    const endDate = new Date(reservationData.endDate);
    const now = new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw { statusCode: 400, message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' };
    }

    if (startDate >= endDate) {
        throw { statusCode: 400, message: 'End date must be after start date' };
    }

    if (startDate < now) {
        throw { statusCode: 400, message: 'Start date cannot be in the past' };
    }

    // Check if vehicle exists and get its details
    const vehicle = await getVehicleForReservation(reservationData.vehicleId);
    
    if (vehicle.status !== 'available') {
        throw { statusCode: 409, message: 'Vehicle is not available for reservation' };
    }
    
    // Check for conflicting reservations
    const hasConflicts = await checkReservationConflicts(
        reservationData.vehicleId, 
        startDate, 
        endDate
    );
    
    if (hasConflicts) {
        throw { statusCode: 409, message: 'Vehicle is already reserved for the requested time period' };
    }

    // Calculate total cost
    const durationHours = Math.ceil((endDate - startDate) / (1000 * 60 * 60));
    let totalCost = durationHours * vehicle.hourlyRate;
    
    // Apply discount if provided
    if (reservationData.discountCode && 
        reservationData.discountCode.toUpperCase() === vehicle.discountCode &&
        vehicle.discountPercentage > 0) {
        const discountAmount = totalCost * (vehicle.discountPercentage / 100);
        totalCost -= discountAmount;
    }

    const reservationId = generateReservationId();
    const timestamp = new Date().toISOString();

    const reservation = {
        reservationId: reservationId,
        userId: userInfo.userId,
        userEmail: userInfo.email,
        vehicleId: reservationData.vehicleId,
        vehicleType: vehicle.vehicleType,
        vehicleModel: vehicle.model,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationHours: durationHours,
        hourlyRate: vehicle.hourlyRate,
        discountCode: reservationData.discountCode || null,
        discountPercentage: (reservationData.discountCode && 
                           reservationData.discountCode.toUpperCase() === vehicle.discountCode) 
                           ? vehicle.discountPercentage : 0,
        totalCost: Math.round(totalCost * 100) / 100, // Round to 2 decimal places
        status: 'confirmed',
        notes: reservationData.notes || null,
        createdAt: timestamp,
        updatedAt: timestamp
    };

    // Create reservation
    const reservationParams = {
        TableName: RESERVATIONS_TABLE,
        Item: reservation,
        ConditionExpression: 'attribute_not_exists(reservationId)'
    };

    await dynamodb.put(reservationParams).promise();

    // Update vehicle status to reserved
    const vehicleUpdateParams = {
        TableName: VEHICLES_TABLE,
        Key: {
            vehicleId: reservationData.vehicleId,
            ownerId: vehicle.ownerId
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'reserved',
            ':updatedAt': timestamp
        }
    };
    
    await dynamodb.update(vehicleUpdateParams).promise();

    return {
        success: true,
        reservation: reservation,
        message: 'Reservation created successfully'
    };
}

async function getUserReservations(userInfo, queryParams) {
    console.log('Getting reservations for user:', userInfo.userId);
    
    const params = {
        TableName: RESERVATIONS_TABLE,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userInfo.userId
        }
    };

    // Add status filter if provided
    if (queryParams.status) {
        params.FilterExpression += ' AND #status = :status';
        params.ExpressionAttributeNames = { '#status': 'status' };
        params.ExpressionAttributeValues[':status'] = queryParams.status;
    }

    const result = await dynamodb.scan(params).promise();
    
    // Sort by creation date (newest first)
    const reservations = (result.Items || []).sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    return {
        success: true,
        reservations: reservations,
        count: reservations.length,
        message: 'Reservations retrieved successfully'
    };
}

async function getReservation(reservationId, userInfo) {
    console.log('Getting reservation:', reservationId, 'for user:', userInfo.userId);
    
    const params = {
        TableName: RESERVATIONS_TABLE,
        FilterExpression: 'reservationId = :reservationId AND userId = :userId',
        ExpressionAttributeValues: {
            ':reservationId': reservationId,
            ':userId': userInfo.userId
        }
    };

    const result = await dynamodb.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
        throw { statusCode: 404, message: 'Reservation not found' };
    }

    return {
        success: true,
        reservation: result.Items[0],
        message: 'Reservation retrieved successfully'
    };
}

async function updateReservation(reservationId, updateData, userInfo) {
    console.log('Updating reservation:', reservationId, 'for user:', userInfo.userId);
    
    // Get existing reservation
    const existingReservation = await getReservation(reservationId, userInfo);
    const reservation = existingReservation.reservation;
    
    // Only allow updates to future reservations
    const startDate = new Date(reservation.startDate);
    const now = new Date();
    
    if (startDate <= now) {
        throw { statusCode: 400, message: 'Cannot update reservation that has already started' };
    }
    
    // Only allow certain fields to be updated
    const allowedUpdates = ['startDate', 'endDate', 'notes'];
    const updates = {};
    
    for (const field of allowedUpdates) {
        if (updateData[field] !== undefined) {
            updates[field] = updateData[field];
        }
    }
    
    if (Object.keys(updates).length === 0) {
        throw { statusCode: 400, message: 'No valid fields to update' };
    }
    
    // If dates are being updated, validate and recalculate cost
    if (updates.startDate || updates.endDate) {
        const newStartDate = new Date(updates.startDate || reservation.startDate);
        const newEndDate = new Date(updates.endDate || reservation.endDate);
        
        if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
            throw { statusCode: 400, message: 'Invalid date format' };
        }
        
        if (newStartDate >= newEndDate) {
            throw { statusCode: 400, message: 'End date must be after start date' };
        }
        
        if (newStartDate < now) {
            throw { statusCode: 400, message: 'Start date cannot be in the past' };
        }
        
        // Check for conflicts with new dates
        const hasConflicts = await checkReservationConflicts(
            reservation.vehicleId, 
            newStartDate, 
            newEndDate,
            reservationId // Exclude current reservation
        );
        
        if (hasConflicts) {
            throw { statusCode: 409, message: 'Vehicle is already reserved for the requested time period' };
        }
        
        // Recalculate cost
        const durationHours = Math.ceil((newEndDate - newStartDate) / (1000 * 60 * 60));
        let totalCost = durationHours * reservation.hourlyRate;
        
        if (reservation.discountPercentage > 0) {
            const discountAmount = totalCost * (reservation.discountPercentage / 100);
            totalCost -= discountAmount;
        }
        
        updates.durationHours = durationHours;
        updates.totalCost = Math.round(totalCost * 100) / 100;
        updates.startDate = newStartDate.toISOString();
        updates.endDate = newEndDate.toISOString();
    }
    
    // Build update expression
    let updateExpression = 'SET updatedAt = :updatedAt';
    let expressionAttributeValues = {
        ':updatedAt': new Date().toISOString()
    };
    
    Object.keys(updates).forEach(field => {
        updateExpression += `, ${field} = :${field}`;
        expressionAttributeValues[`:${field}`] = updates[field];
    });
    
    const params = {
        TableName: RESERVATIONS_TABLE,
        Key: {
            reservationId: reservationId,
            userId: userInfo.userId
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();

    return {
        success: true,
        reservation: result.Attributes,
        message: 'Reservation updated successfully'
    };
}

async function cancelReservation(reservationId, userInfo) {
    console.log('Cancelling reservation:', reservationId, 'for user:', userInfo.userId);
    
    // Get existing reservation
    const existingReservation = await getReservation(reservationId, userInfo);
    const reservation = existingReservation.reservation;
    
    if (reservation.status === 'cancelled') {
        throw { statusCode: 400, message: 'Reservation is already cancelled' };
    }
    
    if (reservation.status === 'completed') {
        throw { statusCode: 400, message: 'Cannot cancel completed reservation' };
    }
    
    // Update reservation status
    const timestamp = new Date().toISOString();
    const params = {
        TableName: RESERVATIONS_TABLE,
        Key: {
            reservationId: reservationId,
            userId: userInfo.userId
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, cancelledAt = :cancelledAt',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'cancelled',
            ':updatedAt': timestamp,
            ':cancelledAt': timestamp
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();
    
    // Update vehicle status back to available
    const vehicle = await getVehicleForReservation(reservation.vehicleId);
    const vehicleUpdateParams = {
        TableName: VEHICLES_TABLE,
        Key: {
            vehicleId: reservation.vehicleId,
            ownerId: vehicle.ownerId
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'available',
            ':updatedAt': timestamp
        }
    };
    
    await dynamodb.update(vehicleUpdateParams).promise();

    return {
        success: true,
        reservation: result.Attributes,
        message: 'Reservation cancelled successfully'
    };
}

async function completeReservation(reservationId, userInfo) {
    console.log('Completing reservation:', reservationId, 'for user:', userInfo.userId);
    
    // Get existing reservation
    const existingReservation = await getReservation(reservationId, userInfo);
    const reservation = existingReservation.reservation;
    
    if (reservation.status === 'completed') {
        throw { statusCode: 400, message: 'Reservation is already completed' };
    }
    
    if (reservation.status === 'cancelled') {
        throw { statusCode: 400, message: 'Cannot complete a cancelled reservation' };
    }
    
    // Update reservation status to completed
    const timestamp = new Date().toISOString();
    const params = {
        TableName: RESERVATIONS_TABLE,
        Key: {
            reservationId: reservationId,
            userId: userInfo.userId
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, completedAt = :completedAt',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'completed',
            ':updatedAt': timestamp,
            ':completedAt': timestamp
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();
    
    // Update vehicle status back to available
    const vehicle = await getVehicleForReservation(reservation.vehicleId);
    const vehicleUpdateParams = {
        TableName: VEHICLES_TABLE,
        Key: {
            vehicleId: reservation.vehicleId,
            ownerId: vehicle.ownerId
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'available',
            ':updatedAt': timestamp
        }
    };
    
    await dynamodb.update(vehicleUpdateParams).promise();

    return {
        success: true,
        reservation: result.Attributes,
        message: 'Reservation completed successfully. Thank you for using our service!'
    };
}

// Enhanced Feedback-related functions with sentiment analysis
async function submitFeedbackWithAnalysis(feedbackData, userInfo) {
    console.log('Submitting feedback with analysis:', feedbackData, 'for user:', userInfo.userId);
    
    // Validate required fields
    const requiredFields = ['reservationId', 'vehicleId', 'rating', 'subject', 'message'];
    for (const field of requiredFields) {
        if (!feedbackData[field]) {
            throw { statusCode: 400, message: `${field} is required` };
        }
    }

    // Validate rating
    if (feedbackData.rating < 1 || feedbackData.rating > 5) {
        throw { statusCode: 400, message: 'Rating must be between 1 and 5' };
    }

    // Verify reservation exists and belongs to user
    const reservation = await getReservation(feedbackData.reservationId, userInfo);
    
    if (reservation.reservation.status !== 'completed') {
        throw { statusCode: 400, message: 'Can only provide feedback for completed reservations' };
    }

    // Check if feedback already exists for this reservation
    const existingFeedback = await checkExistingFeedback(feedbackData.reservationId, userInfo.userId);
    if (existingFeedback) {
        throw { statusCode: 409, message: 'Feedback already exists for this reservation' };
    }

    // Use the enhanced feedback service for sentiment analysis
    const result = await feedbackService.submitFeedback(feedbackData, userInfo);
    
    return result;
}

async function getUserFeedback(userInfo, queryParams) {
    console.log('Getting feedback for user:', userInfo.userId);
    
    const params = {
        TableName: FEEDBACK_TABLE,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userInfo.userId
        }
    };

    // Add filters if provided
    if (queryParams.rating) {
        params.FilterExpression += ' AND rating = :rating';
        params.ExpressionAttributeValues[':rating'] = parseInt(queryParams.rating);
    }

    if (queryParams.category) {
        params.FilterExpression += ' AND category = :category';
        params.ExpressionAttributeValues[':category'] = queryParams.category;
    }

    if (queryParams.vehicleType) {
        params.FilterExpression += ' AND vehicleType = :vehicleType';
        params.ExpressionAttributeValues[':vehicleType'] = queryParams.vehicleType;
    }

    // Add sentiment filter
    if (queryParams.sentiment) {
        params.FilterExpression += ' AND sentiment = :sentiment';
        params.ExpressionAttributeValues[':sentiment'] = queryParams.sentiment;
    }

    // Add severity filter
    if (queryParams.severity) {
        params.FilterExpression += ' AND severity = :severity';
        params.ExpressionAttributeValues[':severity'] = queryParams.severity;
    }

    const result = await dynamodb.scan(params).promise();
    
    // Sort by creation date (newest first)
    const feedback = (result.Items || []).sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    // Calculate summary statistics
    const summary = {
        totalFeedback: feedback.length,
        averageRating: feedback.length > 0 ? 
            feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length : 0,
        sentimentDistribution: {
            positive: feedback.filter(f => f.sentiment === 'positive').length,
            neutral: feedback.filter(f => f.sentiment === 'neutral').length,
            negative: feedback.filter(f => f.sentiment === 'negative').length
        },
        severityDistribution: {
            high: feedback.filter(f => f.severity === 'high').length,
            medium: feedback.filter(f => f.severity === 'medium').length,
            low: feedback.filter(f => f.severity === 'low').length,
            none: feedback.filter(f => f.severity === 'none').length
        }
    };
    
    return {
        success: true,
        feedback: feedback,
        count: feedback.length,
        summary: summary,
        message: 'Feedback retrieved successfully with sentiment analysis'
    };
}

async function getFeedback(feedbackId, userInfo) {
    console.log('Getting feedback:', feedbackId, 'for user:', userInfo.userId);
    
    const params = {
        TableName: FEEDBACK_TABLE,
        FilterExpression: 'feedbackId = :feedbackId AND userId = :userId',
        ExpressionAttributeValues: {
            ':feedbackId': feedbackId,
            ':userId': userInfo.userId
        }
    };

    const result = await dynamodb.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
        throw { statusCode: 404, message: 'Feedback not found' };
    }

    const feedback = result.Items[0];
    
    // Add analysis summary if available
    const analysisInfo = {
        hasSentimentAnalysis: !!feedback.sentiment,
        hasInsights: !!(feedback.insights && feedback.insights.length > 0),
        analysisDate: feedback.analyzedAt || feedback.createdAt
    };

    return {
        success: true,
        feedback: feedback,
        analysisInfo: analysisInfo,
        message: 'Feedback retrieved successfully'
    };
}

async function updateFeedbackWithAnalysis(feedbackId, updateData, userInfo) {
    console.log('Updating feedback with re-analysis:', feedbackId, 'for user:', userInfo.userId);
    
    // Get existing feedback
    const existingFeedback = await getFeedback(feedbackId, userInfo);
    const feedback = existingFeedback.feedback;
    
    // Only allow updates within 24 hours of submission
    const feedbackCreated = new Date(feedback.createdAt);
    const now = new Date();
    const hoursSinceCreated = (now - feedbackCreated) / (1000 * 60 * 60);
    
    if (hoursSinceCreated > 24) {
        throw { statusCode: 400, message: 'Cannot update feedback older than 24 hours' };
    }
    
    // Only allow certain fields to be updated
    const allowedUpdates = ['rating', 'category', 'subject', 'message', 'wouldRecommend', 'issues'];
    const updates = {};
    
    for (const field of allowedUpdates) {
        if (updateData[field] !== undefined) {
            if (field === 'rating') {
                if (updateData[field] < 1 || updateData[field] > 5) {
                    throw { statusCode: 400, message: 'Rating must be between 1 and 5' };
                }
                updates[field] = parseInt(updateData[field]);
            } else if (field === 'subject' || field === 'message') {
                if (!updateData[field].trim()) {
                    throw { statusCode: 400, message: `${field} cannot be empty` };
                }
                updates[field] = updateData[field].trim();
            } else {
                updates[field] = updateData[field];
            }
        }
    }
    
    if (Object.keys(updates).length === 0) {
        throw { statusCode: 400, message: 'No valid fields to update' };
    }
    
    // If text content changed, re-analyze sentiment
    let sentimentUpdate = {};
    if (updates.subject || updates.message) {
        console.log('Text content changed, re-analyzing sentiment...');
        
        const combinedText = `${updates.subject || feedback.subject} ${updates.message || feedback.message}`;
        
        try {
            const analysis = await feedbackService.analyzeFeedbackSentiment(combinedText);
            const insights = feedbackService.generateFeedbackInsights(
                { ...feedback, ...updates }, 
                analysis
            );
            
            sentimentUpdate = {
                sentiment: analysis.sentiment,
                sentimentConfidence: analysis.confidence,
                emotions: analysis.emotions,
                keywords: analysis.keywords,
                categories: analysis.categories,
                severity: analysis.severity,
                insights: insights,
                analyzedAt: new Date().toISOString()
            };
            
            console.log('Re-analysis completed:', sentimentUpdate);
        } catch (error) {
            console.error('Error re-analyzing sentiment:', error);
            // Continue with update even if sentiment analysis fails
        }
    }
    
    // Build update expression
    let updateExpression = 'SET updatedAt = :updatedAt';
    let expressionAttributeValues = {
        ':updatedAt': new Date().toISOString()
    };
    
    // Add regular updates
    Object.keys(updates).forEach(field => {
        updateExpression += `, ${field} = :${field}`;
        expressionAttributeValues[`:${field}`] = updates[field];
    });
    
    // Add sentiment updates if available
    Object.keys(sentimentUpdate).forEach(field => {
        updateExpression += `, ${field} = :${field}`;
        expressionAttributeValues[`:${field}`] = sentimentUpdate[field];
    });
    
    const params = {
        TableName: FEEDBACK_TABLE,
        Key: {
            feedbackId: feedbackId,
            userId: userInfo.userId
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();
    
    // Check if updated feedback requires alerts
    if (sentimentUpdate.severity === 'high') {
        console.log('Updated feedback has high severity, triggering alert...');
        // You could call a trigger function here if needed
    }

    return {
        success: true,
        feedback: result.Attributes,
        reanalyzed: Object.keys(sentimentUpdate).length > 0,
        message: 'Feedback updated successfully' + 
                (Object.keys(sentimentUpdate).length > 0 ? ' with sentiment re-analysis' : '')
    };
}

async function deleteFeedback(feedbackId, userInfo) {
    console.log('Deleting feedback:', feedbackId, 'for user:', userInfo.userId);
    
    // Get existing feedback to verify ownership
    await getFeedback(feedbackId, userInfo);
    
    const params = {
        TableName: FEEDBACK_TABLE,
        Key: {
            feedbackId: feedbackId,
            userId: userInfo.userId
        }
    };

    await dynamodb.delete(params).promise();

    return {
        success: true,
        message: 'Feedback deleted successfully'
    };
}

// New Analytics Functions
async function getUserFeedbackAnalytics(userInfo, queryParams) {
    console.log('Getting personal feedback analytics for user:', userInfo.userId);
    
    // Get user's feedback with optional filters
    const userFeedback = await getUserFeedback(userInfo, queryParams);
    const feedback = userFeedback.feedback;
    
    if (feedback.length === 0) {
        return {
            success: true,
            analytics: {
                totalFeedback: 0,
                message: 'No feedback data available for analysis'
            }
        };
    }
    
    // Use the feedback service analytics function with user filter
    const filters = {
        userId: userInfo.userId,
        ...queryParams
    };
    
    const analytics = await feedbackService.getFeedbackAnalytics(filters);
    
    return {
        success: true,
        analytics: {
            ...analytics,
            personalInsights: personalInsights,
            feedbackHistory: feedback.slice(0, 5), // Last 5 feedback items
        },
        message: 'Personal feedback analytics retrieved successfully'
    };
}

// Profile-related functions
async function getUserProfile(userInfo) {
    // Get user's activity summary
    const reservations = await getUserReservations(userInfo, {});
    const feedbackData = await getUserFeedback(userInfo, {});
    
    return {
        success: true,
        profile: {
            userId: userInfo.userId,
            email: userInfo.email,
            role: userInfo.role,
            groups: userInfo.groups,
            registrationDate: userInfo.registrationDate || null,
            activitySummary: {
                totalReservations: reservations.count,
                totalFeedback: feedbackData.count,
                averageRating: feedbackData.summary.averageRating,
                memberSince: reservations.reservations[reservations.reservations.length - 1]?.createdAt || null
            },
            preferences: {
                notifications: true,
                marketing: false,
                reminderEmails: true,
                feedbackRequests: true
            }
        },
        message: 'Profile retrieved successfully'
    };
}

// Helper functions
async function checkReservationConflicts(vehicleId, startDate, endDate, excludeReservationId = null) {
    const params = {
        TableName: RESERVATIONS_TABLE,
        FilterExpression: 'vehicleId = :vehicleId AND #status IN (:confirmed, :active)',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':vehicleId': vehicleId,
            ':confirmed': 'confirmed',
            ':active': 'active'
        }
    };

    if (excludeReservationId) {
        params.FilterExpression += ' AND reservationId <> :excludeReservationId';
        params.ExpressionAttributeValues[':excludeReservationId'] = excludeReservationId;
    }

    const result = await dynamodb.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
        return false;
    }

    // Check for date conflicts
    for (const reservation of result.Items) {
        const reservationStart = new Date(reservation.startDate);
        const reservationEnd = new Date(reservation.endDate);
        
        // Check if dates overlap
        if (startDate < reservationEnd && endDate > reservationStart) {
            return true;
        }
    }
    
    return false;
}

async function checkExistingFeedback(reservationId, userId) {
    const params = {
        TableName: FEEDBACK_TABLE,
        FilterExpression: 'reservationId = :reservationId AND userId = :userId',
        ExpressionAttributeValues: {
            ':reservationId': reservationId,
            ':userId': userId
        }
    };

    const result = await dynamodb.scan(params).promise();
    return result.Items && result.Items.length > 0;
}

function generateReservationId() {
    return 'reservation_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function getCorsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
    };
}