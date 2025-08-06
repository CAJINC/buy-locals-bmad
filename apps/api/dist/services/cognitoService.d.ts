import { CreateUserRequest, User } from '@buy-locals/shared';
export declare class CognitoService {
    registerUser(userData: CreateUserRequest): Promise<{
        userId: string;
        tempPassword: string;
    }>;
    loginUser(email: string, password: string): Promise<{
        accessToken: string;
        refreshToken: string;
        idToken: string;
    }>;
    refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        idToken: string;
    }>;
    getUser(username: string): Promise<Partial<User>>;
    updateUserProfile(username: string, updates: {
        firstName?: string;
        lastName?: string;
        phone?: string;
    }): Promise<void>;
    forgotPassword(email: string): Promise<void>;
    confirmForgotPassword(email: string, confirmationCode: string, newPassword: string): Promise<void>;
    private calculateSecretHash;
    private generateTempPassword;
}
//# sourceMappingURL=cognitoService.d.ts.map