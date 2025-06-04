const logger = {
    info: (message) => console.log(message),
};

exports.lambdaHandler = async (event, context) => {
    /**
     * Dalscooter API Lambda handler with guest/user routes
     */
    logger.info(`Received event: ${JSON.stringify(event)}`);

    // Extract request information
    const path = event.path || '/';
    const resource = event.resource || '/{proxy+}';
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
