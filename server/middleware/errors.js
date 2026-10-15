export function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    let status = error.statusCode || error.status || 500;
    if (error.name === 'CastError' || error.name === 'ValidationError') status = 400;
    if (error.code === 11000) status = 409;
    if (error.code === 'LIMIT_FILE_SIZE') status = 413;
    if (error.name === 'MulterError' && status === 500) status = 400;
    const message = status >= 500 ? 'Server unavailable. Please try again.'
        : error.code === 11000 ? 'A user with that email already exists' : error.message;
    res.status(status).json({ success: false, message });
}
