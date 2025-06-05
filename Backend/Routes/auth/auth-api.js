const AWS = require('aws-sdk');
const crypto = require('crypto');
const axios = require('axios');

const dynamoClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        const path = event.path;
        const httpMethod = event.httpMethod;

        // Route the request based on path and method
        switch (true) {
            case path.endsWith('/callback') && httpMethod === 'GET':
                return await handleCallback(event);

            case path.endsWith('/qna') && httpMethod === 'POST':
                return await handleQna(event);

            case path.endsWith('/cipher') && httpMethod === 'POST':
                return await handleCipher(event);

            case path.endsWith('/status') && httpMethod === 'GET':
                return await handleStatus(event);

            default:
                return {
                    statusCode: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Endpoint not found' })
                };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: error.statusCode || 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: error.message || 'Internal server error',
                ...(error.details && { details: error.details })
            })
        };
    }
};

// =====================
// Route Handlers
// =====================

async function handleCallback(event) {
    const { code } = event.queryStringParameters || {};
    console.log(event.queryStringParameters)
    if (!code) {
        throw {
            statusCode: 400,
            message: 'Missing code or state parameters',
            details: { required: ['code', 'state'] }
        };
    }

    // Exchange code for Cognito tokens
    const cognitoTokens = await exchangeCodeForTokens(code);
    const userInfo = await getUserInfoFromToken(cognitoTokens.access_token);

    // Generate temporary session token
    const tempToken = generateTempToken();
    const sessionData = {
        tempToken,
        userId: userInfo.sub,
        cognitoTokens: cognitoTokens,
        step1Complete: true,
        step2Complete: false,
        step3Complete: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes
    };

    // Store in DynamoDB
    await dynamoClient.put({
        TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
        Item: sessionData
    }).promise();

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tempToken,
            nextStep: 'qna',
            message: 'Step 1 complete. Please proceed to Q&A verification.'
        })
    };
}

async function handleQna(event) {
    if (!event.body) {
        throw {
            statusCode: 400,
            message: 'Missing request body'
        };
    }

    const { tempToken, answers } = JSON.parse(event.body);

    if (!tempToken || !answers) {
        throw {
            statusCode: 400,
            message: 'Missing tempToken or answers',
            details: { required: ['tempToken', 'answers'] }
        };
    }

    // Retrieve session
    const session = await getSession(tempToken);
    if (!session || !session.step1Complete) {
        throw {
            statusCode: 401,
            message: 'Invalid session or step 1 not complete'
        };
    }

    // Verify Q&A answers
    const isQnaValid = await verifyQnaAnswers(session.userId, answers);
    if (!isQnaValid) {
        throw {
            statusCode: 403,
            message: 'Q&A verification failed'
        };
    }

    // Update session
    await dynamoClient.update({
        TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
        Key: { tempToken },
        UpdateExpression: 'SET step2Complete = :true',
        ExpressionAttributeValues: { ':true': true }
    }).promise();

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tempToken,
            nextStep: 'cipher',
            message: 'Step 2 complete. Please proceed to cipher verification.'
        })
    };
}

async function handleCipher(event) {
    if (!event.body) {
        throw {
            statusCode: 400,
            message: 'Missing request body'
        };
    }

    const { tempToken, cipherResponse } = JSON.parse(event.body);

    if (!tempToken || !cipherResponse) {
        throw {
            statusCode: 400,
            message: 'Missing tempToken or cipherResponse',
            details: { required: ['tempToken', 'cipherResponse'] }
        };
    }

    // Retrieve session
    const session = await getSession(tempToken);
    if (!session || !session.step1Complete || !session.step2Complete) {
        throw {
            statusCode: 401,
            message: 'Invalid session or previous steps not complete'
        };
    }

    // Verify cipher
    const isCipherValid = await verifyCipherResponse(session.userId, cipherResponse);
    if (!isCipherValid) {
        throw {
            statusCode: 403,
            message: 'Cipher verification failed'
        };
    }

    // All steps complete - return actual Cognito tokens
    await dynamoClient.delete({
        TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
        Key: { tempToken }
    }).promise();

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            accessToken: session.cognitoTokens.access_token,
            idToken: session.cognitoTokens.id_token,
            refreshToken: session.cognitoTokens.refresh_token,
            message: 'Authentication complete!'
        })
    };
}

async function handleStatus(event) {
    const { tempToken } = event.queryStringParameters || {};

    if (!tempToken) {
        throw {
            statusCode: 400,
            message: 'Missing tempToken parameter',
            details: { required: ['tempToken'] }
        };
    }

    const session = await getSession(tempToken);
    if (!session) {
        throw {
            statusCode: 404,
            message: 'Session not found'
        };
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            step1Complete: session.step1Complete,
            step2Complete: session.step2Complete,
            step3Complete: session.step3Complete,
            currentStep: getCurrentStep(session)
        })
    };
}

// =====================
// Helper Functions
// =====================

function generateTempToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function getSession(tempToken) {
    const result = await dynamoClient.get({
        TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
        Key: { tempToken }
    }).promise();

    if (!result.Item) return null;

    // Check expiration
    if (Date.now() > result.Item.expiresAt) {
        await dynamoClient.delete({
            TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
            Key: { tempToken }
        }).promise();
        return null;
    }

    return result.Item;
}

async function exchangeCodeForTokens(code) {

    const tokenEndpoint = `https://${process.env.COGNITO_DOMAIN}/oauth2/token`;

    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.COGNITO_CLIENT_ID,
        client_secret: process.env.COGNITO_CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.REDIRECT_URI
    });

    try {
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const tokens = await response.json();
        return tokens;
    } catch (error) {
        console.error('Token exchange failed:', error);
        throw error;
    }
}

async function getUserInfoFromToken(accessToken) {
    console.log("here in user info")
    const userInfoEndpoint = `https://${process.env.COGNITO_DOMAIN}/oauth2/userInfo`;
    const response = await axios.get(userInfoEndpoint, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.data;
}

async function verifyQnaAnswers(userId, answers) {
    const userQna = await dynamoClient.get({
        TableName: process.env.QNA_TABLE || 'UserSecurityQuestions',
        Key: { userId }
    }).promise();

    if (!userQna.Item) {
        throw {
            statusCode: 404,
            message: 'User Q&A data not found'
        };
    }

    return answers.every((answer, index) =>
        hashAnswer(answer) === userQna.Item.hashedAnswers[index]
    );
}

async function verifyCipherResponse(userId, cipherResponse) {
    const userCipher = await dynamoClient.get({
        TableName: process.env.CIPHER_TABLE || 'UserCipherKeys',
        Key: { userId }
    }).promise();

    if (!userCipher.Item) {
        throw {
            statusCode: 404,
            message: 'User cipher data not found'
        };
    }

    return verifyCipherLogic(cipherResponse, userCipher.Item.cipherKey);
}

function hashAnswer(answer) {
    return crypto.createHash('sha256').update(answer.toLowerCase().trim()).digest('hex');
}

function verifyCipherLogic(response, key) {
    // Implement your specific cipher verification
    // Example: time-based OTP, RSA signature verification, etc.
    return true; // Placeholder - replace with actual implementation
}

function getCurrentStep(session) {
    if (!session.step1Complete) return 1;
    if (!session.step2Complete) return 2;
    if (!session.step3Complete) return 3;
    return 'complete';
}