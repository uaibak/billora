import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type Row = Record<string, any>;

class MemoryPrisma {
  users: Row[] = [];
  organizations: Row[] = [];
  members: Row[] = [];
  businesses: Row[] = [];
  auditLogs: Row[] = [];
  invites: Row[] = [];
  seq = 1;

  next(_prefix: string) { this.seq += 1; return randomUUID(); }
  now() { return new Date(); }

  user = {
    findUnique: async ({ where, select }: any) => {
      const user = this.users.find((row) => row.id === where.id || row.email === where.email) ?? null;
      return user && select ? pick(user, select) : user;
    },
    create: async ({ data }: any) => {
      const user = { id: this.next('user'), role: 'USER', phone: null, createdAt: this.now(), updatedAt: this.now(), ...data };
      this.users.push(user);
      return user;
    },
  };

  organization = {
    create: async ({ data }: any) => {
      const organization = { id: this.next('org'), createdAt: this.now(), updatedAt: this.now(), ...data };
      delete organization.members;
      this.organizations.push(organization);
      if (data.members?.create) this.members.push({ id: this.next('member'), organizationId: organization.id, createdAt: this.now(), updatedAt: this.now(), ...data.members.create });
      return organization;
    },
    findFirst: async ({ where, select }: any = {}) => {
      const organization = this.organizations.find((row) => {
        if (where?.slug && row.slug !== where.slug) return false;
        if (where?.id?.not && row.id === where.id.not) return false;
        return true;
      }) ?? null;
      return organization && select ? pick(organization, select) : organization;
    },
    findMany: async ({ where }: any = {}) => this.organizations.filter((org) => !where?.members?.some?.userId || this.members.some((member) => member.organizationId === org.id && member.userId === where.members.some.userId)),
    update: async ({ where, data }: any) => {
      const organization = this.organizations.find((row) => row.id === where.id);
      if (!organization) throw new Error('Organization not found');
      Object.assign(organization, data, { updatedAt: this.now() });
      return organization;
    },
  };

  organizationMember = {
    findFirst: async ({ where, select }: any) => {
      const member = this.members.find((row) => row.userId === where.userId) ?? null;
      return member && select ? pick(member, select) : member;
    },
    findUnique: async ({ where, include }: any) => {
      const key = where.organizationId_userId;
      const member = this.members.find((row) => row.organizationId === key.organizationId && row.userId === key.userId) ?? null;
      return member && include?.organization ? { ...member, organization: this.organizations.find((row) => row.id === member.organizationId) } : member;
    },
    findMany: async ({ where }: any) => this.members.filter((row) => row.organizationId === where.organizationId),
    upsert: async ({ where, create, update }: any) => {
      const key = where.organizationId_userId;
      let member = this.members.find((row) => row.organizationId === key.organizationId && row.userId === key.userId);
      if (member) Object.assign(member, update, { updatedAt: this.now() });
      else {
        const created = { id: this.next('member'), createdAt: this.now(), updatedAt: this.now(), ...create };
        this.members.push(created);
        member = created;
      }
      return member;
    },
  };

  organizationInvite = {
    create: async ({ data }: any) => {
      const invite = { id: this.next('invite'), status: 'PENDING', createdAt: this.now(), updatedAt: this.now(), ...data };
      this.invites.push(invite);
      return invite;
    },
    findFirst: async ({ where }: any) => this.invites.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null,
    findMany: async ({ where }: any) => this.invites.filter((row) => !where?.organizationId || row.organizationId === where.organizationId),
    findUnique: async ({ where }: any) => this.invites.find((row) => row.id === where.id || row.token === where.token) ?? null,
    update: async ({ where, data }: any) => {
      const invite = this.invites.find((row) => row.id === where.id);
      if (!invite) throw new Error('Invite not found');
      Object.assign(invite, data, { updatedAt: this.now() });
      return invite;
    },
  };

  business = {
    create: async ({ data }: any) => {
      const business = { id: this.next('business'), createdAt: this.now(), updatedAt: this.now(), ...data };
      this.businesses.push(business);
      return business;
    },
    findMany: async ({ where, skip = 0, take = 20 }: any) => this.filteredBusinesses(where).slice(skip, skip + take).map((row) => ({ ...row, organization: pick(this.organizations.find((org) => org.id === row.organizationId), { id: true, name: true, slug: true }) })),
    count: async ({ where }: any) => this.filteredBusinesses(where).length,
    findFirst: async ({ where, include }: any) => {
      const business = this.filteredBusinesses(where).find((row) => !where.id || row.id === where.id) ?? null;
      return business && include?.organization ? { ...business, organization: pick(this.organizations.find((org) => org.id === business.organizationId), { id: true, name: true, slug: true }) } : business;
    },
    update: async ({ where, data }: any) => {
      const business = this.businesses.find((row) => row.id === where.id);
      if (!business) throw new Error('Business not found');
      Object.assign(business, data, { updatedAt: this.now() });
      return business;
    },
    delete: async ({ where }: any) => {
      const index = this.businesses.findIndex((row) => row.id === where.id);
      const [business] = this.businesses.splice(index, 1);
      return business;
    },
  };

  auditLog = {
    create: async ({ data }: any) => {
      const row = { id: this.next('audit'), createdAt: this.now(), ...data };
      this.auditLogs.push(row);
      return row;
    },
    findMany: async () => this.auditLogs,
    count: async () => this.auditLogs.length,
  };

  async $transaction(input: any) {
    if (Array.isArray(input)) return Promise.all(input);
    return input(this);
  }
  async $connect() {}
  async $disconnect() {}

  filteredBusinesses(where: any = {}) {
    return this.businesses.filter((business) => {
      if (where.id && business.id !== where.id) return false;
      if (where.organizationId && business.organizationId !== where.organizationId) return false;
      const userId = where.organization?.members?.some?.userId;
      if (userId && !this.members.some((member) => member.userId === userId && member.organizationId === business.organizationId)) return false;
      const search = where.OR?.[0]?.name?.contains?.toLowerCase();
      if (search && !business.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }
}

describe('Billora API auth and tenant access', () => {
  let app: INestApplication;
  let prisma: MemoryPrisma;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '7d';
    delete process.env.REDIS_URL;
    prisma = new MemoryPrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a user, sets an auth cookie, and creates an owner organization', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ fullName: 'Umar Akbar', email: 'umar@example.com', password: 'Password123!' })
      .expect(201);

    expect(response.body.user.email).toBe('umar@example.com');
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie']?.[0]).toContain('billora_access_token=');
    expect(prisma.organizations).toHaveLength(1);
    expect(prisma.members[0]).toMatchObject({ userId: response.body.user.id, role: 'OWNER' });
  });

  it('rejects protected routes without a valid session', async () => {
    await request(app.getHttpServer()).get('/businesses').expect(401);
  });

  it('exposes public health and api docs endpoints', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);
  });

  it('logs in with an http-only cookie and returns paginated businesses', async () => {
    const user = await seedUser(prisma, 'owner@example.com');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' })
      .expect(201);

    const cookie = login.headers['set-cookie'];
    await request(app.getHttpServer())
      .post('/businesses')
      .set('Cookie', cookie)
      .send({ name: 'Owner Studio' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/businesses?page=1&limit=10&search=studio')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.meta).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(response.body.data[0]).toMatchObject({ name: 'Owner Studio', organizationId: user.organizationId });
    expect(prisma.auditLogs.some((log) => log.action === 'BUSINESS_CREATED')).toBe(true);
  });

  it('hides another organization business from the current user', async () => {
    const first = await seedUser(prisma, 'first@example.com');
    const second = await seedUser(prisma, 'second@example.com');
    const business = await prisma.business.create({ data: { organizationId: first.organizationId, name: 'Private Business' } });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'second@example.com', password: 'Password123!' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/businesses/${business.id}`)
      .set('Cookie', login.headers['set-cookie'])
      .expect(404);

    expect(second.organizationId).not.toBe(first.organizationId);
  });

  it('creates and cancels organization invites for writable members', async () => {
    await seedUser(prisma, 'owner@example.com');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' })
      .expect(201);
    const organizationId = prisma.organizations[0].id;

    const invite = await request(app.getHttpServer())
      .post(`/organizations/${organizationId}/invites`)
      .set('Cookie', login.headers['set-cookie'])
      .send({ email: 'member@example.com', role: 'MEMBER' })
      .expect(201);

    expect(invite.body.email).toBe('member@example.com');
    expect(invite.body.token).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/organizations/${organizationId}/invites/${invite.body.id}`)
      .set('Cookie', login.headers['set-cookie'])
      .expect(200);

    expect(prisma.invites[0].status).toBe('CANCELLED');
  });

  it('resends and accepts a pending organization invite', async () => {
    const owner = await seedUser(prisma, 'owner@example.com');
    const member = await seedUser(prisma, 'member@example.com');
    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' })
      .expect(201);

    const invite = await request(app.getHttpServer())
      .post(`/organizations/${owner.organizationId}/invites`)
      .set('Cookie', ownerLogin.headers['set-cookie'])
      .send({ email: 'member@example.com', role: 'MEMBER' })
      .expect(201);

    const resent = await request(app.getHttpServer())
      .post(`/organizations/${owner.organizationId}/invites/${invite.body.id}/resend`)
      .set('Cookie', ownerLogin.headers['set-cookie'])
      .expect(201);

    expect(resent.body.token).not.toBe(invite.body.token);

    const memberLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'member@example.com', password: 'Password123!' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/organizations/invites/accept')
      .set('Cookie', memberLogin.headers['set-cookie'])
      .send({ token: resent.body.token })
      .expect(201);

    expect(prisma.members.some((row) => row.organizationId === owner.organizationId && row.userId === member.id && row.role === 'MEMBER')).toBe(true);
    expect(prisma.invites.find((row) => row.id === invite.body.id)?.status).toBe('ACCEPTED');
  });

  it('prevents member role from mutating organization resources', async () => {
    const owner = await seedUser(prisma, 'owner@example.com');
    const member = await seedUser(prisma, 'member@example.com');
    prisma.members.push({ id: prisma.next('member'), organizationId: owner.organizationId, userId: member.id, role: 'MEMBER', createdAt: prisma.now(), updatedAt: prisma.now() });

    const memberLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'member@example.com', password: 'Password123!' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/businesses')
      .set('Cookie', memberLogin.headers['set-cookie'])
      .send({ organizationId: owner.organizationId, name: 'Should Fail' })
      .expect(403);
  });
});

async function seedUser(prisma: MemoryPrisma, email: string) {
  const user = await prisma.user.create({ data: { email, fullName: email.split('@')[0], passwordHash: await bcrypt.hash('Password123!', 12) } });
  const organization = await prisma.organization.create({
    data: {
      ownerId: user.id,
      name: `${user.fullName}'s Organization`,
      slug: `org-${user.id}`,
      members: { create: { userId: user.id, role: 'OWNER' } },
    },
  });
  return { ...user, organizationId: organization.id };
}

function pick(row: Row | undefined, select: Record<string, boolean>) {
  if (!row) return null;
  return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, row[key]]));
}
