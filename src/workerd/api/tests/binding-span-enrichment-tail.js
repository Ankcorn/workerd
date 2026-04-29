// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

// Streaming tail worker for binding-span-enrichment tests.
//
// Wraps createHierarchyAwareCollector and additionally collects tag attributes
// and handles the 'span.name' rename signal emitted by addSpanUpdateName.
// The `validate` test runs after waitForCompletion() so all outcome events
// have fired and all span data is present.

import assert from 'node:assert';
import {
  createHierarchyAwareCollector,
  findSpanByName,
} from 'instrumentation-test-helper';

const collector = createHierarchyAwareCollector();

export default {
  tailStream(onsetEvent, env, ctx) {
    const inner = collector.tailStream(onsetEvent, env, ctx);
    return (event) => {
      // Collect tag attributes onto spans (createHierarchyAwareCollector doesn't do this).
      if (event.event.type === 'attributes') {
        const spanKey = `${event.invocationId}#${event.spanContext.spanId}`;
        const span = collector.state.spans.get(spanKey);
        if (span) {
          if (!span.attributes) span.attributes = {};
          for (const { name, value } of event.event.info) {
            if (name === 'span.name') {
              // Runtime-emitted rename signal from ctx.tracing.setBindingSpan().
              span.name = String(value);
            } else {
              span.attributes[name] = value;
            }
          }
        }
      }
      return inner?.(event);
    };
  },
};

export const validate = {
  async test() {
    await collector.waitForCompletion();
    const { state } = collector;

    // ---- Test 1: noPolicyEnrichmentIsIgnored ----
    // calleeNoPolicy.tryEnrich() called setBindingSpan but the runtime must
    // have silently ignored it — no span named 'should.not.appear'.
    const bogusSpan = [...state.spans.values()].find(
      (s) => s.name === 'should.not.appear'
    );
    assert.strictEqual(
      bogusSpan,
      undefined,
      'Enrichment must be silently ignored when no spanEnrichmentPolicy is configured'
    );

    // ---- Test 2: withPolicySpanIsRenamed ----
    // callee called setBindingSpan({ name: 'ai_gateway.run', attributes: {...} }).
    // The jsRpcSession span must have been renamed and carry the allowed attributes.
    const enrichedSpan = findSpanByName(state, 'ai_gateway.run');
    assert.ok(enrichedSpan, 'Expected a span named "ai_gateway.run" in the STW stream');
    

    assert.strictEqual(
      enrichedSpan.attributes?.['gen_ai.request.model'],
      'text-embedding-3-small',
      'gen_ai.request.model attribute must be present'
    );
    assert.strictEqual(
      Number(enrichedSpan.attributes?.['gen_ai.usage.input_tokens']),
      42,
      'gen_ai.usage.input_tokens attribute must be present'
    );
    assert.strictEqual(
      enrichedSpan.attributes?.['cf.aig.gateway_id'],
      'my-gateway',
      'cf.aig.gateway_id attribute must be present'
    );
    assert.strictEqual(enrichedSpan.closed, true, 'enriched span must be closed');

    console.log('All binding-span-enrichment tests passed!');
  },
};
