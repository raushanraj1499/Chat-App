// Bounded fixed windows: rotating addresses cannot evict existing login limits.
export function createAuthLimiter({ windowMs = 15 * 60 * 1000, limit = 20, maxKeys = 10000, now = Date.now } = {}) {
    const windows = new Map();
    return (req, res, next) => {
        const time = now();
        for (const [key, entry] of windows) if (entry.until <= time) windows.delete(key);
        const key = req.ip;
        let entry = windows.get(key);
        if (!entry && windows.size < maxKeys) {
            entry = { count: 0, until: time + windowMs };
            windows.set(key, entry);
        }
        if (!entry || entry.count >= limit) {
            res.set('Retry-After', String(Math.max(1, Math.ceil(((entry?.until || time + windowMs) - time) / 1000))));
            return res.status(429).json({ success: false, message: 'Too many authentication attempts. Please try again later.' });
        }
        entry.count++;
        next();
    };
}
