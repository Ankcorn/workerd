// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
import * as assert from 'node:assert';

let result;

export default {
  async tailStream(onsetEvent, env) {
    const info = onsetEvent.event.info;
    if (info?.type !== 'jsrpc' || result !== undefined) return;

    const proto = Object.getPrototypeOf(info);
    result = {
      type: info.type,
      protoIsObjectPrototype: proto === Object.prototype,
    };

    try {
      await env.RECEIVER.capture(info);
      result.rpcOk = true;
    } catch (err) {
      result.rpcOk = false;
      result.errorName = err?.name;
      result.errorMessage = err?.message;
    }
  },
};

export const test = {
  async test(ctrl, env) {
    await env.RECEIVER.reset();
    result = undefined;

    assert.strictEqual(await env.CALLEE_RPC.ping(), 'ok');
    await scheduler.wait(100);

    assert.ok(result, 'missing jsrpc onset.info result');
    assert.strictEqual(result.type, 'jsrpc');
    assert.strictEqual(
      result.protoIsObjectPrototype,
      true,
      'jsrpc onset.info should be a plain object'
    );
    assert.strictEqual(result.rpcOk, true);
  },
};
