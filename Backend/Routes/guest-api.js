exports.lambdaHandler = async (event) => {
    // Extract request information
    const path = event.path || '/';
    const httpMethod = event.httpMethod || 'UNKNOWN';
    const pathParts = path.split('/');
    const queryParams = event.queryStringParameters || {};
    const body = event.body || '{}';

    let bodyJson = {};
    try {
        bodyJson = JSON.parse(body);
    } catch (e) {}

    let responseBody;

    if (path.includes('/guest')) {
        responseBody = handleGuestRequest(pathParts, httpMethod, queryParams, bodyJson);
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