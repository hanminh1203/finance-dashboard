"""Middleware for unhandled API exceptions."""

import sys
import traceback

from django.http import JsonResponse


class JsonExceptionMiddleware:
    """Print stack traces and return JSON errors for uncaught view exceptions."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        traceback.print_exception(
            type(exception),
            exception,
            exception.__traceback__,
            file=sys.stderr,
        )
        sys.stderr.flush()
        status = getattr(exception, 'status', None)
        if not isinstance(status, int) or not (100 <= status <= 599):
            status = 500
        return JsonResponse(
            {'error': str(exception) or 'Internal server error'},
            status=status,
        )
