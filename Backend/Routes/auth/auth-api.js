const AWS = require('aws-sdk');
const crypto = require('crypto');
const axios = require('axios');
const { buildResponse, buildHtmlResponse } = require('./utils/response');

const dynamoClient = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const WORD_BANK = [
    'apple', 'bread', 'chair', 'drink', 'eagle',
    'flame', 'grape', 'house', 'ideal', 'jolly',
    'knife', 'lemon', 'mango', 'noble', 'ocean',
    'plant', 'queen', 'river', 'stone', 'train',
    'unity', 'vivid', 'wheat', 'xenon', 'yield', 'zebra'
];

exports.handler = async (event) => {
    try {
        const path = event.path || event.rawPath;
        const httpMethod = event.httpMethod || event.requestContext?.http?.method;

        if (!path || !httpMethod) {
            throw new Error('Missing path or HTTP method in request event');
        }

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
// SNS Email Helper - Individual User Topics
// =====================

async function sendEmailNotification(userEmail, userName, notificationType) {
    if (!userEmail) {
        console.warn('No user email provided, skipping notification');
        return;
    }

    try {
        // Create unique topic name for this user
        const userTopicName = `user-${userEmail.replace(/[@.]/g, '-')}`;
        
        // Create or get user-specific topic
        const topicResult = await sns.createTopic({
            Name: userTopicName
        }).promise();
        
        const userTopicArn = topicResult.TopicArn;
        console.log('User topic ARN:', userTopicArn);

        // Check if user already has a confirmed subscription
        const subscriptions = await sns.listSubscriptionsByTopic({
            TopicArn: userTopicArn
        }).promise();

        const existingSubscription = subscriptions.Subscriptions.find(
            sub => sub.Protocol === 'email' && 
                   sub.Endpoint === userEmail && 
                   sub.SubscriptionArn !== 'PendingConfirmation'
        );

        // Only subscribe if no confirmed subscription exists
        if (!existingSubscription) {
            console.log('No confirmed subscription found, creating new subscription');
            
            const subscribeResult = await sns.subscribe({
                TopicArn: userTopicArn,
                Protocol: 'email',
                Endpoint: userEmail
            }).promise();
            
            console.log('Subscription created:', subscribeResult.SubscriptionArn);
            console.log('User will receive confirmation email first');
            
            // For new subscriptions, don't send the actual message yet
            // User needs to confirm first
            if (notificationType === 'registration') {
                console.log('New user - they will get welcome email after confirming subscription');
                return { 
                    status: 'subscription_pending',
                    message: 'User will receive confirmation email first, then welcome email'
                };
            }
        } else {
            console.log('Confirmed subscription exists, sending message directly');
        }

        // Prepare message
        let subject, message;
        
        switch (notificationType) {
            case 'registration':
                subject = 'Welcome to DalScooter! 🛴';
                message = `Hello ${userName},\n\nWelcome to DalScooter! 🎉\n\nYour account has been successfully registered and verified. You can now start using our platform to book scooters and explore the city!\n\nWhat you can do next:\n• Download our mobile app\n• Find nearby scooters\n• Start your first ride\n\nIf you have any questions, feel free to contact our support team.\n\nHappy riding!\nThe DalScooter Team 🛴`;
                break;
            case 'login':
                subject = 'Login Alert - DalScooter';
                message = `Hello ${userName},\n\nYou have successfully logged into your DalScooter account.\n\nLogin details:\n• Time: ${new Date().toLocaleString()}\n• Account: ${userEmail}\n\nIf this wasn't you, please contact our support team immediately.\n\nStay safe and ride responsibly!\nThe DalScooter Team`;
                break;
            default:
                subject = 'DalScooter Account Activity';
                message = `Hello ${userName},\n\nThere has been activity on your DalScooter account.\n\nActivity time: ${new Date().toLocaleString()}\n\nIf you have any concerns, please contact our support team.\n\nBest regards,\nThe DalScooter Team`;
        }

        // Only send if subscription is confirmed
        if (existingSubscription) {
            const publishResult = await sns.publish({
                TopicArn: userTopicArn,
                Message: message,
                Subject: subject
            }).promise();

            console.log('✅ Email notification sent to:', userEmail);
            console.log('Message ID:', publishResult.MessageId);
            
            return {
                status: 'sent',
                messageId: publishResult.MessageId,
                email: userEmail
            };
        } else {
            console.log('⏳ Subscription pending confirmation, message not sent yet');
            return {
                status: 'subscription_pending',
                message: 'User needs to confirm subscription first'
            };
        }

    } catch (error) {
        console.error('❌ Failed to send email notification:', error);
        console.error('User email:', userEmail);
        return {
            status: 'error',
            error: error.message
        };
    }
}

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
        userEmail: userInfo.email,
        userName: userInfo.name || userInfo.email,
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
            
            const dataString = btoa(JSON.stringify(authData));
            
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

    const session = await getSession(tempToken);
    if (!session || !session.step1Complete) {
        return buildResponse(401, { message: 'Invalid session or step 1 not complete' });
    }

    const existingAnswers = await getUserQnaAnswers(session.userId);
    const randomWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    const randomShift = Math.floor(Math.random() * 25) + 1;
    const cipherChallenge = caesarShift(randomWord, randomShift);

    if (!existingAnswers) {
        // First time signup - store the Q&A answers
        try {
            await storeQnaAnswers(session.userId, answers);

            await dynamoClient.update({
                TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
                Key: { tempToken },
                UpdateExpression: 'SET step2Complete = :true, cipherOriginal = :word, cipherShift = :shift, cipherChallenge = :challenge, isFirstTime = :first',
                ExpressionAttributeValues: {
                    ':true': true,
                    ':word': randomWord,
                    ':shift': randomShift,
                    ':challenge': cipherChallenge,
                    ':first': true
                }
            }).promise();

            return buildResponse(200, {
                tempToken,
                nextStep: 'cipher',
                cipherChallenge,
                cipherShift: randomShift,
                message: 'Q&A answers stored successfully. Step 2 complete. Please solve the cipher challenge.',
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
            return buildResponse(403, {
                error: 'Q&A verification failed',
                message: 'One or more security question answers are incorrect'
            });
        }

        await dynamoClient.update({
            TableName: process.env.SESSIONS_TABLE || 'AuthSessions',
            Key: { tempToken },
            UpdateExpression: 'SET step2Complete = :true, cipherOriginal = :word, cipherShift = :shift, cipherChallenge = :challenge, isFirstTime = :first',
            ExpressionAttributeValues: {
                ':true': true,
                ':word': randomWord,
                ':shift': randomShift,
                ':challenge': cipherChallenge,
                ':first': false
            }
        }).promise();

        return buildResponse(200, {
            tempToken,
            nextStep: 'cipher',
            cipherChallenge,
            cipherShift: randomShift,
            message: 'Step 2 complete. Please solve the cipher challenge.',
            isFirstTimeSetup: false
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

    const session = await getSession(tempToken);
    if (!session || !session.step1Complete || !session.step2Complete) {
        return buildResponse(401, { message: 'Invalid session or previous steps not complete' });
    }

    const cipherData = {
        cipherOriginal: session.cipherOriginal,
        cipherShift: session.cipherShift
    };

    const isCipherValid = verifyCipherLogic(cipherResponse, cipherData);
    if (!isCipherValid) {
        return buildResponse(403, { message: 'Cipher verification failed' });
    }

    // 🎯 SEND EMAIL NOTIFICATION HERE - Authentication successful!
    const notificationType = session.isFirstTime ? 'registration' : 'login';
    await sendEmailNotification(session.userEmail, session.userName, notificationType);

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
            message: 'Authentication complete! Welcome email sent.',
            emailSent: true
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
// Helper Functions (unchanged)
// =====================

function caesarShift(word, shift) {
    return word.split('').map(char => {
        const code = char.charCodeAt(0);
        if (code >= 97 && code <= 122) {
            return String.fromCharCode(((code - 97 + shift) % 26) + 97);
        }
        return char;
    }).join('');
}

function caesarUnshift(word, shift) {
    return caesarShift(word, (26 - shift) % 26);
}

function verifyCipherLogic(userResponse, cipherData) {
    const { cipherOriginal, cipherShift } = cipherData;
    const normalizedUserResponse = userResponse.toLowerCase().trim();
    const normalizedOriginal = cipherOriginal.toLowerCase().trim();
    return normalizedUserResponse === normalizedOriginal;
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
        return false;
    }

    return answers.every((answer, index) =>
        hashAnswer(answer) === userQna.Item.hashedAnswers[index]
    );
}

function hashAnswer(answer) {
    return crypto.createHash('sha256').update(answer.toLowerCase().trim()).digest('hex');
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
        : Object.values(answers);

    const hashedAnswers = answersArray.map(ans => hashAnswer(ans));

    await dynamoClient.put({
        TableName: process.env.QNA_TABLE || 'UserSecurityQuestions',
        Item: {
            userId,
            hashedAnswers
        }
    }).promise();
}