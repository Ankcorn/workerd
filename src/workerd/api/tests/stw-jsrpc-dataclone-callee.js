// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
import { WorkerEntrypoint } from 'cloudflare:workers';

export class RpcEntrypoint extends WorkerEntrypoint {
  async ping() {
    return 'ok';
  }
}
