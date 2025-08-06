import { Pool } from 'pg';
declare const pool: Pool;
export declare const testConnection: () => Promise<boolean>;
export declare const executeTransaction: (queries: Array<{
    text: string;
    params?: any[];
}>) => Promise<any[]>;
export { pool };
//# sourceMappingURL=database.d.ts.map