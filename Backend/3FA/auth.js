// Lambda 1: Handle Cognito Callback (Step 1)
// This runs after successful Cognito authentication
exports.cognitoCallbackHandler = async (event) => {
    const { code, state } = event.queryStringParameters;
    
    try {
        // Exchange code for Cognito tokens
        const cognitoTokens = await exchangeCodeForTokens(code);
        const userInfo = await getUserInfoFromToken(cognitoTokens.access_token);
        
        // Generate temporary session token
        const tempToken = generateTempToken();
        const sessionData = {
            tempToken,
            userId: userInfo.sub,
            cognitoTokens: cognitoTokens, // Store securely
            step1Complete: true,
            step2Complete: false,
            step3Complete: false,
            createdAt: Date.now(),
            expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes
        };
        
        // Store in DynamoDB
        await dynamoClient.put({
            TableName: 'AuthSessions',
            Item: sessionData
        }).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                tempToken,
                nextStep: 'qna',
                message: 'Step 1 complete. Please proceed to Q&A verification.'
            })
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Authentication failed' })
        };
    }
};

// Lambda 2: Handle Q&A Verification (Step 2)
exports.qnaVerificationHandler = async (event) => {
    const { tempToken, answers } = JSON.parse(event.body);
    
    try {
        // Retrieve session
        const session = await getSession(tempToken);
        if (!session || !session.step1Complete) {
            throw new Error('Invalid session or step 1 not complete');
        }
        
        // Verify Q&A answers
        const isQnaValid = await verifyQnaAnswers(session.userId, answers);
        if (!isQnaValid) {
            throw new Error('Q&A verification failed');
        }
        
        // Update session
        await dynamoClient.update({
            TableName: 'AuthSessions',
            Key: { tempToken },
            UpdateExpression: 'SET step2Complete = :true',
            ExpressionAttributeValues: { ':true': true }
        }).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                tempToken,
                nextStep: 'cipher',
                message: 'Step 2 complete. Please proceed to cipher verification.'
            })
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Lambda 3: Handle Cipher Verification (Step 3)
exports.cipherVerificationHandler = async (event) => {
    const { tempToken, cipherResponse } = JSON.parse(event.body);
    
    try {
        // Retrieve session
        const session = await getSession(tempToken);
        if (!session || !session.step1Complete || !session.step2Complete) {
            throw new Error('Invalid session or previous steps not complete');
        }
        
        // Verify cipher
        const isCipherValid = await verifyCipherResponse(session.userId, cipherResponse);
        if (!isCipherValid) {
            throw new Error('Cipher verification failed');
        }
        
        // All steps complete - return actual Cognito tokens
        await dynamoClient.update({
            TableName: 'AuthSessions',
            Key: { tempToken },
            UpdateExpression: 'SET step3Complete = :true',
            ExpressionAttributeValues: { ':true': true }
        }).promise();
        
        // Clean up temp session (optional - or let it expire)
        await dynamoClient.delete({
            TableName: 'AuthSessions',
            Key: { tempToken }
        }).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                accessToken: session.cognitoTokens.access_token,
                idToken: session.cognitoTokens.id_token,
                refreshToken: session.cognitoTokens.refresh_token,
                message: 'Authentication complete!'
            })
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Lambda 4: Session Status Checker
exports.sessionStatusHandler = async (event) => {
    const { tempToken } = event.queryStringParameters;
    
    try {
        const session = await getSession(tempToken);
        if (!session) {
            throw new Error('Session not found');
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                step1Complete: session.step1Complete,
                step2Complete: session.step2Complete,
                step3Complete: session.step3Complete,
                currentStep: getCurrentStep(session)
            })
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Helper Functions
const AWS = require('aws-sdk');
const crypto = require('crypto');
const axios = require('axios');

const dynamoClient = new AWS.DynamoDB.DocumentClient();

function generateTempToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function getSession(tempToken) {
    const result = await dynamoClient.get({
        TableName: 'AuthSessions',
        Key: { tempToken }
    }).promise();
    
    if (!result.Item) return null;
    
    // Check expiration
    if (Date.now() > result.Item.expiresAt) {
        await dynamoClient.delete({
            TableName: 'AuthSessions',
            Key: { tempToken }
        }).promise();
        return null;
    }
    
    return result.Item;
}

async function exchangeCodeForTokens(code) {
    // Replace with your Cognito app details
    const tokenEndpoint = `https://${process.env.COGNITO_DOMAIN}/oauth2/token`;
    
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', process.env.REDIRECT_URI);
    params.append('client_id', process.env.COGNITO_CLIENT_ID);
    params.append('client_secret', process.env.COGNITO_CLIENT_SECRET);
    
    const response = await axios.post(tokenEndpoint, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    return response.data;
}

async function getUserInfoFromToken(accessToken) {
    const userInfoEndpoint = `https://${process.env.COGNITO_DOMAIN}/oauth2/userInfo`;
    const response = await axios.get(userInfoEndpoint, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.data;
}

async function verifyQnaAnswers(userId, answers) {
    // Implement your Q&A verification logic
    // This could query another DynamoDB table with user's security questions
    const userQna = await dynamoClient.get({
        TableName: 'UserSecurityQuestions',
        Key: { userId }
    }).promise();
    
    // Compare answers (hash them for security)
    return answers.every((answer, index) => 
        hashAnswer(answer) === userQna.Item.hashedAnswers[index]
    );
}

async function verifyCipherResponse(userId, cipherResponse) {
    // Implement your cipher verification logic
    // This could be a time-based cipher, RSA decryption, etc.
    const userCipher = await dynamoClient.get({
        TableName: 'UserCipherKeys',
        Key: { userId }
    }).promise();
    
    // Verify cipher response
    return verifyCipherLogic(cipherResponse, userCipher.Item.cipherKey);
}

function hashAnswer(answer) {
    return crypto.createHash('sha256').update(answer.toLowerCase().trim()).digest('hex');
}

function verifyCipherLogic(response, key) {
    // Implement your specific cipher verification
    // Example: time-based OTP, RSA signature verification, etc.
    return true; // Placeholder
}

function getCurrentStep(session) {
    if (!session.step1Complete) return 1;
    if (!session.step2Complete) return 2;
    if (!session.step3Complete) return 3;
    return 'complete';
}

// DynamoDB Table Schema (for reference)
/*
AuthSessions Table:
- tempToken (String, Primary Key)
- userId (String)
- cognitoTokens (Map) - contains access_token, id_token, refresh_token
- step1Complete (Boolean)
- step2Complete (Boolean)  
- step3Complete (Boolean)
- createdAt (Number)
- expiresAt (Number, TTL)

UserSecurityQuestions Table:
- userId (String, Primary Key)
- questions (List)
- hashedAnswers (List)

UserCipherKeys Table:
- userId (String, Primary Key)
- cipherKey (String)
- cipherType (String)
*/