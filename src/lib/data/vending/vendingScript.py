import random
# import json
# from collections import Counter

PRICE = 40
COINS = [10,20]
WRONG_COINS = [5,50]
# START_STATE = "START"
END_STATE = "PRESSED_PAY"

def generate_data(p_10 = 0.6, p_20 = 0.35, p_noise = 0.05, max_steps=8):
    total = 0
    inputted_coins = []

    for i in range(max_steps):
        if total >= PRICE:
            if random.random() < 0.9:
                break
        r = random.random()
        if r < p_10:
            coin = 10
        elif r < (p_10 + p_20):
            coin = 20
        else:
            coin = random.choice(WRONG_COINS)

        inputted_coins.append(f"{coin}p")
        total += coin
    inputted_coins.append(END_STATE)
    return inputted_coins

def generate_corpus(n = 100, seed=22):
    random.seed(seed)
    return [generate_data() for _ in range(n)]

if __name__ == "__main__":
    corpus = generate_corpus(100)
    with open("vending_markov_40p.txt", "w") as f:
        for session in corpus:
            f.write(" ".join(session) + "\n")
    print("Wrote vending_markov_40p.txt")



