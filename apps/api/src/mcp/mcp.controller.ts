import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpService } from './mcp.service';

@Controller('mcp')
@UseGuards(McpAuthGuard)
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @All()
  handle(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    return this.mcp.handle(req, res);
  }
}
