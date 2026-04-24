// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
import * as assert from 'node:assert';

const seenModes = new Set();
const seenLogs = [];

function inspectValue(value) {
  const proto =
    value == null || typeof value !== 'object'
      ? null
      : Object.getPrototypeOf(value);

  return {
    typeOf: typeof value,
    isArray: Array.isArray(value),
    protoIsObjectPrototype: proto === Object.prototype,
    protoIsNull: proto === null,
    protoConstructorName: proto?.constructor?.name,
    ownKeys: value && typeof value === 'object' ? Object.keys(value) : [],
    json: (() => {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return `json-failed: ${e}`;
      }
    })(),
  };
}

async function tryCapture(env, mode, variant, payload, inspect) {
  try {
    await env.RECEIVER.capture({ mode, variant, ok: true, payload, inspect });
  } catch (err) {
    await env.RECEIVER.capture({
      mode,
      variant,
      ok: false,
      errorName: err?.name,
      errorMessage: err?.message,
      inspect,
    });
  }
}

export default {
  tailStream(onsetEvent, env) {
    const onset = onsetEvent.event;
    const mode = onset.info?.type;

    return async (event) => {
      if (event.event.type !== 'log') return;
      if (mode !== 'fetch' && mode !== 'jsrpc') return;
      if (seenModes.has(mode)) return;

      seenModes.add(mode);
      seenLogs.push({ mode, message: event.event.message });

      const info = onset.info;
      const inspect = inspectValue(info);

      await tryCapture(env, mode, 'raw-info', info, inspect);
      await tryCapture(env, mode, 'raw-onset', onset, inspect);
      await tryCapture(
        env,
        mode,
        'vega-like',
        {
          event: {
            onset,
            log: event.event,
          },
        },
        inspect
      );
      await tryCapture(env, mode, 'spread-info', { ...info }, inspect);
      await tryCapture(env, mode, 'literal-info', { type: info.type }, inspect);
      await tryCapture(
        env,
        mode,
        'rebuilt-onset',
        {
          ...onset,
          info: { type: info.type },
        },
        inspect
      );
      await tryCapture(
        env,
        mode,
        'json-info',
        JSON.parse(JSON.stringify(info)),
        inspect
      );
    };
  },
};

export const test = {
  async test(ctrl, env) {
    await env.RECEIVER.reset();

    let response = await env.CALLEE.fetch('http://callee/run-fetch');
    assert.strictEqual(await response.text(), 'fetch ok');

    assert.strictEqual(await env.CALLEE_RPC.logViaRpc(), 'jsrpc ok');

    await scheduler.wait(100);

    const results = await env.RECEIVER.getResults();
    console.log('stw-jsrpc-dataclone results:', JSON.stringify(results, null, 2));
    console.log('stw-jsrpc-dataclone seenLogs:', JSON.stringify(seenLogs, null, 2));

    const byModeVariant = new Map(
      results.map((entry) => [`${entry.mode}:${entry.variant}`, entry])
    );

    const fetchRawInfo = byModeVariant.get('fetch:raw-info');
    const jsrpcRawInfo = byModeVariant.get('jsrpc:raw-info');
    const jsrpcLiteralInfo = byModeVariant.get('jsrpc:literal-info');
    const fetchVegaLike = byModeVariant.get('fetch:vega-like');
    const jsrpcVegaLike = byModeVariant.get('jsrpc:vega-like');

    assert.ok(fetchRawInfo, 'missing fetch raw-info result');
    assert.ok(jsrpcRawInfo, 'missing jsrpc raw-info result');
    assert.ok(jsrpcLiteralInfo, 'missing jsrpc literal-info result');
    assert.ok(fetchVegaLike, 'missing fetch vega-like result');
    assert.ok(jsrpcVegaLike, 'missing jsrpc vega-like result');

    assert.strictEqual(fetchRawInfo.ok, true);
    assert.strictEqual(fetchVegaLike.ok, true);
    assert.strictEqual(jsrpcLiteralInfo.ok, true);

    assert.strictEqual(
      fetchRawInfo.inspect.protoIsObjectPrototype,
      true,
      'fetch onset.info should be a plain object'
    );
    assert.strictEqual(
      jsrpcRawInfo.inspect.protoIsObjectPrototype,
      true,
      'jsrpc onset.info should be a plain object'
    );

    // Fixed expectation: raw jsrpc onset.info should be serializable over RPC.
    assert.strictEqual(jsrpcRawInfo.ok, true);
  },
};
