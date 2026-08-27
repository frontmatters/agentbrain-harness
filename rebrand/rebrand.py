#!/usr/bin/env python3
"""Re-derive the agentbrain-harness rebrand on top of an upstream snapshot.

The fork does not merge the rebrand from upstream; it regenerates it. That keeps
an upstream sync to its real content changes instead of thousands of rename
conflicts, and it is why every rule lives in rules.json rather than in a commit.

  python3 rebrand/rebrand.py --check    report what a run would change, touch nothing
  python3 rebrand/rebrand.py --apply    rewrite file contents and rename paths
  python3 rebrand/rebrand.py --verify   fail if any upstream name survives

Add --drop-locale zh to delete the Chinese translation corpus and its pairing
records in the same pass.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SHIELD = '\x00%d\x00'


def load_rules() -> dict:
    with open(os.path.join(HERE, 'rules.json'), encoding='utf8') as handle:
        return json.load(handle)


class Rebrander:
    """Applies rules.json to a working tree."""

    def __init__(self, rules: dict) -> None:
        self.skip_dirs = set(rules['skip_dirs'])
        self.skip_paths = [entry['path'] for entry in rules['skip_paths']]
        self.binary = set(rules['binary_suffixes'])
        self.keep = re.compile('|'.join(rules['keep']['patterns']))
        self.rules = [(re.compile(r['find']), r['replace'], r['name']) for r in rules['rules']]
        self.path_rules = [(re.compile(r['find']), r['replace']) for r in rules['path_renames']]

    def skipped(self, path: str) -> bool:
        rel = os.path.relpath(path, REPO).replace(os.sep, '/')
        return any(rel.startswith(prefix) for prefix in self.skip_paths)

    def transform(self, text: str) -> tuple[str, dict[str, int]]:
        """Apply every rule, leaving kept patterns byte-identical."""
        shields: list[str] = []

        def hide(match: re.Match[str]) -> str:
            shields.append(match.group(0))
            return SHIELD % (len(shields) - 1)

        guarded = self.keep.sub(hide, text)
        hits: dict[str, int] = {}
        for pattern, replacement, name in self.rules:
            guarded, count = pattern.subn(replacement, guarded)
            if count:
                hits[name] = hits.get(name, 0) + count
        restored = re.sub(r'\x00(\d+)\x00', lambda m: shields[int(m.group(1))], guarded)
        return restored, hits

    def files(self):
        for dirpath, dirnames, filenames in os.walk(REPO):
            dirnames[:] = [d for d in dirnames if d not in self.skip_dirs]
            for name in filenames:
                path = os.path.join(dirpath, name)
                if self.skipped(path) or os.path.splitext(name)[1].lower() in self.binary:
                    continue
                yield path

    def renames(self) -> list[tuple[str, str]]:
        pairs = []
        for dirpath, dirnames, filenames in os.walk(REPO):
            dirnames[:] = [d for d in dirnames if d not in self.skip_dirs]
            for name in dirnames + filenames:
                path = os.path.join(dirpath, name)
                if self.skipped(path):
                    continue
                renamed = name
                for pattern, replacement in self.path_rules:
                    renamed = pattern.sub(replacement, renamed)
                if renamed != name:
                    pairs.append((path, os.path.join(dirpath, renamed)))
        # Deepest first, so renaming a parent never invalidates a queued child.
        pairs.sort(key=lambda pair: pair[0].count(os.sep), reverse=True)
        return pairs


def rename_paths(pairs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Rename each path, refusing any target that already exists.

    `git mv src dst` treats an existing directory `dst` as a destination to move
    *into*, so a stale target silently yields `dst/src` and still exits 0. That
    produces a package whose manifest name no longer matches its location, which
    surfaces much later as an unresolvable workspace dependency. Checking first is
    the only way to tell the two cases apart.

    @param pairs - (old, new) paths, deepest first.
    @returns The pairs that were refused because their target already existed.
    """
    blocked = []
    for old, new in pairs:
        if os.path.exists(new):
            blocked.append((old, new))
            continue
        moved = subprocess.run(['git', 'mv', old, new], cwd=REPO, check=False,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if moved.returncode != 0 and os.path.exists(old):
            os.rename(old, new)
        if os.path.exists(old):
            blocked.append((old, new))
    return blocked


def retire_language(tag: str, rebrander: Rebrander, apply: bool) -> tuple[int, int]:
    """Remove one secondary language's content, keeping the i18n system intact.

    The bilingual pairing machinery — the sibling `foo.md` / `foo.<tag>.md` layout,
    the `.i18n.yaml` consistency record, and the gate that checks them — is what
    makes a second language maintainable, so none of it is removed here. Only this
    language's prose goes. A pairing record describes a pair that now has one side,
    so it goes with its translation; `verify-translation-pairing --write` recreates
    a record when the replacement translation is written.
    """
    translations = 0
    records = 0
    for path in list(rebrander.files()):
        name = os.path.basename(path)
        if name.endswith(f'.{tag}.md'):
            translations += 1
            if apply:
                os.remove(path)
                record = path[: -len(f'.{tag}.md')] + '.i18n.yaml'
                if os.path.exists(record):
                    records += 1
                    os.remove(record)
        elif name.endswith('.i18n.yaml') and not apply:
            stem = path[: -len('.i18n.yaml')]
            if os.path.exists(f'{stem}.{tag}.md'):
                records += 1
    return translations, records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='report changes, write nothing')
    parser.add_argument('--apply', action='store_true', help='rewrite the working tree')
    parser.add_argument('--verify', action='store_true', help='exit non-zero if upstream names survive')
    parser.add_argument('--retire-language', metavar='TAG',
                        help='remove one secondary language\'s translations, e.g. zh; '
                             'the i18n pairing system itself is kept')
    args = parser.parse_args()
    if not (args.check or args.apply or args.verify):
        parser.error('choose --check, --apply or --verify')

    rebrander = Rebrander(load_rules())

    if args.verify:
        survivors = 0
        for path in rebrander.files():
            try:
                text = open(path, encoding='utf8').read()
            except (UnicodeDecodeError, OSError):
                continue
            _, hits = rebrander.transform(text)
            if hits:
                survivors += sum(hits.values())
                print(f'  {os.path.relpath(path, REPO)}: {hits}')
        print(f'verify: {survivors} upstream name(s) remain')
        return 1 if survivors else 0

    totals: dict[str, int] = {}
    files = 0
    for path in rebrander.files():
        try:
            text = open(path, encoding='utf8').read()
        except (UnicodeDecodeError, OSError):
            continue
        updated, hits = rebrander.transform(text)
        if not hits:
            continue
        files += 1
        for name, count in hits.items():
            totals[name] = totals.get(name, 0) + count
        if args.apply:
            open(path, 'w', encoding='utf8').write(updated)

    for name, count in sorted(totals.items(), key=lambda item: -item[1]):
        print(f'  {count:>6}  {name}')
    print(f'{sum(totals.values())} replacements in {files} files')

    pairs = rebrander.renames()
    print(f'{len(pairs)} path rename(s)')
    if args.apply:
        blocked = rename_paths(pairs)
        if blocked:
            print('\nrefusing to rename onto existing paths:', file=sys.stderr)
            for old, new in blocked:
                print(f'  {os.path.relpath(old, REPO)}\n    -> {os.path.relpath(new, REPO)} already exists',
                      file=sys.stderr)
            print('\nUsually a directory left behind by another branch: node_modules and other\n'
                  'ignored content survives a checkout, so the target name can still exist while\n'
                  'git shows a clean tree. Remove the listed paths (git clean -xfd) and re-run.',
                  file=sys.stderr)
            return 1

    if args.retire_language:
        translations, records = retire_language(args.retire_language, rebrander, args.apply)
        verb = 'removed' if args.apply else 'would be removed'
        print(f'{translations} .{args.retire_language}.md translation(s) and '
              f'{records} pairing record(s) {verb}; i18n system kept')

    if args.apply:
        print('\napplied — now run the manual steps in rebrand/README.md')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
