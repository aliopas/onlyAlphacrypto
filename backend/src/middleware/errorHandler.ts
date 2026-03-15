import { Request, Response, NextFunction } from 'express';

// Custom error class
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
    err: AppError & { statusCode?: number; isOperational?: boolean },
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    const statusCode = err.statusCode || 500;
    const message = err.isOperational ? err.message : 'Internal server error';

    if (process.env.NODE_ENV !== 'production') {
        console.error(`[${req.method}] ${req.path} → ${statusCode}: ${err.message}`);
        if (err.stack) console.error(err.stack);
    }

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}
