import { Type } from '@sinclair/typebox';

export const CreateTenantBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  slug: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' }),
});

export const TenantResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  status: Type.String(),
  createdAt: Type.String(),
});

export const CreateTenantResponse = Type.Object({
  tenant: TenantResponse,
  apiKey: Type.Object({
    id: Type.String(),
    secret: Type.String({ description: 'Shown exactly once — store it securely.' }),
    keyPrefix: Type.String(),
  }),
  genesisHash: Type.String(),
});

export const IssueKeyBody = Type.Object({
  label: Type.Optional(Type.String({ maxLength: 200 })),
});

export const IssueKeyResponse = Type.Object({
  id: Type.String(),
  secret: Type.String(),
  keyPrefix: Type.String(),
});
