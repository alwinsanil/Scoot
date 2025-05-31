const logger = {
    info: (message) => console.log(message),
};

exports.lambdaHandler = async (event, context) => {
    /**
     * Dalscooter API Lambda handler with guest/user routes
     */
    logger.info(`Received event: ${JSON.stringify(event)}`);

    // Extract request information
    const httpMethod = event.httpMethod || 'UNKNOWN';
    const path = event.path || '/';
    const resource = event.resource || '/{proxy+}';
    const pathParts = path.split('/');
    const queryParams = event.queryStringParameters || {};
    const headers = event.headers || {};
    const body = event.body || '{}';

    let bodyJson = {};
    try {
        bodyJson = JSON.parse(body);
    } catch (e) {
        // Leave as empty object
    }

    // Determine if request is authenticated (comes through /user path)
    const isAuthenticated = resource.includes('/user');

    let responseBody;

    // Basic routing
    if (path === '/') {
        responseBody = {
            service: 'dalscooter-api',
            message: 'Welcome to Dalscooter API',
            version: '1.0.0',
            authenticated: isAuthenticated,
            endpoints: {
                guest: '/guest/{proxy+}',
                user: '/user/{proxy+}'
            }
        };
    } else if (path.includes('/health')) {
        responseBody = {
            status: 'healthy',
            service: 'dalscooter-api',
            authenticated: isAuthenticated,
            timestamp: context.getRemainingTimeInMillis()
        };
    } else if (path.includes('/guest')) {
        responseBody = handleGuestRequest(pathParts, httpMethod, queryParams, bodyJson);
    } else if (path.includes('/user')) {
        responseBody = handleUserRequest(pathParts, httpMethod, queryParams, bodyJson, headers);
    } else {
        responseBody = {
            error: 'Endpoint not found',
            path: path,
            authenticated: isAuthenticated,
            availableEndpoints: ['/guest/{proxy+}', '/user/{proxy+}']
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
        body: JSON.stringify(responseBody, null, 2)
    };
};

function handleGuestRequest(pathParts, method, queryParams, body) {
    /** Handle requests to guest endpoints */
    // Extract the specific guest endpoint (pathParts[2] if path is /guest/endpoint)
    const endpoint = pathParts.length > 2 ? pathParts[2] : null;

    if (endpoint === 'scooters') {
        return {
            endpoint: 'guest/scooters',
            method: method,
            message: 'Public scooter information',
            action: method === 'GET' ? 'List available scooters' : 'Invalid method for guest'
        };
    } else if (endpoint === 'callback') {
        const id_token = queryParams.code;
        if (!id_token) {
            return {
                statusCode: 400,
                body: 'Missing id_token',
            };
        }

        const redirectUrl = `http://localhost:3000/qna-setup?token=${encodeURIComponent(id_token)}`;

        return {
            statusCode: 200,
            headers: {
                Location: redirectUrl,
            },
            body: '',
        };
    } else {
        return {
            endpoint: 'guest',
            method: method,
            message: 'Unknown guest endpoint',
            availableGuestEndpoints: ['register', 'scooters']
        };
    }
}

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