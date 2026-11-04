import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  fetchCityFromChain,
  compareToChain,
  DEFAULT_NEAR_RPC_URL,
  type ChainCity,
} from "../src/lib/chain.ts";
import {
  TESTNET_CONTRACT_ID,
  TESTNET_CITY_ID,
  TESTNET_ARC_ID,
  TESTNET_SEED,
  TESTNET_STEPS,
  TESTNET_EXPECTED_STATE_ROOT,
  TESTNET_CHECKPOINTS,
  TESTNET_CHECKPOINT_TX_IDS,
  buildExplorerTxUrl,
} from "../src/data/testnet.ts";

function createMockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

function nearRpcSuccessResponse(returnValue: unknown): Response {
  const bytes = Array.from(new TextEncoder().encode(JSON.stringify(returnValue)));
  return jsonResponse({
    jsonrpc: "2.0",
    id: "afterhours-audit",
    result: {
      result: bytes,
      logs: [],
      block_height: 123456,
      block_hash: "mock_block_hash",
    },
  });
}

describe("Chain API & Compare (TDD)", () => {
  const mockCity: ChainCity = {
    city_id: "city-goblin_warrens",
    step: 200,
    state_root: "bc4fe79adc950876fc4cfd873fae3234124bf0d26dc5f059f5029e8798d754ac",
    city_root: "9c3c1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    stage: 1,
    arc_id: "goblin_warrens",
  };

  test("fetchCityFromChain: ok case decodes result bytes to ChainCity", async () => {
    let capturedUrl: string | undefined;
    let capturedBody: string | undefined;

    const fakeFetch = createMockFetch(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body);
      return nearRpcSuccessResponse(mockCity);
    });

    const res = await fetchCityFromChain("afterhours-11041910-theo.testnet", "city-goblin_warrens", fakeFetch);
    assert.equal(res.ok, true);
    assert.equal(res.error, undefined);
    assert.deepEqual(res.city, mockCity);
    assert.equal(capturedUrl, DEFAULT_NEAR_RPC_URL);

    const bodyObj = JSON.parse(capturedBody!);
    assert.equal(bodyObj.method, "query");
    assert.equal(bodyObj.params.request_type, "call_function");
    assert.equal(bodyObj.params.method_name, "get_city");
    assert.equal(bodyObj.params.account_id, "afterhours-11041910-theo.testnet");
  });

  test("fetchCityFromChain: null city returned from contract returns clear error", async () => {
    const fakeFetch = createMockFetch(async () => nearRpcSuccessResponse(null));

    const res = await fetchCityFromChain("afterhours.testnet", "nonexistent-city", fakeFetch);
    assert.equal(res.ok, false);
    assert.equal(res.city, null);
    assert.match(res.error!, /not found on chain.*null/i);
  });

  test("fetchCityFromChain: RPC error response handled with clear message", async () => {
    const fakeFetch = createMockFetch(async () =>
      jsonResponse({
        jsonrpc: "2.0",
        id: "afterhours-audit",
        error: {
          name: "HANDLER_ERROR",
          cause: { name: "UNKNOWN_ACCOUNT" },
          message: "account does not exist",
        },
      })
    );

    const res = await fetchCityFromChain("unknown.testnet", "city-goblin_warrens", fakeFetch);
    assert.equal(res.ok, false);
    assert.equal(res.city, null);
    assert.match(res.error!, /NEAR RPC error/i);
  });

  test("fetchCityFromChain: HTTP error status handled cleanly without throwing", async () => {
    const fakeFetch = createMockFetch(async () =>
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" })
    );

    const res = await fetchCityFromChain("contract.testnet", "city-1", fakeFetch);
    assert.equal(res.ok, false);
    assert.equal(res.city, null);
    assert.match(res.error!, /HTTP 500/i);
  });

  test("fetchCityFromChain: network failure handled cleanly without throwing", async () => {
    const fakeFetch = createMockFetch(async () => {
      throw new Error("Failed to fetch");
    });

    const res = await fetchCityFromChain("contract.testnet", "city-1", fakeFetch);
    assert.equal(res.ok, false);
    assert.equal(res.city, null);
    assert.match(res.error!, /Network error/i);
  });

  test("fetchCityFromChain: timeout handled cleanly with clear timeout message", async () => {
    const fakeFetch = createMockFetch(async (_url, init) => {
      // Simulate aborting via signal
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        if (signal?.aborted) {
          const err = new Error("This operation was aborted");
          err.name = "AbortError";
          reject(err);
          return;
        }
        signal?.addEventListener("abort", () => {
          const err = new Error("This operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const res = await fetchCityFromChain("contract.testnet", "city-1", {
      fetchImpl: fakeFetch,
      timeoutMs: 20,
    });
    assert.equal(res.ok, false);
    assert.equal(res.city, null);
    assert.match(res.error!, /timed out/i);
  });

  test("compareToChain: ok case returns VERIFIED message", () => {
    const result = compareToChain(
      "bc4fe79adc950876fc4cfd873fae3234124bf0d26dc5f059f5029e8798d754ac",
      200,
      mockCity
    );
    assert.equal(result.ok, true);
    assert.equal(
      result.reason,
      "VERIFIED: browser replay root matches NEAR testnet at step 200"
    );
  });

  test("compareToChain: root mismatch includes expected, got, and step", () => {
    const result = compareToChain(
      "0000000000000000000000000000000000000000000000000000000000000000",
      200,
      mockCity
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /MISMATCH/);
    assert.match(result.reason, /step 200/);
    assert.match(result.reason, /expected 0000000000000000000000000000000000000000000000000000000000000000/);
    assert.match(result.reason, /got bc4fe79adc950876fc4cfd873fae3234124bf0d26dc5f059f5029e8798d754ac/);
  });

  test("compareToChain: step mismatch reports expected and got steps", () => {
    const result = compareToChain(
      "bc4fe79adc950876fc4cfd873fae3234124bf0d26dc5f059f5029e8798d754ac",
      160,
      mockCity
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /MISMATCH/);
    assert.match(result.reason, /step mismatch/i);
    assert.match(result.reason, /160/);
    assert.match(result.reason, /200/);
  });

  test("compareToChain: null city reports MISMATCH with expected step", () => {
    const result = compareToChain(
      "bc4fe79adc950876fc4cfd873fae3234124bf0d26dc5f059f5029e8798d754ac",
      200,
      null
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /MISMATCH/);
    assert.match(result.reason, /null/i);
  });
});

describe("Testnet Deployment Constants & Explorer URL", () => {
  test("testnet constants match testnet deployment specs", () => {
    assert.equal(TESTNET_CONTRACT_ID, "afterhours-11041910-theo.testnet");
    assert.equal(TESTNET_CITY_ID, "city-goblin_warrens");
    assert.equal(TESTNET_ARC_ID, "goblin_warrens");
    assert.equal(TESTNET_SEED, "demo");
    assert.equal(TESTNET_STEPS, 200);
    assert.equal(
      TESTNET_EXPECTED_STATE_ROOT,
      "bc4fe79adc950876fc4cfd873fae3234124bf0d26dc5f059f5029e8798d754ac"
    );
    assert.equal(TESTNET_CHECKPOINTS.length, 5);
    assert.equal(TESTNET_CHECKPOINT_TX_IDS.length, 5);
    assert.equal(TESTNET_CHECKPOINTS[0].toStep, 40);
    assert.equal(TESTNET_CHECKPOINTS[4].toStep, 200);
  });

  test("buildExplorerTxUrl creates correct NearBlocks tx URL", () => {
    const tx = "6aPz2kdH2yR12KM3qrUuSNgEyqKnKwkuuYGQtkQWbkuZ";
    const url = buildExplorerTxUrl(tx);
    assert.equal(url, "https://testnet.nearblocks.io/txns/6aPz2kdH2yR12KM3qrUuSNgEyqKnKwkuuYGQtkQWbkuZ");
  });
});
