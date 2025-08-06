import { createClient } from 'redis';
import { config } from '../config/environment.js';
const redisClient = createClient({
    url: config.redisUrl,
});
redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});
export const initializeRedis = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
    return redisClient;
};
export class SessionManager {
    static async blacklistToken(tokenId, expirationTime) {
        try {
            await initializeRedis();
            const key = `${this.TOKEN_BLACKLIST_PREFIX}${tokenId}`;
            const ttl = expirationTime ? Math.floor(expirationTime - Date.now() / 1000) : this.DEFAULT_TTL;
            if (ttl > 0) {
                await redisClient.setEx(key, ttl, 'blacklisted');
            }
        }
        catch (error) {
            console.error('Error blacklisting token:', error);
            throw new Error('Failed to blacklist token');
        }
    }
    static async isTokenBlacklisted(tokenId) {
        try {
            await initializeRedis();
            const key = `${this.TOKEN_BLACKLIST_PREFIX}${tokenId}`;
            const result = await redisClient.get(key);
            return result !== null;
        }
        catch (error) {
            console.error('Error checking token blacklist:', error);
            return false;
        }
    }
    static async storeUserSession(userId, sessionData) {
        try {
            await initializeRedis();
            const key = `${this.USER_SESSION_PREFIX}${userId}`;
            const data = {
                ...sessionData,
                lastActivity: sessionData.lastActivity.toISOString(),
                loginTime: sessionData.loginTime.toISOString(),
            };
            await redisClient.setEx(key, this.DEFAULT_TTL, JSON.stringify(data));
        }
        catch (error) {
            console.error('Error storing user session:', error);
        }
    }
    static async getUserSession(userId) {
        try {
            await initializeRedis();
            const key = `${this.USER_SESSION_PREFIX}${userId}`;
            const data = await redisClient.get(key);
            if (!data)
                return null;
            const sessionData = JSON.parse(data);
            return {
                ...sessionData,
                lastActivity: new Date(sessionData.lastActivity),
                loginTime: new Date(sessionData.loginTime),
            };
        }
        catch (error) {
            console.error('Error getting user session:', error);
            return null;
        }
    }
    static async updateLastActivity(userId) {
        try {
            await initializeRedis();
            const key = `${this.USER_SESSION_PREFIX}${userId}`;
            const existingData = await redisClient.get(key);
            if (existingData) {
                const sessionData = JSON.parse(existingData);
                sessionData.lastActivity = new Date().toISOString();
                await redisClient.setEx(key, this.DEFAULT_TTL, JSON.stringify(sessionData));
            }
        }
        catch (error) {
            console.error('Error updating last activity:', error);
        }
    }
    static async clearUserSession(userId) {
        try {
            await initializeRedis();
            const key = `${this.USER_SESSION_PREFIX}${userId}`;
            await redisClient.del(key);
        }
        catch (error) {
            console.error('Error clearing user session:', error);
            throw new Error('Failed to clear user session');
        }
    }
    static async cleanupExpiredSessions() {
        try {
            await initializeRedis();
            console.log('Session cleanup completed');
        }
        catch (error) {
            console.error('Error during session cleanup:', error);
        }
    }
}
SessionManager.TOKEN_BLACKLIST_PREFIX = 'blacklist:token:';
SessionManager.USER_SESSION_PREFIX = 'session:user:';
SessionManager.DEFAULT_TTL = 24 * 60 * 60;
export { redisClient };
//# sourceMappingURL=sessionUtils.js.map