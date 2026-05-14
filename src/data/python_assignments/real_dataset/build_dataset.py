import ast
from datasets import load_dataset

ALLOWED_BINOPS = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod)

def grab_dataset():
    dataset = load_dataset("Nan-Do/code-search-net-python", split="train")
    for row in dataset:
        code = row.get("code") or ""
        if code:
            yield code

def string_safe(s):
    return ("\\" not in s) and ("\n" not in s) and ("\r" not in s) and ("\t" not in s)
def extract_assignments(code):
    #not all assignments work with my limited FSM, so I just want specific strucutres
    output = []
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            rhs_kind = classify_value_type(node.value)
            if rhs_kind is None:
                continue
            stmt = ast.get_source_segment(code, node)

            if not is_only_ascii(stmt):
                continue
            if rhs_kind == "string":
                if is_nonstring_parenthesis(stmt):
                    continue
                if not string_safe(node.value.value):
                    continue
            if is_not_decimal(stmt):
                continue

            if stmt is None:
                stmt = ast.unparse(node)
            output.append(stmt.strip())
    return output

def is_numerical_exprssion(rhs):
    if isinstance(rhs, ast.Constant) and isinstance(rhs.value, (int, float, complex)):
        return True
    if isinstance(rhs, ast.BinOp) and isinstance(rhs.op, ALLOWED_BINOPS):
        return is_numerical_exprssion(rhs.left) and is_numerical_exprssion(rhs.right)
    return False

def is_string(rhs):
    return isinstance(rhs, ast.Constant) and isinstance(rhs.value, str)

def is_not_decimal(rhs):
    s = rhs.lower()
    return ("0x" in s) or ("0b" in s) or ("0o" in s)

def is_only_ascii(rhs):
    try:
        rhs.encode("ascii")
        return True
    except UnicodeEncodeError:
        return False

def is_nonstring_parenthesis(rhs):
    eq = rhs.find("=")
    if eq == -1:
        return False
    stm = rhs[eq+1:].lstrip()
    return stm.startswith("(")

def classify_value_type(rhs):
    if isinstance(rhs, ast.Constant) and isinstance(rhs.value, (int, float, complex)) and not isinstance(rhs.value, bool):
        return "number"
    elif is_string(rhs):
        return "string"
    elif isinstance(rhs, ast.Constant) and isinstance(rhs.value, bool):
        return "boolean"
    if is_numerical_exprssion(rhs):
        return "number_expr"
    return None

def main(
        outfile = "real_python_assignments.txt",
        max_statements = 2000,
        max_len= 100
    ):
    seen = set()
    written = 0

    with open(outfile, "w", encoding="utf-8") as f:
        for code in grab_dataset():
            for stmt in extract_assignments(code):
                stmt = stmt.strip()
                length = len(stmt)
                if length > max_len or length == 0 or stmt in seen:
                    continue
                seen.add(stmt)
                f.write(stmt + "\n")
                written += 1
                if written >= max_statements:
                    print("reached max statements")
                    return
    print("done")

if __name__ == "__main__":
    main()