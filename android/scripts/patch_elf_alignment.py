#!/usr/bin/env python3
"""
Patch ELF LOAD segment p_align to 16 KB (0x4000) for Google Play's
16 KB page size requirement (Android 15+).

Directly modifies the p_align field in each PT_LOAD program header entry.
Safe to run on prebuilt .so files — only touches the alignment hint, not code or data.

Usage: python3 patch_elf_alignment.py <file.so> [file2.so ...]
"""

import struct
import sys

PT_LOAD = 1
TARGET_ALIGN = 0x4000  # 16 KB


def patch_elf(path):
    with open(path, 'r+b') as f:
        # Verify ELF magic
        if f.read(4) != b'\x7fELF':
            return False

        # ELF class: 1 = 32-bit, 2 = 64-bit
        ei_class = f.read(1)[0]
        if ei_class != 2:
            return False  # Only handle 64-bit ELF (arm64-v8a)

        # Endianness: 1 = little, 2 = big
        endian = '<' if f.read(1)[0] == 1 else '>'

        # e_phoff at ELF header offset 32 (64-bit)
        f.seek(32)
        e_phoff = struct.unpack(endian + 'Q', f.read(8))[0]

        # e_phentsize at offset 54, e_phnum at offset 56
        f.seek(54)
        e_phentsize = struct.unpack(endian + 'H', f.read(2))[0]
        e_phnum = struct.unpack(endian + 'H', f.read(2))[0]

        patched = 0
        for i in range(e_phnum):
            phdr_off = e_phoff + i * e_phentsize
            f.seek(phdr_off)
            p_type = struct.unpack(endian + 'I', f.read(4))[0]

            if p_type == PT_LOAD:
                # p_align is at offset 48 within each 64-bit Phdr entry
                align_off = phdr_off + 48
                f.seek(align_off)
                p_align = struct.unpack(endian + 'Q', f.read(8))[0]
                if p_align < TARGET_ALIGN:
                    f.seek(align_off)
                    f.write(struct.pack(endian + 'Q', TARGET_ALIGN))
                    patched += 1

        return patched > 0


if __name__ == '__main__':
    total = 0
    for path in sys.argv[1:]:
        try:
            if patch_elf(path):
                total += 1
        except Exception as e:
            print(f'Error patching {path}: {e}', file=sys.stderr)
    print(f'Patched {total} of {len(sys.argv) - 1} files to 16 KB alignment')
