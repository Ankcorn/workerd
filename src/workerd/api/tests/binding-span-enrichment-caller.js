// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

// Caller worker for binding-span-enrichment tests.
// These tests just trigger the work; assertions about what the STW received
// live in the validate test in binding-span-enrichment-tail.js, which runs
// after all invocations have completed and outcomes have been emitted.

import assert from 'node:assert';

// Test 1: without spanEnrichmentPolicy, setBindingSpan is silently ignored —
// the jsRpcSession span must not be renamed in the STW stream.
export const noPolicyEnrichmentIsIgnored = {
  async test(ctrl, env) {
    const result = await env.calleeNoPolicy.tryEnrich();
    assert.strictEqual(result, 'called');
  },
};

// Test 2: with spanEnrichmentPolicy, the callee renames the span and adds
// attributes. The rename + attributes must appear in the STW stream.
export const withPolicySpanIsRenamed = {
  async test(ctrl, env) {
    const result = await env.calleeWithPolicy.run('text-embedding-3-small');
    assert.deepStrictEqual(result, { answer: 42 });
  },
};
