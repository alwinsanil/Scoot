//user-api.js
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const VEHICLES_TABLE = process.env.VEHICLES_TABLE || 'franchise-vehicles';
const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE || 'vehicle-reservations';

exports.lambdaHandler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
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
        console.error('Error handling request:', error);
        
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
        endpoint = pathParts[userIndex + 1]; // scooters, rides, profile, etc.
        resourceId = pathParts[userIndex + 2]; // specific ID if present
    }
    
    console.log('Route components:', { userType, endpoint, resourceId });
    
    if (userType !== 'user') {
        throw { statusCode: 404, message: 'Endpoint not found' };
    }

    switch (endpoint) {
        case 'scooters':
        case 'vehicles':
            return await handleVehicleEndpoint(method, resourceId, queryParams, body, userInfo);
        
        case 'reservations':
            return await handleReservationEndpoint(method, resourceId, queryParams, body, userInfo);
        
        case 'rides':
            return await handleRideEndpoint(method, resourceId, queryParams, body, userInfo);
        
        case 'profile':
            return await handleProfileEndpoint(method, resourceId, queryParams, body, userInfo);
        
        default:
            return {
                success: true,
                message: 'User API endpoints',
                availableEndpoints: {
                    'GET /user/vehicles': 'List available vehicles for rent',
                    'GET /user/vehicles/{id}': 'Get specific vehicle details',
                    'POST /user/reservations': 'Create a new reservation',
                    'GET /user/reservations': 'Get user reservations',
                    'PUT /user/reservations/{id}': 'Update reservation',
                    'DELETE /user/reservations/{id}': 'Cancel reservation',
                    'POST /user/rides': 'Start a ride from reservation',
                    'GET /user/rides': 'Get ride history',
                    'PUT /user/rides/{id}': 'Update ride status',
                    'GET /user/profile': 'Get user profile',
                    'PUT /user/profile': 'Update user profile'
                }
            };
    }
}

async function handleVehicleEndpoint(method, vehicleId, queryParams, body, userInfo) {
    switch (method) {
        case 'GET':
            if (vehicleId) {
                return await getAvailableVehicle(vehicleId);
            } else {
                return await getAvailableVehicles(queryParams);
            }
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed for vehicles endpoint` };
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

async function handleRideEndpoint(method, rideId, queryParams, body, userInfo) {
    switch (method) {
        case 'GET':
            if (rideId) {
                return await getRide(rideId, userInfo);
            } else {
                return await getUserRides(userInfo, queryParams);
            }
        
        case 'POST':
            return await startRide(body, userInfo);
        
        case 'PUT':
            if (!rideId) {
                throw { statusCode: 400, message: 'Ride ID is required for updates' };
            }
            return await updateRide(rideId, body, userInfo);
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed for rides endpoint` };
    }
}

async function handleProfileEndpoint(method, resourceId, queryParams, body, userInfo) {
    switch (method) {
        case 'GET':
            return await getUserProfile(userInfo);
        
        case 'PUT':
            return await updateUserProfile(body, userInfo);
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed for profile endpoint` };
    }
}

// Vehicle-related functions
async function getAvailableVehicles(queryParams) {
    console.log('Getting available vehicles with filters:', queryParams);
    
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
    
    // Remove sensitive owner information but keep necessary details
    const publicVehicles = result.Items.map(vehicle => ({
        vehicleId: vehicle.vehicleId,
        vehicleType: vehicle.vehicleType,
        model: vehicle.model,
        hourlyRate: vehicle.hourlyRate,
        batteryLife: vehicle.batteryLife,
        features: vehicle.features,
        location: vehicle.location,
        discountCode: vehicle.discountCode,
        discountPercentage: vehicle.discountPercentage,
        status: vehicle.status
    }));
    
    return {
        success: true,
        vehicles: publicVehicles,
        count: publicVehicles.length,
        message: 'Available vehicles retrieved successfully'
    };
}

async function getAvailableVehicle(vehicleId) {
    console.log('Getting vehicle:', vehicleId);
    
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
    
    // Remove sensitive owner information
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
        status: vehicle.status
    };

    return {
        success: true,
        vehicle: publicVehicle,
        message: 'Vehicle retrieved successfully'
    };
}

// Reservation-related functions
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

    // Check if vehicle exists and is available
    const vehicle = await getAvailableVehicle(reservationData.vehicleId);
    
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
    let totalCost = durationHours * vehicle.vehicle.hourlyRate;
    
    // Apply discount if provided
    if (reservationData.discountCode && 
        reservationData.discountCode.toUpperCase() === vehicle.vehicle.discountCode &&
        vehicle.vehicle.discountPercentage > 0) {
        const discountAmount = totalCost * (vehicle.vehicle.discountPercentage / 100);
        totalCost -= discountAmount;
    }

    const reservationId = generateReservationId();
    const timestamp = new Date().toISOString();

    const reservation = {
        reservationId: reservationId,
        userId: userInfo.userId,
        userEmail: userInfo.email,
        vehicleId: reservationData.vehicleId,
        vehicleType: vehicle.vehicle.vehicleType,
        vehicleModel: vehicle.vehicle.model,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationHours: durationHours,
        hourlyRate: vehicle.vehicle.hourlyRate,
        discountCode: reservationData.discountCode || null,
        discountPercentage: (reservationData.discountCode && 
                           reservationData.discountCode.toUpperCase() === vehicle.vehicle.discountCode) 
                           ? vehicle.vehicle.discountPercentage : 0,
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
            ownerId: vehicle.vehicle.ownerId // We need to get this from the original scan
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

    // We need to get the owner ID first
    const vehicleParams = {
        TableName: VEHICLES_TABLE,
        FilterExpression: 'vehicleId = :vehicleId',
        ExpressionAttributeValues: {
            ':vehicleId': reservationData.vehicleId
        }
    };

    const vehicleResult = await dynamodb.scan(vehicleParams).promise();
    if (vehicleResult.Items && vehicleResult.Items.length > 0) {
        vehicleUpdateParams.Key.ownerId = vehicleResult.Items[0].ownerId;
        await dynamodb.update(vehicleUpdateParams).promise();
    }

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
    const vehicleParams = {
        TableName: VEHICLES_TABLE,
        FilterExpression: 'vehicleId = :vehicleId',
        ExpressionAttributeValues: {
            ':vehicleId': reservation.vehicleId
        }
    };

    const vehicleResult = await dynamodb.scan(vehicleParams).promise();
    if (vehicleResult.Items && vehicleResult.Items.length > 0) {
        const vehicle = vehicleResult.Items[0];
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
    }

    return {
        success: true,
        reservation: result.Attributes,
        message: 'Reservation cancelled successfully'
    };
}

// Ride-related functions (basic implementation)
async function startRide(rideData, userInfo) {
    // Basic implementation - you can expand this
    return {
        success: true,
        message: 'Ride functionality not yet implemented',
        note: 'This would start a ride from an active reservation'
    };
}

async function getUserRides(userInfo, queryParams) {
    // Basic implementation - you can expand this
    return {
        success: true,
        rides: [],
        message: 'Ride history functionality not yet implemented'
    };
}

async function getRide(rideId, userInfo) {
    // Basic implementation - you can expand this
    return {
        success: true,
        message: 'Ride details functionality not yet implemented'
    };
}

async function updateRide(rideId, updateData, userInfo) {
    // Basic implementation - you can expand this
    return {
        success: true,
        message: 'Ride update functionality not yet implemented'
    };
}

// Profile-related functions (basic implementation)
async function getUserProfile(userInfo) {
    return {
        success: true,
        profile: {
            userId: userInfo.userId,
            email: userInfo.email,
            role: userInfo.role,
            groups: userInfo.groups
        },
        message: 'Profile retrieved successfully'
    };
}

async function updateUserProfile(profileData, userInfo) {
    return {
        success: true,
        message: 'Profile update functionality not yet implemented'
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