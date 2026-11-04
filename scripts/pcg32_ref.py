#!/usr/bin/env python3
"""
Independent reference implementation of PCG32 (XSH-RR) with 64-bit state.
Derived from published PCG paper (Melissa O'Neill, 2014) and pcg_basic.c.
"""

MASK64 = (1 << 64) - 1
MULT = 6364136223846793005

class PCG32Ref:
    def __init__(self, initstate: int, initseq: int):
        self.inc = ((initseq << 1) | 1) & MASK64
        self.state = 0
        self.step()
        self.state = (self.state + initstate) & MASK64
        self.step()

    def step(self):
        self.state = (self.state * MULT + self.inc) & MASK64

    def next_u32(self) -> int:
        oldstate = self.state
        self.step()
        xorshifted = (((oldstate >> 18) ^ oldstate) >> 27) & 0xFFFFFFFF
        rot = oldstate >> 59
        return ((xorshifted >> rot) | (xorshifted << ((32 - rot) & 31))) & 0xFFFFFFFF

def main():
    rng = PCG32Ref(42, 54)
    expected = [
        0xa15c02b7,
        0x7b47f409,
        0xba1d3330,
        0x83d2f293,
        0xbfa4784b,
        0xcbed606e,
    ]
    actual = [rng.next_u32() for _ in range(6)]
    print("Reference check seeded (42, 54):")
    for i, (act, exp) in enumerate(zip(actual, expected)):
        print(f"[{i}] actual: {hex(act)} == expected: {hex(exp)} ({act == exp})")
        assert act == exp, f"Mismatch at index {i}: {hex(act)} != {hex(exp)}"
    print("All 6 reference outputs match successfully.")

if __name__ == "__main__":
    main()
