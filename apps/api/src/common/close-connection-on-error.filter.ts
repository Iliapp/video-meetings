import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';

// For upload routes. When a request is rejected before its body was read
// (guard 403/404, early 413, extension 415), Node would otherwise keep reading
// and discarding the rest of a possibly 2 GB body to reuse the connection.
// `Connection: close` makes it drop the socket once the error is sent.
@Catch()
export class CloseConnectionOnErrorFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (!request.complete && !response.headersSent) {
      response.setHeader('Connection', 'close');
    }
    super.catch(exception, host);
  }
}
