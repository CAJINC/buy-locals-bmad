import { config } from './environment.js';
export const socialAuthConfig = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: `${config.corsOrigin}/auth/google/callback`,
        scope: ['openid', 'profile', 'email'],
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    },
    facebook: {
        appId: process.env.FACEBOOK_APP_ID || '',
        appSecret: process.env.FACEBOOK_APP_SECRET || '',
        redirectUri: `${config.corsOrigin}/auth/facebook/callback`,
        scope: ['email', 'public_profile'],
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
        userInfoUrl: 'https://graph.facebook.com/v18.0/me',
    },
    cognito: {
        userPoolId: config.cognitoUserPoolId,
        clientId: config.cognitoClientId,
        googleProvider: {
            providerName: 'Google',
            providerType: 'Google',
            attributeMapping: {
                email: 'email',
                given_name: 'given_name',
                family_name: 'family_name',
                picture: 'picture',
            },
        },
        facebookProvider: {
            providerName: 'Facebook',
            providerType: 'Facebook',
            attributeMapping: {
                email: 'email',
                given_name: 'first_name',
                family_name: 'last_name',
                picture: 'picture',
            },
        },
    },
};
export class SocialAuthUtils {
    static generateAuthUrl(provider, state) {
        const providerConfig = socialAuthConfig[provider];
        const params = new URLSearchParams({
            client_id: provider === 'google' ? providerConfig.clientId : providerConfig.appId,
            redirect_uri: providerConfig.redirectUri,
            scope: providerConfig.scope.join(' '),
            response_type: 'code',
            ...(state && { state }),
        });
        return `${providerConfig.authUrl}?${params.toString()}`;
    }
    static async exchangeCodeForToken(provider, code) {
        console.log(`Token exchange for ${provider} with code: ${code}`);
        throw new Error('Social auth token exchange not yet implemented');
    }
    static async getUserProfile(provider, accessToken) {
        console.log(`Get user profile for ${provider} with token: ${accessToken}`);
        throw new Error('Social auth user profile fetching not yet implemented');
    }
    static async createOrUpdateUserFromSocial(profile, provider) {
        console.log(`Create/update user from ${provider} profile:`, profile);
        throw new Error('Social auth user creation not yet implemented');
    }
}
export const validateSocialAuthEnvironment = () => {
    const warnings = [];
    if (!socialAuthConfig.google.clientId) {
        warnings.push('GOOGLE_CLIENT_ID not configured - Google OAuth will not work');
    }
    if (!socialAuthConfig.google.clientSecret) {
        warnings.push('GOOGLE_CLIENT_SECRET not configured - Google OAuth will not work');
    }
    if (!socialAuthConfig.facebook.appId) {
        warnings.push('FACEBOOK_APP_ID not configured - Facebook OAuth will not work');
    }
    if (!socialAuthConfig.facebook.appSecret) {
        warnings.push('FACEBOOK_APP_SECRET not configured - Facebook OAuth will not work');
    }
    if (warnings.length > 0) {
        console.warn('Social Auth Configuration Warnings:');
        warnings.forEach(warning => console.warn(`- ${warning}`));
    }
};
//# sourceMappingURL=socialAuth.js.map