import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';
import requestIp from 'request-ip';
import { DateTime } from 'luxon';

declare global {
    namespace Express {
        interface Request {
            userTimezone?: string;
            formatTime: (date: Date | string | number) => string;
        }
    }
}

export const timeMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        // 1. Get client IP
        const clientIp = requestIp.getClientIp(req) || '127.0.0.1';
        
        // 2. Lookup Timezone
        const geo = clientIp !== '127.0.0.1' ? geoip.lookup(clientIp) : null;
        const timezone = geo?.timezone || 'UTC';
        
        req.userTimezone = timezone;

        // 3. Helper function to format time (English only)
        req.formatTime = (date: Date | string | number) => {
            try {
                const d = date instanceof Date ? date : new Date(date);
                if (isNaN(d.getTime())) return 'N/A';
                
                return DateTime.fromJSDate(d)
                    .setZone(timezone)
                    .setLocale('en-US')
                    .toFormat('hh:mm a'); 
            } catch (innerErr) {
                console.error('formatTime helper error:', innerErr);
                return 'N/A';
            }
        };
    } catch (err) {
        console.error('Timezone middleware critical error:', err);
        // Fallback to safe defaults to prevent crashing the whole request
        req.userTimezone = 'UTC';
        req.formatTime = () => 'N/A';
    }

    next();
};
