export declare const socialAuthConfig: {
    google: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        scope: string[];
        authUrl: string;
        tokenUrl: string;
        userInfoUrl: string;
    };
    facebook: {
        appId: string;
        appSecret: string;
        redirectUri: string;
        scope: string[];
        authUrl: string;
        tokenUrl: string;
        userInfoUrl: string;
    };
    cognito: {
        userPoolId: string;
        clientId: string;
        googleProvider: {
            providerName: string;
            providerType: string;
            attributeMapping: {
                email: string;
                given_name: string;
                family_name: string;
                picture: string;
            };
        };
        facebookProvider: {
            providerName: string;
            providerType: string;
            attributeMapping: {
                email: string;
                given_name: string;
                family_name: string;
                picture: string;
            };
        };
    };
};
export declare class SocialAuthUtils {
    static generateAuthUrl(provider: 'google' | 'facebook', state?: string): string;
    static exchangeCodeForToken(provider: 'google' | 'facebook', code: string): Promise<string>;
    static getUserProfile(provider: 'google' | 'facebook', accessToken: string): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        picture?: string;
    }>;
    static createOrUpdateUserFromSocial(profile: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        picture?: string;
    }, provider: 'google' | 'facebook'): Promise<{
        user: any;
        isNewUser: boolean;
    }>;
}
export declare const validateSocialAuthEnvironment: () => void;
//# sourceMappingURL=socialAuth.d.ts.map