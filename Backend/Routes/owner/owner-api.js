//owner-api.js
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const analyticsUtils = require('./analytics-utils');

const VEHICLES_TABLE = process.env.VEHICLES_TABLE || 'franchise-vehicles';

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

    if (!userInfo.isOwner) {
        return {
            statusCode: 403,
            headers: getCorsHeaders(),
            body: JSON.stringify({
                error: 'Forbidden',
                message: 'Franchise operator access required'
            })
        };
    }

    let responseBody;
    
    try {
        // Check if this is an analytics endpoint
        if (path.includes('/analytics')) {
            responseBody = await handleAnalyticsRequest(path, httpMethod, queryParams, userInfo);
        } else {
            // Handle vehicle endpoints
            responseBody = await handleVehicleRequest(path, httpMethod, queryParams, bodyJson, userInfo);
        }
        
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

// NEW: Handle analytics requests
async function handleAnalyticsRequest(path, method, queryParams, userInfo) {
    console.log('Processing analytics request:', { path, method, queryParams });
    
    // Only allow GET requests for analytics
    if (method !== 'GET') {
        throw { statusCode: 405, message: `Method ${method} not allowed for analytics endpoints` };
    }
    
    // Route analytics endpoints
    if (path.includes('/analytics/dashboard')) {
        return await analyticsUtils.getDashboardData(queryParams, userInfo);
    } else if (path.includes('/analytics/users')) {
        return await analyticsUtils.getUserAnalytics(queryParams, userInfo);
    } else if (path.includes('/analytics/login-stats')) {
        return await analyticsUtils.getLoginStats(queryParams, userInfo);
    } else {
        throw { statusCode: 404, message: 'Analytics endpoint not found' };
    }
}

async function handleVehicleRequest(path, method, queryParams, body, userInfo) {
    console.log('Processing vehicle request:', { path, method, queryParams });
    
    // Split path and remove empty parts
    const pathParts = path.split('/').filter(part => part);
    
    console.log('Path parts:', pathParts);
    
    // Parse vehicle request paths
    let userType, endpoint, vehicleId;
    
    if (pathParts.includes('owner') && pathParts.includes('vehicles')) {
        const ownerIndex = pathParts.indexOf('owner');
        const vehiclesIndex = pathParts.indexOf('vehicles');
        
        if (vehiclesIndex === ownerIndex + 1) {
            userType = 'owner';
            endpoint = 'vehicles';
            vehicleId = pathParts[vehiclesIndex + 1]; // might be undefined
        }
    }
    
    console.log('Route components:', { userType, endpoint, vehicleId });
    
    if (userType !== 'owner' || endpoint !== 'vehicles') {
        throw { statusCode: 404, message: 'Endpoint not found' };
    }

    switch (method) {
        case 'GET':
            if (vehicleId) {
                return await getVehicle(vehicleId, userInfo);
            } else {
                return await getAllVehicles(userInfo, queryParams);
            }
        
        case 'POST':
            return await createVehicle(body, userInfo);
        
        case 'PUT':
            if (!vehicleId) {
                throw { statusCode: 400, message: 'Vehicle ID is required for updates' };
            }
            return await updateVehicle(vehicleId, body, userInfo);
        
        case 'DELETE':
            if (!vehicleId) {
                throw { statusCode: 400, message: 'Vehicle ID is required for deletion' };
            }
            return await deleteVehicle(vehicleId, userInfo);
        
        default:
            throw { statusCode: 405, message: `Method ${method} not allowed` };
    }
}

async function getAllVehicles(userInfo, queryParams) {
    console.log('Getting all vehicles for user:', userInfo.userId);
    
    const params = {
        TableName: VEHICLES_TABLE,
        FilterExpression: 'ownerId = :ownerId',
        ExpressionAttributeValues: {
            ':ownerId': userInfo.userId
        }
    };

    // Add optional filters
    if (queryParams.status) {
        params.FilterExpression += ' AND #status = :status';
        params.ExpressionAttributeValues[':status'] = queryParams.status;
        params.ExpressionAttributeNames = { '#status': 'status' };
    }

    if (queryParams.type) {
        params.FilterExpression += ' AND vehicleType = :type';
        params.ExpressionAttributeValues[':type'] = queryParams.type;
    }

    const result = await dynamodb.scan(params).promise();
    
    return {
        success: true,
        vehicles: result.Items || [],
        count: result.Items ? result.Items.length : 0,
        message: 'Vehicles retrieved successfully'
    };
}

async function getVehicle(vehicleId, userInfo) {
    console.log('Getting vehicle:', vehicleId, 'for user:', userInfo.userId);
    
    const params = {
        TableName: VEHICLES_TABLE,
        Key: {
            vehicleId: vehicleId,
            ownerId: userInfo.userId
        }
    };

    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
        throw { statusCode: 404, message: 'Vehicle not found' };
    }

    return {
        success: true,
        vehicle: result.Item,
        message: 'Vehicle retrieved successfully'
    };
}

async function createVehicle(vehicleData, userInfo) {
    console.log('Creating vehicle:', vehicleData, 'for user:', userInfo.userId);
    
    // Validate required fields
    const requiredFields = ['vehicleType', 'model', 'accessCode', 'hourlyRate', 'batteryLife'];
    for (const field of requiredFields) {
        if (!vehicleData[field] && vehicleData[field] !== 0) {
            throw { statusCode: 400, message: `${field} is required` };
        }
    }

    // Validate vehicle type
    const validTypes = ['anebike', 'gyroscooter', 'segway'];
    if (!validTypes.includes(vehicleData.vehicleType)) {
        throw { statusCode: 400, message: 'Invalid vehicle type. Must be anebike, gyroscooter, or segway' };
    }

    // Check if access code already exists for this owner
    const existingVehicle = await checkAccessCodeExists(vehicleData.accessCode, userInfo.userId);
    if (existingVehicle) {
        throw { statusCode: 409, message: 'Access code already exists for your vehicles' };
    }

    const vehicleId = generateVehicleId();
    const timestamp = new Date().toISOString();

    const vehicle = {
        vehicleId: vehicleId,
        ownerId: userInfo.userId,
        ownerEmail: userInfo.email,
        vehicleType: vehicleData.vehicleType,
        model: vehicleData.model.trim(),
        accessCode: vehicleData.accessCode.toString().trim().toUpperCase(),
        hourlyRate: parseFloat(vehicleData.hourlyRate),
        batteryLife: parseInt(vehicleData.batteryLife),
        
        // Features with defaults
        features: {
            heightAdjustment: vehicleData.features?.heightAdjustment || false,
            gpsTracking: vehicleData.features?.gpsTracking !== false, // Default true
            antiTheft: vehicleData.features?.antiTheft !== false, // Default true
            ledLights: vehicleData.features?.ledLights || false,
            phoneHolder: vehicleData.features?.phoneHolder || false,
            bluetooth: vehicleData.features?.bluetooth || false,
            speedModes: vehicleData.features?.speedModes || false
        },
        
        // Optional discount fields
        discountCode: vehicleData.discountCode ? vehicleData.discountCode.toString().trim().toUpperCase() : null,
        discountPercentage: vehicleData.discountPercentage ? parseInt(vehicleData.discountPercentage) : 0,
        
        // Status and location
        status: vehicleData.status || 'available',
        location: vehicleData.location ? vehicleData.location.trim() : null,
        lastMaintenance: vehicleData.lastMaintenance || null,
        
        // Timestamps and metrics
        createdAt: timestamp,
        updatedAt: timestamp,
        totalRides: 0,
        totalRevenue: 0
    };

    // Validate hourly rate
    if (vehicle.hourlyRate <= 0) {
        throw { statusCode: 400, message: 'Hourly rate must be greater than 0' };
    }

    // Validate battery life
    if (vehicle.batteryLife <= 0) {
        throw { statusCode: 400, message: 'Battery life must be greater than 0' };
    }

    // Validate discount percentage
    if (vehicle.discountPercentage < 0 || vehicle.discountPercentage > 100) {
        throw { statusCode: 400, message: 'Discount percentage must be between 0 and 100' };
    }

    const params = {
        TableName: VEHICLES_TABLE,
        Item: vehicle,
        ConditionExpression: 'attribute_not_exists(vehicleId)'
    };

    await dynamodb.put(params).promise();

    return {
        success: true,
        vehicle: vehicle,
        message: 'Vehicle created successfully'
    };
}

async function updateVehicle(vehicleId, updateData, userInfo) {
    console.log('Updating vehicle:', vehicleId, 'with data:', updateData, 'for user:', userInfo.userId);
    
    // First check if vehicle exists and belongs to user
    const existingVehicle = await getVehicle(vehicleId, userInfo);
    
    // Check if access code is being changed and if new code already exists
    if (updateData.accessCode && updateData.accessCode !== existingVehicle.vehicle.accessCode) {
        const existingWithCode = await checkAccessCodeExists(updateData.accessCode, userInfo.userId, vehicleId);
        if (existingWithCode) {
            throw { statusCode: 409, message: 'Access code already exists for your vehicles' };
        }
    }

    const timestamp = new Date().toISOString();
    
    let updateExpression = 'SET updatedAt = :updatedAt';
    let expressionAttributeValues = {
        ':updatedAt': timestamp
    };

    // Fields that can be updated directly
    const updatableFields = [
        'model', 'accessCode', 'hourlyRate', 'batteryLife', 'status', 
        'discountCode', 'discountPercentage', 'location', 'lastMaintenance'
    ];

    updatableFields.forEach(field => {
        if (updateData[field] !== undefined) {
            updateExpression += `, ${field} = :${field}`;
            let value = updateData[field];
            // Type conversions and validations
           if (field === 'hourlyRate') {
               value = parseFloat(value);
               if (value <= 0) {
                   throw { statusCode: 400, message: 'Hourly rate must be greater than 0' };
               }
           } else if (field === 'batteryLife') {
               value = parseInt(value);
               if (value <= 0) {
                   throw { statusCode: 400, message: 'Battery life must be greater than 0' };
               }
           } else if (field === 'discountPercentage') {
               value = parseInt(value);
               if (value < 0 || value > 100) {
                   throw { statusCode: 400, message: 'Discount percentage must be between 0 and 100' };
               }
           } else if (field === 'accessCode' || field === 'discountCode') {
               value = value ? value.toString().trim().toUpperCase() : value;
           } else if (field === 'model' || field === 'location') {
               value = value ? value.toString().trim() : value;
           }
           
           expressionAttributeValues[`:${field}`] = value;
       }
   });

   // Handle features separately since it's an object
   if (updateData.features) {
       updateExpression += ', features = :features';
       expressionAttributeValues[':features'] = {
           heightAdjustment: updateData.features.heightAdjustment || false,
           gpsTracking: updateData.features.gpsTracking !== false,
           antiTheft: updateData.features.antiTheft !== false,
           ledLights: updateData.features.ledLights || false,
           phoneHolder: updateData.features.phoneHolder || false,
           bluetooth: updateData.features.bluetooth || false,
           speedModes: updateData.features.speedModes || false
       };
   }

   const params = {
       TableName: VEHICLES_TABLE,
       Key: {
           vehicleId: vehicleId,
           ownerId: userInfo.userId
       },
       UpdateExpression: updateExpression,
       ExpressionAttributeValues: expressionAttributeValues,
       ReturnValues: 'ALL_NEW'
   };

   const result = await dynamodb.update(params).promise();

   return {
       success: true,
       vehicle: result.Attributes,
       message: 'Vehicle updated successfully'
   };
}

async function deleteVehicle(vehicleId, userInfo) {
   console.log('Deleting vehicle:', vehicleId, 'for user:', userInfo.userId);
   
   // First check if vehicle exists and get its current status
   const vehicle = await getVehicle(vehicleId, userInfo);
   
   if (vehicle.vehicle.status === 'rented') {
       throw { statusCode: 400, message: 'Cannot delete vehicle that is currently rented' };
   }

   const params = {
       TableName: VEHICLES_TABLE,
       Key: {
           vehicleId: vehicleId,
           ownerId: userInfo.userId
       },
       ReturnValues: 'ALL_OLD'
   };

   const result = await dynamodb.delete(params).promise();

   if (!result.Attributes) {
       throw { statusCode: 404, message: 'Vehicle not found' };
   }

   return {
       success: true,
       deletedVehicle: result.Attributes,
       message: 'Vehicle deleted successfully'
   };
}

async function checkAccessCodeExists(accessCode, ownerId, excludeVehicleId = null) {
   const params = {
       TableName: VEHICLES_TABLE,
       FilterExpression: 'ownerId = :ownerId AND accessCode = :accessCode',
       ExpressionAttributeValues: {
           ':ownerId': ownerId,
           ':accessCode': accessCode.toString().trim().toUpperCase()
       }
   };

   if (excludeVehicleId) {
       params.FilterExpression += ' AND vehicleId <> :excludeVehicleId';
       params.ExpressionAttributeValues[':excludeVehicleId'] = excludeVehicleId;
   }

   const result = await dynamodb.scan(params).promise();
   return result.Items && result.Items.length > 0;
}

function generateVehicleId() {
   return 'vehicle_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function getCorsHeaders() {
   return {
       'Content-Type': 'application/json',
       'Access-Control-Allow-Origin': '*',
       'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   };
}