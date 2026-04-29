// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

// Callee worker for binding-span-enrichment tests.
//
// CalleeEntrypoint — used when the caller binding has NO spanEnrichmentPolicy.
//   Verifies that ctx.tracing is undefined (the runtime must not expose the
//   setBindingSpan API without an EWC-blessed policy).
//
// CalleeEnrichableEntrypoint — used when the caller binding carries a
//   spanEnrichmentPolicy.  Calls ctx.tracing.setBindingSpan() to rename the
//   jsRpcSession span and attach attributes; the caller's STW should reflect
//   the enriched span rather than the raw "jsRpcSession" name.

import { WorkerEntrypoint } from 'cloudflare:workers';

export class CalleeEntrypoint extends WorkerEntrypoint {
  // Calls setBindingSpan and returns whether the call was accepted.
  // Without a spanEnrichmentPolicy on the binding the runtime must silently ignore the call
  // (no enrichment flows to the caller — the span stays named "jsRpcSession").
  async tryEnrich() {
    this.ctx.tracing.setBindingSpan({
      name: 'should.not.appear',
      attributes: { 'cf.aig.sentinel': 'nopolicy' },
    });
    return 'called';
  }
}

export class CalleeEnrichableEntrypoint extends WorkerEntrypoint {
  // Simulates what the AI Gateway worker does: enriches the caller's
  // jsRpcSession span with a meaningful name and gen_ai attributes.
  async run(model) {
    // Must be called before this method returns so it lands on CallResults.
    this.ctx.tracing.setBindingSpan({
      name: 'ai_gateway.run',
      attributes: {
        'gen_ai.request.model': model,
        'gen_ai.usage.input_tokens': 42,
        'cf.aig.gateway_id': 'my-gateway',
      },
    });
    return { answer: 42 };
  }
}
