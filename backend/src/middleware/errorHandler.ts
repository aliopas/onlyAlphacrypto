import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public isOperational: boolean = true
    ) {
        super(message);
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}

export function errorHandler(
    err: Error & { statusCode?: number; isOperational?: boolean },
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    const appErr = err instanceof AppError ? err : null;
    const statusCode = appErr?.statusCode || 500;
    const message = appErr?.isOperational ? err.message : 'Internal server error';

    if (process.env.NODE_ENV === 'production') {
        logger.error(
            '[ErrorHandler] %s %s → %d: %s',
            req.method,
            req.path,
            statusCode,
            err.message
        );
    } else {
        console.error(`[${req.method}] ${req.path} → ${statusCode}: ${err.message}`);
        if (err.stack) console.error(err.stack);
    }

    res.status(statusCode).json({ error: message });
}
