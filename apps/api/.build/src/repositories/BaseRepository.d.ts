import { Pool } from 'pg';
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
}
export interface WhereClause {
    [key: string]: any;
}
export declare abstract class BaseRepository<T> {
    protected pool: Pool;
    protected tableName: string;
    constructor(tableName: string);
    protected query(text: string, params?: any[]): Promise<any>;
    protected transaction(queries: Array<{
        text: string;
        params?: any[];
    }>): Promise<any[]>;
    findById(id: string): Promise<T | null>;
    findAll(options?: QueryOptions): Promise<T[]>;
    count(): Promise<number>;
    create(data: Partial<T>): Promise<T>;
    update(id: string, data: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    findWhere(whereClause: WhereClause, options?: QueryOptions): Promise<T[]>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=BaseRepository.d.ts.map