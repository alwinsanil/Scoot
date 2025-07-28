//feedback-service.js
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Natural language processing libraries
const Sentiment = require('sentiment');
const natural = require('natural');
const vader = require('vader-sentiment');

const FEEDBACK_TABLE = process.env.FEEDBACK_TABLE || 'vehicle-feedback';
const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE || 'vehicle-reservations';

/**
 * Dedicated service for handling feedback operations with sentiment analysis
 */
class FeedbackService {
    
    async submitFeedback(feedbackData, userInfo) {
        console.log('Submitting feedback with sentiment analysis:', feedbackData.subject);
        
        // Validate required fields
        const requiredFields = ['reservationId', 'vehicleId', 'rating', 'subject', 'message'];
        for (const field of requiredFields) {
            if (!feedbackData[field]) {
                throw { statusCode: 400, message: `${field} is required` };
            }
        }

        // Validate rating
        if (feedbackData.rating < 1 || feedbackData.rating > 5) {
            throw { statusCode: 400, message: 'Rating must be between 1 and 5' };
        }

        // Verify reservation exists and belongs to user
        await this.validateReservation(feedbackData.reservationId, userInfo);

        // Check if feedback already exists for this reservation
        const existingFeedback = await this.checkExistingFeedback(feedbackData.reservationId, userInfo.userId);
        if (existingFeedback) {
            throw { statusCode: 409, message: 'Feedback already exists for this reservation' };
        }

        // Analyze sentiment of the feedback
        const sentimentAnalysis = await this.analyzeFeedbackSentiment(
            feedbackData.subject, 
            feedbackData.message
        );

        const feedbackId = this.generateFeedbackId();
        const timestamp = new Date().toISOString();

        const feedback = {
            feedbackId: feedbackId,
            userId: userInfo.userId,
            userEmail: userInfo.email,
            reservationId: feedbackData.reservationId,
            vehicleId: feedbackData.vehicleId,
            vehicleType: feedbackData.vehicleType,
            vehicleModel: feedbackData.vehicleModel,
            rating: parseInt(feedbackData.rating),
            category: feedbackData.category || 'overall',
            subject: feedbackData.subject.trim(),
            message: feedbackData.message.trim(),
            wouldRecommend: feedbackData.wouldRecommend !== false,
            issues: feedbackData.issues || [],
            
            // Sentiment analysis results
            sentiment: sentimentAnalysis.sentiment,
            sentimentScore: sentimentAnalysis.score,
            sentimentConfidence: sentimentAnalysis.confidence,
            keyPhrases: sentimentAnalysis.keyPhrases,
            emotions: sentimentAnalysis.emotions,
            
            // Metadata
            analysisVersion: '1.0',
            createdAt: timestamp,
            updatedAt: timestamp
        };

        // Store feedback with sentiment data
        const params = {
            TableName: FEEDBACK_TABLE,
            Item: feedback,
            ConditionExpression: 'attribute_not_exists(feedbackId)'
        };

        await dynamodb.put(params).promise();

        // Log sentiment for monitoring/analytics
        console.log(`Feedback sentiment analysis: ${sentimentAnalysis.sentiment} (${sentimentAnalysis.confidence})`);

        return {
            success: true,
            feedback: feedback,
            sentimentSummary: {
                sentiment: sentimentAnalysis.sentiment,
                confidence: sentimentAnalysis.confidence,
                keyThemes: sentimentAnalysis.keyPhrases.slice(0, 3) // Top 3 themes
            },
            message: 'Feedback submitted and analyzed successfully'
        };
    }

    async analyzeFeedbackSentiment(subject, message) {
        try {
            // Combine subject and message for comprehensive analysis
            const fullText = `${subject}. ${message}`;
            
            // Use multiple sentiment analysis approaches for better accuracy
            const sentimentResults = this.runMultipleSentimentAnalysis(fullText);
            
            // Extract key phrases and themes
            const keyPhrases = this.extractKeyPhrases(fullText);
            
            // Detect emotions and issues
            const emotions = this.detectEmotions(fullText);
            const issues = this.detectIssues(fullText);

            return {
                sentiment: sentimentResults.primarySentiment,
                score: sentimentResults.confidence,
                confidence: sentimentResults.confidenceLevel,
                allScores: sentimentResults.allScores,
                keyPhrases: keyPhrases,
                emotions: emotions,
                detectedIssues: issues,
                analysisBreakdown: sentimentResults.breakdown
            };

        } catch (error) {
            console.error('Error analyzing sentiment:', error);
            
            // Fallback to basic analysis
            return this.getFallbackSentiment(subject, message);
        }
    }

    runMultipleSentimentAnalysis(text) {
        // 1. Sentiment.js analysis
        const sentiment = new Sentiment();
        const sentimentResult = sentiment.analyze(text);
        
        // 2. VADER sentiment analysis (more social media aware)
        const vaderResult = vader.SentimentIntensityAnalyzer.polarity_scores(text);
        
        // 3. Natural.js sentiment analysis
        const naturalAnalyzer = new natural.SentimentAnalyzer('English', 
            natural.PorterStemmer, 'afinn');
        const naturalTokens = natural.WordTokenizer().tokenize(text.toLowerCase());
        const naturalScore = naturalAnalyzer.getSentiment(naturalTokens);

        // Combine results for more accurate sentiment
        const combinedAnalysis = this.combineAnalysisResults({
            sentiment: sentimentResult,
            vader: vaderResult,
            natural: naturalScore
        });

        return combinedAnalysis;
    }

    combineAnalysisResults(results) {
        const { sentiment, vader, natural } = results;
        
        // Normalize scores to -1 to 1 scale
        const sentimentNormalized = Math.max(-1, Math.min(1, sentiment.score / 10));
        const vaderNormalized = vader.compound;
        const naturalNormalized = natural || 0;
        
        // Weighted average (VADER is generally more accurate for social text)
        const weightedScore = (
            sentimentNormalized * 0.3 + 
            vaderNormalized * 0.5 + 
            naturalNormalized * 0.2
        );

        // Determine primary sentiment
        let primarySentiment;
        let confidenceLevel;
        
        if (weightedScore > 0.1) {
            primarySentiment = 'POSITIVE';
        } else if (weightedScore < -0.1) {
            primarySentiment = 'NEGATIVE';
        } else {
            primarySentiment = 'NEUTRAL';
        }

        // Check for mixed sentiment (high positive AND negative scores)
        if (vader.pos > 0.5 && vader.neg > 0.5) {
            primarySentiment = 'MIXED';
        }

        // Determine confidence level
        const absScore = Math.abs(weightedScore);
        if (absScore > 0.6) confidenceLevel = 'HIGH';
        else if (absScore > 0.3) confidenceLevel = 'MEDIUM';
        else confidenceLevel = 'LOW';

        return {
            primarySentiment,
            confidence: Math.round(Math.abs(weightedScore) * 100) / 100,
            confidenceLevel,
            allScores: {
                positive: Math.round(Math.max(0, weightedScore) * 100) / 100,
                negative: Math.round(Math.abs(Math.min(0, weightedScore)) * 100) / 100,
                neutral: Math.round((1 - Math.abs(weightedScore)) * 100) / 100,
                mixed: vader.pos > 0.5 && vader.neg > 0.5 ? 0.7 : 0.1
            },
            breakdown: {
                sentimentjs: {
                    score: sentimentResult.score,
                    comparative: sentimentResult.comparative,
                    words: sentimentResult.words
                },
                vader: {
                    compound: vader.compound,
                    positive: vader.pos,
                    negative: vader.neg,
                    neutral: vader.neu
                },
                natural: naturalNormalized,
                combined: weightedScore
            }
        };
    }

    extractKeyPhrases(text) {
        // Use natural.js for key phrase extraction
        const tokenizer = new natural.WordTokenizer();
        const tokens = tokenizer.tokenize(text.toLowerCase());
        
        // Remove stop words
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their']);
        
        const meaningfulTokens = tokens.filter(token => 
            token.length > 2 && !stopWords.has(token) && isNaN(token)
        );
        
        // Calculate word frequency
        const wordFreq = {};
        meaningfulTokens.forEach(token => {
            wordFreq[token] = (wordFreq[token] || 0) + 1;
        });
        
        // Get top phrases
        const keyPhrases = Object.entries(wordFreq)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
            
        // Also look for bigrams (two-word phrases)
        const bigrams = natural.NGrams.bigrams(meaningfulTokens);
        const bigramPhrases = bigrams
            .map(pair => pair.join(' '))
            .slice(0, 5);
            
        return [...keyPhrases, ...bigramPhrases];
    }

    detectEmotions(text) {
        // Simple emotion detection based on keywords
        const emotionKeywords = {
            joy: ['happy', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'perfect', 'awesome', 'brilliant'],
            anger: ['angry', 'mad', 'furious', 'annoyed', 'irritated', 'frustrated', 'outraged', 'livid'],
            sadness: ['sad', 'disappointed', 'upset', 'depressed', 'unhappy', 'miserable', 'devastated'],
            fear: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'terrified', 'concerned'],
            surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected', 'sudden'],
            disgust: ['disgusting', 'awful', 'terrible', 'horrible', 'gross', 'revolting', 'appalling'],
            trust: ['reliable', 'trustworthy', 'dependable', 'confident', 'secure', 'safe'],
            anticipation: ['excited', 'eager', 'looking forward', 'anticipating', 'hopeful']
        };
        
        const textLower = text.toLowerCase();
        const detectedEmotions = [];
        
        Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
            const matches = keywords.filter(keyword => textLower.includes(keyword));
            if (matches.length > 0) {
                detectedEmotions.push({
                    emotion,
                    confidence: Math.min(matches.length / keywords.length, 1),
                    keywords: matches
                });
            }
        });
        
        return detectedEmotions.sort((a, b) => b.confidence - a.confidence);
    }

    detectIssues(text) {
        // Detect common vehicle/service issues
        const issueKeywords = {
            cleanliness: ['dirty', 'messy', 'unclean', 'filthy', 'stained', 'smelly', 'odor'],
            mechanical: ['broken', 'malfunction', 'not working', 'engine', 'battery', 'flat tire', 'dead'],
            customer_service: ['rude', 'unhelpful', 'poor service', 'staff', 'support', 'representative'],
            pricing: ['expensive', 'overpriced', 'costly', 'fee', 'charge', 'billing', 'payment'],
            availability: ['unavailable', 'booked', 'no vehicles', 'shortage', 'wait time'],
            app_website: ['app', 'website', 'booking', 'technical', 'glitch', 'error', 'bug'],
            comfort: ['uncomfortable', 'cramped', 'small', 'seat', 'space', 'tight'],
            safety: ['unsafe', 'dangerous', 'security', 'theft', 'accident', 'risk']
        };
        
        const textLower = text.toLowerCase();
        const detectedIssues = [];
        
        Object.entries(issueKeywords).forEach(([issue, keywords]) => {
            const matches = keywords.filter(keyword => textLower.includes(keyword));
            if (matches.length > 0) {
                detectedIssues.push({
                    category: issue,
                    severity: matches.length > 2 ? 'high' : matches.length > 1 ? 'medium' : 'low',
                    keywords: matches
                });
            }
        });
        
        return detectedIssues;
    }

    getFallbackSentiment(subject, message) {
        // Enhanced keyword-based fallback analysis
        const text = `${subject} ${message}`.toLowerCase();
        
        const sentimentWords = {
            positive: {
                strong: ['excellent', 'outstanding', 'amazing', 'fantastic', 'perfect', 'incredible', 'awesome', 'brilliant'],
                moderate: ['good', 'great', 'nice', 'fine', 'okay', 'decent', 'satisfactory', 'pleasant'],
                mild: ['alright', 'acceptable', 'reasonable', 'fair', 'adequate']
            },
            negative: {
                strong: ['terrible', 'awful', 'horrible', 'disgusting', 'appalling', 'atrocious', 'dreadful'],
                moderate: ['bad', 'poor', 'disappointing', 'unsatisfactory', 'inadequate', 'problematic'],
                mild: ['mediocre', 'subpar', 'below average', 'not great', 'could be better']
            }
        };
        
        let positiveScore = 0;
        let negativeScore = 0;
        
        // Calculate weighted scores
        Object.entries(sentimentWords.positive).forEach(([intensity, words]) => {
            const multiplier = intensity === 'strong' ? 3 : intensity === 'moderate' ? 2 : 1;
            words.forEach(word => {
                if (text.includes(word)) positiveScore += multiplier;
            });
        });
        
        Object.entries(sentimentWords.negative).forEach(([intensity, words]) => {
            const multiplier = intensity === 'strong' ? 3 : intensity === 'moderate' ? 2 : 1;
            words.forEach(word => {
                if (text.includes(word)) negativeScore += multiplier;
            });
        });
        
        // Determine sentiment
        let sentiment = 'NEUTRAL';
        let score = 0.5;
        let confidence = 'LOW';
        
        const totalScore = positiveScore + negativeScore;
        
        if (totalScore > 0) {
            if (positiveScore > negativeScore * 1.5) {
                sentiment = 'POSITIVE';
                score = Math.min(0.9, 0.5 + (positiveScore / (totalScore + 5)));
                confidence = positiveScore > 4 ? 'HIGH' : positiveScore > 2 ? 'MEDIUM' : 'LOW';
            } else if (negativeScore > positiveScore * 1.5) {
                sentiment = 'NEGATIVE';
                score = Math.min(0.9, 0.5 + (negativeScore / (totalScore + 5)));
                confidence = negativeScore > 4 ? 'HIGH' : negativeScore > 2 ? 'MEDIUM' : 'LOW';
            } else if (positiveScore > 0 && negativeScore > 0) {
                sentiment = 'MIXED';
                score = 0.6;
                confidence = 'MEDIUM';
            }
        }
        
        return {
            sentiment: sentiment,
            score: score,
            confidence: confidence,
            allScores: {
                positive: sentiment === 'POSITIVE' ? score : positiveScore / 10,
                negative: sentiment === 'NEGATIVE' ? score : negativeScore / 10,
                neutral: sentiment === 'NEUTRAL' ? score : 0.3,
                mixed: sentiment === 'MIXED' ? score : 0.1
            },
            keyPhrases: [],
            detectedIssues: [],
            analysisBreakdown: {
                method: 'fallback_keyword_analysis',
                positiveWords: positiveScore,
                negativeWords: negativeScore
            }
        };
    }

    async getFeedbackAnalytics(userInfo, queryParams) {
        console.log('Getting feedback analytics for user:', userInfo.userId);
        
        const params = {
            TableName: FEEDBACK_TABLE,
            FilterExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userInfo.userId
            }
        };

        const result = await dynamodb.scan(params).promise();
        const feedback = result.Items || [];
        
        // Calculate analytics
        const analytics = this.calculateFeedbackAnalytics(feedback);
        
        return {
            success: true,
            analytics: analytics,
            totalFeedback: feedback.length,
            message: 'Feedback analytics retrieved successfully'
        };
    }

    calculateFeedbackAnalytics(feedbackList) {
        if (feedbackList.length === 0) {
            return {
                averageRating: 0,
                sentimentDistribution: { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 },
                recommendationRate: 0,
                topIssues: [],
                recentTrends: 'insufficient-data'
            };
        }

        // Calculate average rating
        const averageRating = feedbackList.reduce((sum, item) => sum + item.rating, 0) / feedbackList.length;
        
        // Sentiment distribution
        const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 };
        feedbackList.forEach(item => {
            if (item.sentiment) {
                sentimentCounts[item.sentiment]++;
            }
        });

        // Recommendation rate
        const recommendCount = feedbackList.filter(item => item.wouldRecommend).length;
        const recommendationRate = (recommendCount / feedbackList.length) * 100;

        // Top issues
        const issueCount = {};
        feedbackList.forEach(item => {
            if (item.issues && Array.isArray(item.issues)) {
                item.issues.forEach(issue => {
                    issueCount[issue] = (issueCount[issue] || 0) + 1;
                });
            }
        });
        
        const topIssues = Object.entries(issueCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([issue, count]) => ({ issue, count }));

        // Recent trends (last 30 days vs previous 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const recentFeedback = feedbackList.filter(item => 
            new Date(item.createdAt) >= thirtyDaysAgo
        );
        
        const previousFeedback = feedbackList.filter(item => {
            const date = new Date(item.createdAt);
            return date >= sixtyDaysAgo && date < thirtyDaysAgo;
        });

        let trend = 'stable';
        if (recentFeedback.length > 0 && previousFeedback.length > 0) {
            const recentAvg = recentFeedback.reduce((sum, item) => sum + item.rating, 0) / recentFeedback.length;
            const previousAvg = previousFeedback.reduce((sum, item) => sum + item.rating, 0) / previousFeedback.length;
            
            if (recentAvg > previousAvg + 0.3) trend = 'improving';
            else if (recentAvg < previousAvg - 0.3) trend = 'declining';
        }

        return {
            averageRating: Math.round(averageRating * 100) / 100,
            sentimentDistribution: sentimentCounts,
            recommendationRate: Math.round(recommendationRate * 100) / 100,
            topIssues: topIssues,
            recentTrends: trend,
            totalAnalyzed: feedbackList.length,
            sentimentConfidenceHigh: feedbackList.filter(item => item.sentimentConfidence === 'HIGH').length
        };
    }

    // Helper methods
    async validateReservation(reservationId, userInfo) {
        const params = {
            TableName: RESERVATIONS_TABLE,
            FilterExpression: 'reservationId = :reservationId AND userId = :userId',
            ExpressionAttributeValues: {
                ':reservationId': reservationId,
                ':userId': userInfo.userId
            }
        };

        const result = await dynamodb.scan(params).promise();
        
        if (!result.Items || result.Items.length === 0) {
            throw { statusCode: 404, message: 'Reservation not found' };
        }

        const reservation = result.Items[0];
        if (reservation.status !== 'completed') {
            throw { statusCode: 400, message: 'Can only provide feedback for completed reservations' };
        }

        return reservation;
    }

    async checkExistingFeedback(reservationId, userId) {
        const params = {
            TableName: FEEDBACK_TABLE,
            FilterExpression: 'reservationId = :reservationId AND userId = :userId',
            ExpressionAttributeValues: {
                ':reservationId': reservationId,
                ':userId': userId
            }
        };

        const result = await dynamodb.scan(params).promise();
        return result.Items && result.Items.length > 0;
    }

    generateFeedbackId() {
        return 'feedback_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
}

module.exports = new FeedbackService();