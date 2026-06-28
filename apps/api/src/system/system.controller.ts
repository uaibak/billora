import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller()
export class SystemController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'billora-api', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('docs/openapi.json')
  openapi() {
    return {
      openapi: '3.0.0',
      info: { title: 'Billora API', version: '0.1.0' },
      servers: [{ url: 'http://localhost:3001' }],
      paths: {
        '/auth/register': { post: { summary: 'Register user' } },
        '/auth/login': { post: { summary: 'Login user' } },
        '/auth/me': { get: { summary: 'Current user' } },
        '/organizations': { get: { summary: 'List organizations' }, post: { summary: 'Create organization' } },
        '/organizations/{id}/members': { get: { summary: 'List organization members' } },
        '/organizations/{id}/invites': { get: { summary: 'List invites' }, post: { summary: 'Create invite' } },
        '/organizations/invites/accept': { post: { summary: 'Accept invite' } },
        '/dashboard/summary': { get: { summary: 'Dashboard summary' } },
        '/businesses': { get: { summary: 'List businesses' }, post: { summary: 'Create business' } },
        '/businesses/{id}/logo': { post: { summary: 'Upload business logo' } },
        '/customers': { get: { summary: 'List customers' }, post: { summary: 'Create customer' } },
        '/invoices': { get: { summary: 'List invoices' }, post: { summary: 'Create invoice' } },
        '/invoices/{id}/pdf': { get: { summary: 'Download invoice document' }, post: { summary: 'Generate invoice document' } },
        '/audit-logs': { get: { summary: 'List audit logs' } },
        '/audit-logs/export': { get: { summary: 'Export audit logs CSV' } },
      },
    };
  }

  @Public()
  @Get('docs')
  @Header('Content-Type', 'text/html')
  docs() {
    return '<!doctype html><html><head><title>Billora API Docs</title><style>body{font-family:system-ui;margin:40px;line-height:1.6}code{background:#f1f5f9;padding:2px 6px;border-radius:6px}</style></head><body><h1>Billora API</h1><p>OpenAPI JSON is available at <a href="/docs/openapi.json"><code>/docs/openapi.json</code></a>.</p><p>Use JWT bearer tokens or the Billora HTTP-only auth cookie for protected endpoints.</p></body></html>';
  }
}
