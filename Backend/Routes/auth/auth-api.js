const AWS = require('aws-sdk');
const crypto = require('crypto');
const axios = require('axios');
const { buildResponse, buildHtmlResponse } = require('./utils/response');

const dynamoClient = new AWS.DynamoDB.DocumentClient();

const WORD_BANK = [
    'apple', 'bread', 'chair', 'drink', 'eagle',
    'flame', 'grape', 'house', 'ideal', 'jolly',
    'knife', 'lemon', 'mango', 'noble', 'ocean',
    'plant', 'queen', 'river', 'stone', 'train',
    'unity', 'vivid', 'wheat', 'xenon', 'yield', 'zebra'
];

exports.handler = async (event) => {
    try {
        const path = event.path || event.rawPath; // fallback if event.path is undefined
        const httpMethod = event.httpMethod || event.requestContext?.http?.method;

        if (!path || !httpMethod) {
            throw new Error('Missing path or HTTP method in request event');
        }

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
                return buildResponse(404, { error: 'Endpoint not found' })
        }
    } catch (error) {
        console.error('Error:', error);

        return buildResponse(
            error.statusCode || 500,
            {
                error: error.message || 'Internal server error',
                ...(error.details && { details: error.details })
            },
        );
    }
};


// =====================
// Route Handlers
// =====================

async function handleCallback(event) {
    const { code } = event.queryStringParameters || {};
    console.log(event.queryStringParameters)
    if (!code) {
        return buildResponse(400, {
            message: 'Missing code or state parameters',
            details: { required: ['code', 'state'] },
        });
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


    const response = {
        tempToken: tempToken,
        nextStep: "qna",
        message: "Step 1 complete. Please proceed to Q&A verification."
    };
    const htmlForm = `
<!DOCTYPE html>
<html>
<head>
    <title>Processing Authentication...</title>
    <style>
        body { font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .container { text-align: center; padding: 2rem; background: rgba(255,255,255,0.1); border-radius: 20px; backdrop-filter: blur(10px); }
        .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h2>Processing Authentication...</h2>
        <p>Redirecting to your application...</p>
    </div>
    
    <form id="authForm" data-auth="true" style="display: none;">
        <input type="hidden" name="tempToken" value="${response.tempToken}">
        <input type="hidden" name="nextStep" value="${response.nextStep}">
        <input type="hidden" name="message" value="${response.message}">
    </form>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('authForm');
            const formData = new FormData(form);
            const authData = {
                tempToken: formData.get('tempToken'),
                nextStep: formData.get('nextStep'),
                message: formData.get('message')
            };
            
            // Base64 encode the data for secure URL transport
            const dataString = btoa(JSON.stringify(authData));
            
            // Redirect to React app after a short delay
            setTimeout(() => {
                window.location.href = \`http://localhost:5173/auth/qna/callback?data=\${dataString}\`;
            }, 1500);
        });
    </script>
</body>
</html>`;

    return buildHtmlResponse(htmlForm);
}

async function handleQna(event) {
    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return buildResponse(200, { message: 'Success' });
    }

    if (!event.body) {
        return buildResponse(400, { message: 'Missing request body' });
    }

    const { tempToken, answers } = JSON.parse(event.body);

    if (!tempToken || !answers) {
        return buildResponse(400, { 
            message: 'Missing tempToken or answers', 
            details: { required: ['tempToken', 'answers'] },
        });
    }

    // Retrieve session
    const session = await getSession(tempToken);
    if (!session || !session.step1Complete) {
        return buildResponse(401, { message: 'Invalid session or step 1 not complete' });
    }

    // Check if user has existing Q&A answers
    const existingAnswers = await getUserQnaAnswers(session.userId);

    if (!existingAnswers) {
        // First time signup - store the Q&A answers
        try {
            await storeQnaAnswers(session.userId, answers);

            // Update session to mark step 2 as complete
            await dynamoClient.update({
                TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
                Key: { tempToken },
                UpdateExpression: 'SET step2Complete = :true',
                ExpressionAttributeValues: { ':true': true }
            }).promise();

            return buildResponse(200, {
                    tempToken,
                    nextStep: 'cipher',
                    message: 'Q&A answers stored successfully. Step 2 complete. Please proceed to cipher verification.',
                    isFirstTimeSetup: true
                });
        } catch (error) {
            return buildResponse(error.statusCode || 500, {
                error: error.message || 'Internal server error',
                ...(error.details && { details: error.details }),
            });
        }
    } else {
        // Existing user - verify Q&A answers
        const isQnaValid = await verifyQnaAnswers(session.userId, answers);
        if (!isQnaValid) {
            return buildResponse(error.statusCode || 500, {
                error: error.message || 'Internal server error',
                ...(error.details && { details: error.details })
            });
        }

        const randomWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
        const randomShift = Math.floor(Math.random() * 25) + 1; // shift between 1 and 25
        const cipherChallenge = caesarShift(randomWord, randomShift);

        // Store cipher challenge and answer shift in DynamoDB (or update session)
        await dynamoClient.update({
            TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
            Key: { tempToken },
            UpdateExpression: 'SET step2Complete = :true, cipherOriginal = :word, cipherShift = :shift, cipherChallenge = :challenge',
            ExpressionAttributeValues: {
                ':true': true,
                ':word': randomWord,
                ':shift': randomShift,
                ':challenge': cipherChallenge
            }
        }).promise();

        // Return the challenge with the response
        return buildResponse(200, {
            tempToken,
            nextStep: 'cipher',
            cipherChallenge,
            message: 'Step 2 complete. Please solve the cipher challenge.',
            isFirstTimeSetup: !existingAnswers // keep your existing logic here
        });
    }
}

async function handleCipher(event) {
    if (!event.body) {
        return buildResponse(400, { message: 'Missing request body' });
    }

    const { tempToken, cipherResponse } = JSON.parse(event.body);

    if (!tempToken || !cipherResponse) {
        return buildResponse(400, {
            message: 'Missing tempToken or cipherResponse',
            details: { required: ['tempToken', 'cipherResponse'] },
        });
    }

    // Retrieve session
    const session = await getSession(tempToken);
    if (!session || !session.step1Complete || !session.step2Complete) {
        return buildResponse(401, { message: 'Invalid session or previous steps not complete' });
    }

    // Verify cipher by passing original word and shift stored in session
    const cipherData = {
        cipherOriginal: session.cipherOriginal,
        cipherShift: session.cipherShift
    };

    const isCipherValid = verifyCipherLogic(cipherResponse, cipherData);
    if (!isCipherValid) {
        return buildResponse(403, { message: 'Cipher verification failed' });
    }

    // All steps complete - delete session and return tokens
    await dynamoClient.delete({
        TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
        Key: { tempToken }
    }).promise();

    return buildResponse(
        200, 
        {
            accessToken: session.cognitoTokens.access_token,
            idToken: session.cognitoTokens.id_token,
            refreshToken: session.cognitoTokens.refresh_token,
            message: 'Authentication complete!'
        },
    );
}


async function handleStatus(event) {
    const { tempToken } = event.queryStringParameters || {};

    if (!tempToken) {
        return buildResponse(400, {
            message: 'Missing tempToken parameter',
            details: { required: ['tempToken'] },
        });
    }

    const session = await getSession(tempToken);
    if (!session) {
        return buildResponse(404, { message: 'Session not found' });
    }

    return buildResponse(
        200, 
        {
            step1Complete: session.step1Complete,
            step2Complete: session.step2Complete,
            step3Complete: session.step3Complete,
            currentStep: getCurrentStep(session)
        }
    );
}

// =====================
// Helper Functions
// =====================

// Caesar cipher encode function
function caesarShift(word, shift) {
    return word.split('').map(char => {
        const code = char.charCodeAt(0);
        if (code >= 97 && code <= 122) { // a-z
            return String.fromCharCode(((code - 97 + shift) % 26) + 97);
        }
        return char;
    }).join('');
}

// Caesar cipher decode function
function caesarUnshift(word, shift) {
    return caesarShift(word, (26 - shift) % 26);
}

function verifyCipherLogic(userResponse, cipherData) {
    const { cipherOriginal, cipherShift } = cipherData;

    // Decode user's response by shifting backward
    const decodedResponse = caesarUnshift(userResponse.toLowerCase().trim(), cipherShift);

    // Compare with original word
    return decodedResponse === cipherOriginal;
}


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
        return buildResponse(404, { message: 'User Q&A data not found' });
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
        return buildResponse(404, { message: 'User cipher data not found' });
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

async function getUserQnaAnswers(userId) {
    const result = await dynamoClient.get({
        TableName: process.env.QNA_TABLE || 'UserSecurityQuestions',
        Key: { userId }
    }).promise();

    return result.Item;
}

async function storeQnaAnswers(userId, answers) {
    const answersArray = Array.isArray(answers)
        ? answers
        : Object.values(answers); // fallback if answers is an object

    const hashedAnswers = answersArray.map(ans => hashAnswer(ans));

    await dynamoClient.put({
        TableName: process.env.QNA_TABLE || 'UserSecurityQuestions',
        Item: {
            userId,
            hashedAnswers
        }
    }).promise();
}
