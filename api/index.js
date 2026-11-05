import { defaultStore } from '../src/store.js';
import { createApiHandler } from '../src/router.js';

const handler = createApiHandler(defaultStore);

export default async function vercelApiEntrypoint(req, res) {
  return handler(req, res);
}
