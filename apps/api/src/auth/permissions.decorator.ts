import { SetMetadata } from '@nestjs/common';
import type { Permission } from './rbac.js';

export const PERMISSIONS_KEY = 'resqnet:permissions';

/** Guards a route with the permissions the caller's role must hold. */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
