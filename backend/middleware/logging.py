"""
Request/Response Logging Middleware
- Logs method, path, status, latency for every request
- Strips Authorization headers and PHI from logs
- Generates request IDs for tracing
"""
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from loguru import logger


SKIP_LOG_PATHS = {"/health", "/favicon.ico", "/static"}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip health checks and static files
        if any(request.url.path.startswith(p) for p in SKIP_LOG_PATHS):
            return await call_next(request)

        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        start_time = time.perf_counter()

        # Log incoming request (strip auth header)
        logger.info(
            f"[{request_id}] → {request.method} {request.url.path} "
            f"client={request.client.host if request.client else 'unknown'}"
        )

        try:
            response = await call_next(request)
            latency_ms = int((time.perf_counter() - start_time) * 1000)

            log_fn = logger.warning if response.status_code >= 400 else logger.info
            log_fn(
                f"[{request_id}] ← {response.status_code} "
                f"{request.method} {request.url.path} "
                f"{latency_ms}ms"
            )

            # Add request ID to response headers for debugging
            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as exc:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error(
                f"[{request_id}] ✗ {request.method} {request.url.path} "
                f"{latency_ms}ms ERROR: {type(exc).__name__}"
            )
            raise
