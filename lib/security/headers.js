/**
 * Security Headers
 * Comprehensive security headers for production
 */

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer-when-downgrade",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": process.env.NODE_ENV === "production" 
    ? "max-age=31536000; includeSubDomains; preload" 
    : undefined,
};

// CSP for production (adjust as needed)
const CSP_HEADER = process.env.NODE_ENV === "production"
  ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com https://api.stripe.com; frame-src https://js.stripe.com;"
  : undefined;

export function applySecurityHeaders(response) {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });
  
  if (CSP_HEADER) {
    response.headers.set("Content-Security-Policy", CSP_HEADER);
  }
  
  return response;
}

export function applyNodeSecurityHeaders(res) {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value) {
      res.setHeader(key, value);
    }
  });
  
  if (CSP_HEADER) {
    res.setHeader("Content-Security-Policy", CSP_HEADER);
  }
  
  return res;
}

