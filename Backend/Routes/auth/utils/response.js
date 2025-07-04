function buildResponse(statusCode, body, options = {}) {
    const {
        headers: customHeaders = {},
        disableCors = false,
        contentType = 'application/json'
    } = options;

    const defaultHeaders = {
        'Content-Type': contentType,
        ...(disableCors ? {} : {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        })
    };

    return {
        statusCode,
        headers: { ...defaultHeaders, ...customHeaders },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    };
}

function buildHtmlResponse(html, statusCode = 200, additionalHeaders = {}) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            ...additionalHeaders
        },
        body: html
    };
}

module.exports = {
    buildResponse,
    buildHtmlResponse
};