import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminInitiateAuthCommand, AdminGetUserCommand, AdminUpdateUserAttributesCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand, } from '@aws-sdk/client-cognito-identity-provider';
import { config } from '../config/environment.js';
const cognitoClient = new CognitoIdentityProviderClient({
    region: config.awsRegion,
});
export class CognitoService {
    async registerUser(userData) {
        const tempPassword = this.generateTempPassword();
        const userAttributes = [
            { Name: 'email', Value: userData.email },
            { Name: 'email_verified', Value: 'false' },
            { Name: 'custom:role', Value: userData.role || 'consumer' },
            { Name: 'given_name', Value: userData.firstName },
            { Name: 'family_name', Value: userData.lastName },
        ];
        if (userData.phone) {
            userAttributes.push({ Name: 'phone_number', Value: userData.phone });
        }
        try {
            const createUserCommand = new AdminCreateUserCommand({
                UserPoolId: config.cognitoUserPoolId,
                Username: userData.email,
                UserAttributes: userAttributes,
                TemporaryPassword: tempPassword,
                MessageAction: 'SUPPRESS',
            });
            const createResult = await cognitoClient.send(createUserCommand);
            const setPasswordCommand = new AdminSetUserPasswordCommand({
                UserPoolId: config.cognitoUserPoolId,
                Username: userData.email,
                Password: userData.password,
                Permanent: true,
            });
            await cognitoClient.send(setPasswordCommand);
            return {
                userId: createResult.User?.Username || userData.email,
                tempPassword,
            };
        }
        catch (error) {
            console.error('Error registering user:', error);
            throw new Error('Failed to register user');
        }
    }
    async loginUser(email, password) {
        try {
            const authCommand = new AdminInitiateAuthCommand({
                UserPoolId: config.cognitoUserPoolId,
                ClientId: config.cognitoClientId,
                AuthFlow: 'ADMIN_NO_SRP_AUTH',
                AuthParameters: {
                    USERNAME: email,
                    PASSWORD: password,
                    SECRET_HASH: this.calculateSecretHash(email),
                },
            });
            const authResult = await cognitoClient.send(authCommand);
            if (authResult.AuthenticationResult) {
                return {
                    accessToken: authResult.AuthenticationResult.AccessToken || '',
                    refreshToken: authResult.AuthenticationResult.RefreshToken || '',
                    idToken: authResult.AuthenticationResult.IdToken || '',
                };
            }
            else {
                throw new Error('Authentication failed');
            }
        }
        catch (error) {
            console.error('Error logging in user:', error);
            throw new Error('Invalid credentials');
        }
    }
    async refreshToken(refreshToken) {
        try {
            const refreshCommand = new AdminInitiateAuthCommand({
                UserPoolId: config.cognitoUserPoolId,
                ClientId: config.cognitoClientId,
                AuthFlow: 'REFRESH_TOKEN_AUTH',
                AuthParameters: {
                    REFRESH_TOKEN: refreshToken,
                },
            });
            const refreshResult = await cognitoClient.send(refreshCommand);
            if (refreshResult.AuthenticationResult) {
                return {
                    accessToken: refreshResult.AuthenticationResult.AccessToken || '',
                    idToken: refreshResult.AuthenticationResult.IdToken || '',
                };
            }
            else {
                throw new Error('Token refresh failed');
            }
        }
        catch (error) {
            console.error('Error refreshing token:', error);
            throw new Error('Failed to refresh token');
        }
    }
    async getUser(username) {
        try {
            const getUserCommand = new AdminGetUserCommand({
                UserPoolId: config.cognitoUserPoolId,
                Username: username,
            });
            const result = await cognitoClient.send(getUserCommand);
            const attributes = result.UserAttributes || [];
            const getAttr = (name) => attributes.find(attr => attr.Name === name)?.Value || '';
            return {
                id: result.Username || username,
                email: getAttr('email'),
                role: getAttr('custom:role'),
                profile: {
                    firstName: getAttr('given_name'),
                    lastName: getAttr('family_name'),
                    phone: getAttr('phone_number') || undefined,
                },
                isEmailVerified: getAttr('email_verified') === 'true',
                createdAt: result.UserCreateDate || new Date(),
                updatedAt: result.UserLastModifiedDate || new Date(),
            };
        }
        catch (error) {
            console.error('Error getting user:', error);
            throw new Error('User not found');
        }
    }
    async updateUserProfile(username, updates) {
        try {
            const attributes = [];
            if (updates.firstName) {
                attributes.push({ Name: 'given_name', Value: updates.firstName });
            }
            if (updates.lastName) {
                attributes.push({ Name: 'family_name', Value: updates.lastName });
            }
            if (updates.phone) {
                attributes.push({ Name: 'phone_number', Value: updates.phone });
            }
            if (attributes.length > 0) {
                const updateCommand = new AdminUpdateUserAttributesCommand({
                    UserPoolId: config.cognitoUserPoolId,
                    Username: username,
                    UserAttributes: attributes,
                });
                await cognitoClient.send(updateCommand);
            }
        }
        catch (error) {
            console.error('Error updating user profile:', error);
            throw new Error('Failed to update profile');
        }
    }
    async forgotPassword(email) {
        try {
            const forgotPasswordCommand = new ForgotPasswordCommand({
                ClientId: config.cognitoClientId,
                Username: email,
                SecretHash: this.calculateSecretHash(email),
            });
            await cognitoClient.send(forgotPasswordCommand);
        }
        catch (error) {
            console.error('Error initiating password reset:', error);
            throw new Error('Failed to initiate password reset');
        }
    }
    async confirmForgotPassword(email, confirmationCode, newPassword) {
        try {
            const confirmCommand = new ConfirmForgotPasswordCommand({
                ClientId: config.cognitoClientId,
                Username: email,
                ConfirmationCode: confirmationCode,
                Password: newPassword,
                SecretHash: this.calculateSecretHash(email),
            });
            await cognitoClient.send(confirmCommand);
        }
        catch (error) {
            console.error('Error confirming password reset:', error);
            throw new Error('Failed to reset password');
        }
    }
    calculateSecretHash(username) {
        if (!config.cognitoClientSecret) {
            return '';
        }
        const crypto = require('crypto');
        return crypto
            .createHmac('sha256', config.cognitoClientSecret)
            .update(username + config.cognitoClientId)
            .digest('base64');
    }
    generateTempPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
}
//# sourceMappingURL=cognitoService.js.map