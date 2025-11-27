import random

def scowl_is_letters(path):
    words = []
    with open(path) as file:
        for word in file: 
            word = word.strip().lower()
            if word.isalpha():
                words.append(word)
    return words

def make_identifiers(words):
    classics = ["age", "x", "i","y", "a", "b", "name", "place", "val", "num", "n"]
    if random.random() > 0.9:
        return random.choice(classics)
    baseWord = random.choice(words)

    if random.random() < 0.1:
        baseWord = baseWord + "_" + random.choice(words)
    if random.random() < 0.1:
        baseWord = baseWord + str(random.randint(1, 99))
    if random.random() < 0.05:
        baseWord = "_" + baseWord
    
    return baseWord

def value_string(words):
    return f'"{random.choice(words)}"'
def value_random_number():
    # string to make number string concatenation work
    return str(random.randint(1,999)) 
def value_random_float(): 
    return f"{random.uniform(-500, 500):.2f}"
def value_algebraic_expression():
    nums = [str(random.randint(-50, 50)) for _ in range(random.randint(2,4))]
    operators = random.choices(["+", "-", "*", "/"], k=len(nums)-1)
    # expression = ""
    parts = []
    for n, operator in zip(nums, operators):
        # expression += n + " " + operator + " "
        parts.append(n)
        parts.append(operator)
    parts.append(nums[-1])
    i = 0
    while i < len(parts) - 2:
        if random.random() < 0.3 and parts[i].lstrip("+-").isdigit():
            chunk = f"({parts[i]} {parts[i+1]} {parts[i+2]})"
            parts = parts[:i] + [chunk] + parts[i+3:]
            i += 1
        else:
            i += 2 
    expression = " ".join(parts)
    if random.random() < 0.3:
        expression = f"({expression})"
    return expression

def make_random_assignment_statement(words):
    lhs = make_identifiers(words)
    randProb = random.random()

    if randProb < 0.4:
        rhs = value_string(words)
    elif randProb < 0.6:
        rhs = value_random_number()
    elif randProb < 0.7:
        rhs = value_random_float()
    else:
        rhs = value_algebraic_expression()
    
    return f"{lhs} = {rhs}"


words = scowl_is_letters("src/lib/data/british-words.35") 
N = 3000

with open("python_assignments.txt", "w") as output:
    for i in range(N):
        output.write(make_random_assignment_statement(words) + "\n")