exports.lambdaHandler = async (event) => {
    // Extract request information
    const path = event.path || '/';
    const httpMethod = event.httpMethod || 'UNKNOWN';
    const pathParts = path.split('/');
    const queryParams = event.queryStringParameters || {};
    const headers = event.headers || {};
    const body = event.body || '{}';

    let bodyJson = {};
    try {
        bodyJson = JSON.parse(body);
    } catch (e) {}

    // Extract user info from JWT token (already validated by API Gateway)
    const userInfo = extractUserInfo(headers);
    
    // Check if user is authenticated
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

    responseBody = handleUserRequest(pathParts, httpMethod, queryParams, bodyJson, headers, userInfo);

    return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify(responseBody, null, 2),
    };
};

function extractUserInfo(headers) {
    try {
        // Get Authorization header
        const authHeader = headers.Authorization || headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { isAuthenticated: false };
        }

        // Extract JWT token (already validated by API Gateway)
        const token = authHeader.replace('Bearer ', '');
        
        // Decode JWT payload (no need to verify since API Gateway already did)
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        
        // Extract user information
        const userId = payload.sub;
        const email = payload.email;
        const groups = payload['cognito:groups'] || [];
        
        return {
            isAuthenticated: true,
            userId: userId,
            email: email,
            groups: groups
        };
    } catch (error) {
        console.error('Error extracting user info:', error);
        return { isAuthenticated: false };
    }
}



function handleUserRequest(pathParts, method, queryParams, body, headers, userInfo) {
    const endpoint = pathParts.length > 2 ? pathParts[2] : null;

    const scooterActions = {
        GET: 'Get available scooters',
        POST: 'Reserve scooter',
        PUT: 'Update scooter reservation',
        DELETE: 'Cancel reservation'
    };

    const rideActions = {
        GET: 'Get ride history',
        POST: 'Start new ride',
        PUT: 'Update ride status',
        DELETE: 'Cancel ride'
    };

    const profileActions = {
        GET: 'Get profile',
        POST: 'Create profile',
        PUT: 'Update profile',
        DELETE: 'Delete profile'
    };

    if (endpoint === 'scooters') {
        return {
            endpoint: 'user/scooters',
            method: method,
            message: 'User scooter management',
            userId: userInfo.userId,
            userRole: 'user',
            action: scooterActions[method] || 'Unknown action',
            permissions: 'User can view and reserve scooters'
        };
    } else if (endpoint === 'rides') {
        return {
            endpoint: 'user/rides',
            method: method,
            message: 'User ride management',
            userId: userInfo.userId,
            userRole: 'user',
            action: rideActions[method] || 'Unknown action',
            permissions: 'User can manage their own rides'
        };
    } else if (endpoint === 'profile') {
        return {
            endpoint: 'user/profile',
            method: method,
            message: 'User profile management',
            userId: userInfo.userId,
            userRole: 'user',
            action: profileActions[method] || 'Unknown action',
            permissions: 'User can manage their own profile'
        };
    } else {
        return {
            endpoint: 'user',
            method: method,
            message: 'Unknown user endpoint',
            userId: userInfo.userId,
            userRole: 'user',
            availableUserEndpoints: ['scooters', 'rides', 'profile']
        };
    }
}

function getCorsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
    };
}