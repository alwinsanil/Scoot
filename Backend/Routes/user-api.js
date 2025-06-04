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

    let responseBody;

    if (path.includes('/user')) {
        responseBody = handleUserRequest(pathParts, httpMethod, queryParams, bodyJson, headers);
    } else {
        responseBody = {
            error: 'Unknown path',
        };
    }

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        },
        body: JSON.stringify(responseBody, null, 2),
    };
};

function handleUserRequest(pathParts, method, queryParams, body, headers) {
    /** Handle requests to authenticated user endpoints */
    // Extract the specific user endpoint (pathParts[2] if path is /user/endpoint)
    const endpoint = pathParts.length > 2 ? pathParts[2] : null;
    const userId = headers.Authorization ? headers.Authorization.split(' ').pop() : null;

    const scooterActions = {
        GET: 'Get scooter details',
        POST: 'Reserve scooter',
        PUT: 'Update scooter status',
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
            userId: userId,
            action: scooterActions[method] || 'Unknown action'
        };
    } else if (endpoint === 'rides') {
        return {
            endpoint: 'user/rides',
            method: method,
            message: 'User ride management',
            userId: userId,
            action: rideActions[method] || 'Unknown action'
        };
    } else if (endpoint === 'profile') {
        return {
            endpoint: 'user/profile',
            method: method,
            message: 'User profile management',
            userId: userId,
            action: profileActions[method] || 'Unknown action'
        };
    } else {
        return {
            endpoint: 'user',
            method: method,
            message: 'Unknown user endpoint',
            userId: userId,
            availableUserEndpoints: ['scooters', 'rides', 'profile']
        };
    }
}