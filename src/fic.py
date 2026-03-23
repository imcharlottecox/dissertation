import sys
import os
import unicodedata


ZERO_WIDTH = {
    '\u200b': 'ZERO WIDTH SPACE',
    '\u200c': 'ZERO WIDTH NON-JOINER',
    '\u200d': 'ZERO WIDTH JOINER',
    '\u200e': 'LEFT-TO-RIGHT MARK',
    '\u200f': 'RIGHT-TO-LEFT MARK',
    '\u202a': 'LEFT-TO-RIGHT EMBEDDING',
    '\u202b': 'RIGHT-TO-LEFT EMBEDDING',
    '\u202c': 'POP DIRECTIONAL FORMATTING',
    '\u202d': 'LEFT-TO-RIGHT OVERRIDE',
    '\u202e': 'RIGHT-TO-LEFT OVERRIDE',
    '\u2060': 'WORD JOINER',
    '\u2061': 'FUNCTION APPLICATION',
    '\u2062': 'INVISIBLE TIMES',
    '\u2063': 'INVISIBLE SEPARATOR',
    '\u2064': 'INVISIBLE PLUS',
    '\ufeff': 'ZERO WIDTH NO-BREAK SPACE (BOM)',
    '\u00ad': 'SOFT HYPHEN',
    '\u034f': 'COMBINING GRAPHEME JOINER',
    '\u115f': 'HANGUL CHOSEONG FILLER',
    '\u1160': 'HANGUL JUNGSEONG FILLER',
    '\u17b4': 'KHMER VOWEL INHERENT AQ',
    '\u17b5': 'KHMER VOWEL INHERENT AA',
    '\u3164': 'HANGUL FILLER',
    '\ufe00': 'VARIATION SELECTOR-1',
    '\ufe0f': 'VARIATION SELECTOR-16',
}

LOOKALIKES = {
    '\u2013': 'EN DASH (looks like hyphen)',
    '\u2014': 'EM DASH (looks like hyphen)',
    '\u2018': 'LEFT SINGLE QUOTATION MARK',
    '\u2019': 'RIGHT SINGLE QUOTATION MARK',
    '\u201c': 'LEFT DOUBLE QUOTATION MARK',
    '\u201d': 'RIGHT DOUBLE QUOTATION MARK',
    '\u00b7': 'MIDDLE DOT',
    '\u2022': 'BULLET',
    '\u00a0': 'NON-BREAKING SPACE',
    '\u2009': 'THIN SPACE',
    '\u200a': 'HAIR SPACE',
    '\u3000': 'IDEOGRAPHIC SPACE',
    '\u00d7': 'MULTIPLICATION SIGN (looks like x)',
    '\u0430': 'CYRILLIC SMALL A (looks like a)',
    '\u0435': 'CYRILLIC SMALL E (looks like e)',
    '\u043e': 'CYRILLIC SMALL O (looks like o)',
    '\u0440': 'CYRILLIC SMALL R (looks like r)',
}

SOURCE_EXTENSIONS = {
    '.ts', '.tsx', '.svelte', '.js', '.jsx',
    '.py', '.json', '.md', '.html', '.css', '.scss',
    '.txt', '.env', '.toml', '.yaml', '.yml'
}

SKIP_DIRS = {
    'node_modules', '.git', '.svelte-kit', 'dist',
    'build', '__pycache__', '.venv', 'venv'
}

RESET  = '\033[0m'
RED    = '\033[91m'
YELLOW = '\033[93m'
CYAN   = '\033[96m'
GREEN  = '\033[92m'
BOLD   = '\033[1m'
DIM    = '\033[2m'

def severity_colour(severity: str) -> str:
    return {
        'ZERO-WIDTH': RED,
        'LOOKALIKE':  YELLOW,
        'CONTROL':    YELLOW,
        'NON-ASCII':  YELLOW,
    }.get(severity, RESET)


def scan_file(filepath: str) -> list[dict]:
    """
    Standard scan: flags zero-width chars, known lookalikes, and other
    unicode format/control characters.
    """
    findings = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            for line_no, line in enumerate(f, start=1):
                for col_no, char in enumerate(line, start=1):
                    if char in ZERO_WIDTH:
                        findings.append({
                            'line':     line_no,
                            'col':      col_no,
                            'char':     char,
                            'name':     ZERO_WIDTH[char],
                            'severity': 'ZERO-WIDTH',
                            'context':  line.rstrip()
                        })
                    elif char in LOOKALIKES:
                        findings.append({
                            'line':     line_no,
                            'col':      col_no,
                            'char':     char,
                            'name':     LOOKALIKES[char],
                            'severity': 'LOOKALIKE',
                            'context':  line.rstrip()
                        })
                    elif ord(char) > 127 and unicodedata.category(char) in ('Cf', 'Cc'):
                        findings.append({
                            'line':     line_no,
                            'col':      col_no,
                            'char':     char,
                            'name':     unicodedata.name(char, 'UNKNOWN'),
                            'severity': 'CONTROL',
                            'context':  line.rstrip()
                        })
    except (PermissionError, IsADirectoryError):
        pass
    return findings


def scan_file_strict(filepath: str) -> list[dict]:
    findings = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            for line_no, line in enumerate(f, start=1):
                for col_no, char in enumerate(line, start=1):
                    if ord(char) <= 0x7F:
                        continue  # plain ASCII -- fine

                    if char in ZERO_WIDTH:
                        severity = 'ZERO-WIDTH'
                        name     = ZERO_WIDTH[char]
                    elif char in LOOKALIKES:
                        severity = 'LOOKALIKE'
                        name     = LOOKALIKES[char]
                    elif unicodedata.category(char) in ('Cf', 'Cc'):
                        severity = 'CONTROL'
                        name     = unicodedata.name(char, 'UNKNOWN')
                    else:
                        severity = 'NON-ASCII'
                        name     = unicodedata.name(char, 'UNKNOWN')

                    findings.append({
                        'line':     line_no,
                        'col':      col_no,
                        'char':     char,
                        'name':     name,
                        'severity': severity,
                        'context':  line.rstrip()
                    })
    except (PermissionError, IsADirectoryError):
        pass
    return findings


def walk_codebase(root: str):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in SOURCE_EXTENSIONS:
                yield os.path.join(dirpath, filename)


def print_findings(filepath: str, findings: list[dict], root: str):
    rel = os.path.relpath(filepath, root)
    print(f"{BOLD}{CYAN}{rel}{RESET}")
    for f in findings:
        col  = severity_colour(f['severity'])
        code = f'U+{ord(f["char"]):04X}'
        ctx  = f['context'][:120]
        print(
            f"  {col}{BOLD}[{f['severity']}]{RESET} "
            f"Line {f['line']}, Col {f['col']} -- "
            f"{code}  {f['name']}"
        )
        print(f"  {DIM}  -> {repr(ctx)}{RESET}")
    print()

# ── Interactive fix ───────────────────────────────────────────────────────────

def ask(prompt: str) -> str:
    try:
        return input(prompt).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print('\nAborted.')
        sys.exit(0)


def interactive_fix(filepath: str, findings: list[dict], root: str,
                    strict: bool) -> tuple[int, int]:
    rel = os.path.relpath(filepath, root)

    deletable_severities = {'ZERO-WIDTH', 'NON-ASCII'} if strict else {'ZERO-WIDTH'}
    deletable = [f for f in findings if f['severity'] in deletable_severities]

    if not deletable:
        return 0, 0

    print(f"\n{BOLD}{CYAN}{'─'*60}{RESET}")
    print(f"{BOLD}{CYAN}{rel}{RESET}")
    print(f"{BOLD}{CYAN}{'─'*60}{RESET}\n")

    # Show non-deletable findings as context first
    manual = [f for f in findings if f['severity'] not in deletable_severities]
    if manual:
        print(f"  {YELLOW}The following must be fixed manually in your editor:{RESET}")
        for f in manual:
            code = f'U+{ord(f["char"]):04X}'
            print(
                f"  {YELLOW}  [{f['severity']}] Line {f['line']}, Col {f['col']}"
                f" -- {code}  {f['name']}{RESET}"
            )
        print()

    approved: set[tuple[int, int]] = set()

    for i, f in enumerate(deletable, start=1):
        code = f'U+{ord(f["char"]):04X}'
        ctx  = f['context'][:120]
        col  = severity_colour(f['severity'])

        print(
            f"  {col}{BOLD}[{i}/{len(deletable)}] {f['severity']}{RESET}  "
            f"Line {f['line']}, Col {f['col']} -- {code}  {f['name']}"
        )
        print(f"  {DIM}Context -> {repr(ctx)}{RESET}\n")

        choice = ask("  Delete this character? [y]es / [n]o / [a]ll in file / [s]kip file : ")

        if choice in ('y', 'yes'):
            approved.add((f['line'], f['col']))
            print(f"  {RED}Marked for deletion{RESET}\n")

        elif choice in ('a', 'all'):
            approved.add((f['line'], f['col']))
            for remaining in deletable[i:]:
                approved.add((remaining['line'], remaining['col']))
            print(f"  {RED}All remaining deletable chars in this file marked for deletion{RESET}\n")
            break

        elif choice in ('s', 'skip'):
            print(f"  Skipping rest of file.\n")
            return 0, len(deletable)

        else:
            print(f"  Kept.\n")

    if not approved:
        return 0, len(deletable)

    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as fh:
            original = fh.read()

        result  = []
        line_no = 1
        col_no  = 1
        deleted = 0

        for char in original:
            if (line_no, col_no) in approved:
                deleted += 1
                # character is dropped
            else:
                result.append(char)

            if char == '\n':
                line_no += 1
                col_no   = 1
            else:
                col_no += 1

        with open(filepath, 'w', encoding='utf-8') as fh:
            fh.write(''.join(result))

        skipped = len(deletable) - deleted
        print(f"  {RED}Deleted {deleted} character(s) from {rel}{RESET}")
        return deleted, skipped

    except (PermissionError, IsADirectoryError) as e:
        print(f"  {YELLOW}Could not write {rel}: {e}{RESET}")
        return 0, len(deletable)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args     = sys.argv[1:]
    fix_mode = '--fix'    in args
    strict   = '--strict' in args
    dirs     = [a for a in args if not a.startswith('--')]
    root     = os.path.abspath(dirs[0]) if dirs else os.path.abspath('.')

    if not os.path.isdir(root):
        print(f"Error: '{root}' is not a directory.")
        sys.exit(1)

    mode_label = 'STRICT -- all non-ASCII flagged' if strict else 'STANDARD -- zero-width + lookalikes'
    print(f"\n{BOLD}Scanning : {root}{RESET}")
    print(f"{BOLD}Mode     : {mode_label}{RESET}")
    if fix_mode:
        print(f"{YELLOW}Fix mode : ON -- you will be asked before anything is deleted{RESET}")
    print()

    scanner = scan_file_strict if strict else scan_file

    total_files       = 0
    all_file_findings : list[tuple[str, list[dict]]] = []
    counts            = {'ZERO-WIDTH': 0, 'LOOKALIKE': 0, 'CONTROL': 0, 'NON-ASCII': 0}

    for filepath in walk_codebase(root):
        total_files += 1
        findings = scanner(filepath)
        if findings:
            all_file_findings.append((filepath, findings))
            for f in findings:
                counts[f['severity']] = counts.get(f['severity'], 0) + 1

    total_findings = sum(counts.values())
    flagged_files  = len(all_file_findings)

    for filepath, findings in all_file_findings:
        print_findings(filepath, findings, root)

    print(f"{'─'*60}")
    print(f"{BOLD}Summary{RESET}")
    print(f"  Files scanned  : {total_files}")
    print(f"  Files flagged  : {flagged_files}")
    print(f"  Total findings : {total_findings}")
    print()

    if counts['ZERO-WIDTH']:
        print(f"  {RED}{BOLD}⚠  Zero-width / invisible : {counts['ZERO-WIDTH']}{RESET}"
              f"  <- delete these")
    if strict and counts['NON-ASCII']:
        print(f"  {YELLOW}⚠  Non-ASCII              : {counts['NON-ASCII']}{RESET}"
              f"  <- review: may be intentional in lyrics/comments")
    if counts['LOOKALIKE']:
        print(f"  {YELLOW}⚠  Lookalikes             : {counts['LOOKALIKE']}{RESET}"
              f"  <- fix manually in editor (e.g. replace em dash with --)")
    if counts['CONTROL']:
        print(f"  {YELLOW}⚠  Control chars          : {counts['CONTROL']}{RESET}"
              f"  <- fix manually in editor")
    if total_findings == 0:
        print(f"  {GREEN}✓  No suspicious characters found.{RESET}")
        return

    print()

    deletable_severities = {'ZERO-WIDTH', 'NON-ASCII'} if strict else {'ZERO-WIDTH'}
    deletable_total = sum(counts.get(s, 0) for s in deletable_severities)

    if fix_mode and deletable_total:
        fixable_files = [
            (fp, fs) for fp, fs in all_file_findings
            if any(f['severity'] in deletable_severities for f in fs)
        ]
        print(f"{BOLD}Fix mode -- reviewing {len(fixable_files)} file(s).{RESET}")
        print(f"{DIM}LOOKALIKE and CONTROL chars are shown for context"
              f" but must be fixed manually in your editor.{RESET}\n")

        total_deleted = 0
        total_skipped = 0

        for filepath, findings in fixable_files:
            deleted, skipped = interactive_fix(filepath, findings, root, strict)
            total_deleted += deleted
            total_skipped += skipped

        print(f"\n{'─'*60}")
        print(f"{BOLD}Fix complete{RESET}")
        print(f"  Deleted : {total_deleted} character(s)")
        print(f"  Kept    : {total_skipped} character(s) (your choice)")
        manual_total = counts['LOOKALIKE'] + counts['CONTROL']
        if manual_total:
            print(f"  {YELLOW}Reminder: {manual_total} lookalike/control char(s)"
                  f" still need manual attention in your editor.{RESET}")

    elif not fix_mode and deletable_total:
        scan_arg    = dirs[0] if dirs else '.'
        strict_flag = ' --strict' if strict else ''
        print(f"{BOLD}To review and delete these one by one:{RESET}")
        print(f"  python find_invisible_chars.py {scan_arg}{strict_flag} --fix")
        print()
        print(f"{DIM}You will be shown each character and asked before anything is changed.{RESET}")

    elif not fix_mode and not deletable_total and total_findings:
        print(f"{DIM}No automatically deletable characters found.")
        print(f"Fix the flagged characters manually in your editor.{RESET}")


if __name__ == '__main__':
    main()