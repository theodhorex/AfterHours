.PHONY: test ts-test contract-test contract-build

test: ts-test contract-test

ts-test:
	node --test packages/sim/test/
	@if [ -d packages/rules/test ]; then node --test packages/rules/test/; fi
	@if [ -d packages/verify/test ]; then node --test packages/verify/test/; fi

contract-test:
	cd contracts/afterhours && cargo test --lib

contract-build:
	cd contracts/afterhours && cargo build --release --target wasm32-unknown-unknown

# Sandbox integration tests (need network once for the sandbox binary). Not part of `make test`.
.PHONY: contract-it
contract-it:
	cd contracts/afterhours && cargo build --release --target wasm32-unknown-unknown
	cd contracts/afterhours && cargo test --test integration -- --test-threads=1
