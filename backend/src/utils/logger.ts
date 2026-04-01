import winston from 'winston';

const logLevel = process.env.NODE_ENV === 'production' ? 'info' : process.env.NODE_ENV === 'test' ? 'error' : 'debug';

const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf((info: winston.Logform.TransformableInfo) => {
        return `${info.timestamp} [${info.level}]: ${info.message}`;
    })
);

const transports: winston.transport[] = [
    new winston.transports.Console({ level: logLevel })
];

if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5
        })
    );
    transports.push(
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5
        })
    );
}

export const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    transports
});

export default logger;
