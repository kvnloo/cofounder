import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * OAuth PKCE utility for Anthropic Claude authentication
 * Based on the same implementation used by Claude Code
 */

const OAUTH_CONFIG = {
    authorizationUrl: 'https://claude.ai/oauth/authorize',
    tokenUrl: 'https://console.anthropic.com/v1/oauth/token',
    clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
    redirectUri: 'https://console.anthropic.com/oauth/code/callback'
};

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length = 128) {
    return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

/**
 * Generate SHA-256 hash for PKCE code challenge
 */
function generateCodeChallenge(codeVerifier) {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Generate OAuth authorization URL with PKCE parameters
 */
export function generateAuthUrl() {
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(128);
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    const params = new URLSearchParams({
        client_id: OAUTH_CONFIG.clientId,
        response_type: 'code',
        redirect_uri: OAUTH_CONFIG.redirectUri,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
    });
    
    const authUrl = `${OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;
    
    return {
        authUrl,
        state,
        codeVerifier
    };
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(authorizationCode, codeVerifier, state) {
    try {
        const response = await fetch(OAUTH_CONFIG.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: OAUTH_CONFIG.clientId,
                code: authorizationCode,
                redirect_uri: OAUTH_CONFIG.redirectUri,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
        }

        const tokens = await response.json();
        
        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in,
            tokenType: tokens.token_type,
            scope: tokens.scope,
            expiresAt: Date.now() + (tokens.expires_in * 1000)
        };
    } catch (error) {
        throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken) {
    try {
        const response = await fetch(OAUTH_CONFIG.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: OAUTH_CONFIG.clientId,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
        }

        const tokens = await response.json();
        
        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || refreshToken, // Keep old refresh token if not provided
            expiresIn: tokens.expires_in,
            tokenType: tokens.token_type,
            scope: tokens.scope,
            expiresAt: Date.now() + (tokens.expires_in * 1000)
        };
    } catch (error) {
        throw new Error(`Failed to refresh token: ${error.message}`);
    }
}

/**
 * Validate if access token is still valid
 */
export function isTokenExpired(expiresAt) {
    // Consider token expired if it expires within the next 5 minutes
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() >= (expiresAt - bufferTime);
}