const originOf = (value, name) => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) {
        throw new Error(`${name} must be an HTTP(S) origin without a trailing slash`);
    }
    return value;
};

export function runtimeConfig(env = process.env) {
    const production = env.NODE_ENV === 'production';
    const port = Number(env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
    const appOrigin = originOf(env.APP_ORIGIN || `http://localhost:${port}`, 'APP_ORIGIN');
    const clientOrigin = originOf(env.CLIENT_ORIGIN || env.CLIENT_URL ||
        (production ? appOrigin : 'http://localhost:5173'), 'CLIENT_ORIGIN');
    const sameSite = env.COOKIE_SAME_SITE || 'lax';
    if (!['strict', 'lax', 'none'].includes(sameSite)) throw new Error('Invalid COOKIE_SAME_SITE');
    if (sameSite === 'none' && !production) throw new Error('SameSite=None requires production secure cookies');
    if (production && (!appOrigin.startsWith('https:') || !clientOrigin.startsWith('https:'))) {
        throw new Error('Production origins must use HTTPS');
    }
    return { port, clientOrigin, appOrigin, cookie: {
        httpOnly: true, path: '/', sameSite, secure: production,
        ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    } };
}

export function validateEnvironment(env = process.env) {
    for (const name of ['MONGODB_URI', 'JWT_SECRET_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
        if (!env[name]?.trim()) throw new Error(`Missing required configuration: ${name}`);
    }
    if (!/^mongodb(\+srv)?:\/\//.test(env.MONGODB_URI)) throw new Error('Invalid MONGODB_URI');
    return runtimeConfig(env);
}
