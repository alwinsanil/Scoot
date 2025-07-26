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

    // Extract user info from JWT token (Cognito)
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

    if (path.includes('/user')) {
        responseBody = handleUserRequest(pathParts, httpMethod, queryParams, bodyJson, headers, userInfo);
    } else if (path.includes('/owner')) {
        // Owner-only endpoints
        if (!userInfo.isOwner) {
            return {
                statusCode: 403,
                headers: getCorsHeaders(),
                body: JSON.stringify({
                    error: 'Forbidden',
                    message: 'Owner access required'
                })
            };
        }
        responseBody = handleOwnerRequest(pathParts, httpMethod, queryParams, bodyJson, headers, userInfo);
    } else {
        responseBody = {
            error: 'Unknown path',
        };
    }

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

        // Extract JWT token
        const token = authHeader.replace('Bearer ', '');
        
        // Decode JWT payload (in production, you should verify the signature)
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        
        // Extract user information
        const userId = payload.sub;
        const email = payload.email;
        const groups = payload['cognito:groups'] || [];
        
        // Determine user role
        const isOwner = groups.includes('owners') || groups.includes('admins');
        const isAdmin = groups.includes('admins');
        const isUser = groups.includes('users') || groups.length === 0; // Default to user if no groups
        
        return {
            isAuthenticated: true,
            userId: userId,
            email: email,
            groups: groups,
            isOwner: isOwner,
            isAdmin: isAdmin,
            isUser: isUser,
            role: isAdmin ? 'admin' : (isOwner ? 'owner' : 'user')
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
            userRole: userInfo.role,
            action: scooterActions[method] || 'Unknown action',
            permissions: 'User can view and reserve scooters'
        };
    } else if (endpoint === 'rides') {
        return {
            endpoint: 'user/rides',
            method: method,
            message: 'User ride management',
            userId: userInfo.userId,
            userRole: userInfo.role,
            action: rideActions[method] || 'Unknown action',
            permissions: 'User can manage their own rides'
        };
    } else if (endpoint === 'profile') {
        return {
            endpoint: 'user/profile',
            method: method,
            message: 'User profile management',
            userId: userInfo.userId,
            userRole: userInfo.role,
            action: profileActions[method] || 'Unknown action',
            permissions: 'User can manage their own profile'
        };
    } else {
        return {
            endpoint: 'user',
            method: method,
            message: 'Unknown user endpoint',
            userId: userInfo.userId,
            userRole: userInfo.role,
            availableUserEndpoints: ['scooters', 'rides', 'profile']
        };
    }
}

function handleOwnerRequest(pathParts, method, queryParams, body, headers, userInfo) {
    const endpoint = pathParts.length > 2 ? pathParts[2] : null;

    const ownerScooterActions = {
        GET: 'Get owned scooters',
        POST: 'Add new scooter',
        PUT: 'Update scooter details',
        DELETE: 'Remove scooter'
    };

    const ownerAnalyticsActions = {
        GET: 'Get earnings and usage analytics',
        POST: 'Generate reports',
        PUT: 'Update analytics settings',
        DELETE: 'Delete old reports'
    };

    const ownerBookingActions = {
        GET: 'View all bookings for owned scooters',
        POST: 'Create manual booking',
        PUT: 'Update booking status',
        DELETE: 'Cancel booking'
    };

    if (endpoint === 'scooters') {
        return {
            endpoint: 'owner/scooters',
            method: method,
            message: 'Owner scooter management',
            userId: userInfo.userId,
            userRole: userInfo.role,
            action: ownerScooterActions[method] || 'Unknown action',
            permissions: 'Owner can manage their scooter fleet'
        };
    } else if (endpoint === 'analytics') {
        return {
            endpoint: 'owner/analytics',
            method: method,
            message: 'Owner analytics and reports',
            userId: userInfo.userId,
            userRole: userInfo.role,
            action: ownerAnalyticsActions[method] || 'Unknown action',
            permissions: 'Owner can view earnings and usage data'
        };
    } else if (endpoint === 'bookings') {
        return {
            endpoint: 'owner/bookings',
            method: method,
            message: 'Owner booking management',
            userId: userInfo.userId,
            userRole: userInfo.role,
            action: ownerBookingActions[method] || 'Unknown action',
            permissions: 'Owner can manage bookings for their scooters'
        };
    } else {
        return {
            endpoint: 'owner',
            method: method,
            message: 'Unknown owner endpoint',
            userId: userInfo.userId,
            userRole: userInfo.role,
            availableOwnerEndpoints: ['scooters', 'analytics', 'bookings']
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