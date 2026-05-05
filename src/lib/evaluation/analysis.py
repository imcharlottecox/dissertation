import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from scipy import stats
import json
import os

DATA_DIR = os.path.dirname(__file__)
FIG_DIR = os.path.join(DATA_DIR, "figures")
os.makedirs(FIG_DIR, exist_ok=True)

END_Q = os.path.join(DATA_DIR, "Ending_Questionnaire.csv")
START_Q = os.path.join(DATA_DIR, "Starter_questionnaire.csv")
LOGS = os.path.join(DATA_DIR, "interaction_log_rows_2.csv")
STUDENTS = os.path.join(DATA_DIR, "students_rows_1.csv")
QUAL_COMP = os.path.join(DATA_DIR, "comparitive_responses.csv")

end_q = pd.read_csv(END_Q)
end_q['animal'] = end_q.iloc[:, 1].str.strip().str.lower()
end_q = end_q[end_q['animal'] != 'frog'] 
start_q = pd.read_csv(START_Q)
students = pd.read_csv(STUDENTS)
students['animal'] = students['username'].str.strip().str.lower()
logs = pd.read_csv(LOGS)
logs = logs.merge(students[['id', 'animal']], left_on='student_id', right_on='id', how='left')
logs = logs[logs['animal'] != 'frog']

qual = pd.read_csv(QUAL_COMP)
qual.columns = ['pre_ts', "pre_animal", "consent", "pre_response", "pre_class", "blank", "post_animal", "post_response", "post_class"]
qual["pre_animal"] = qual["pre_animal"].str.strip().str.lower()
qual["post_animal"] = qual["post_animal"].str.strip().str.lower()
EXCLUDE = ["frog", "zebra", "penguin", "gecko", "toad"]

CONCEPTS = ['FSM', 'Markov', 'FSM_vs_MC', 'Sequences', 'Prob_errors', 'Explain_AI']
LABELS = ["Understand FSMs", "Understand Markov chains", "Understand FSMs vs Markov chains", "Understand sequence processing", "Understand probabilistic errors", "Explain AI to others"]

l1 = end_q.iloc[0:18].copy()
l2 = end_q.iloc[18:24].copy()

before_cols = end_q.columns[3:9].tolist()
after_cols = end_q.columns[9:15].tolist()

def lesson_stats(end_q):
    before = end_q[before_cols].copy()
    before.columns = CONCEPTS
    after = end_q[after_cols].copy()
    after.columns = CONCEPTS
    return before, after

before1, after1 = lesson_stats(l1)
before2, after2 = lesson_stats(l2)

LESSONS_DATA = [(before1, after1, f'Hills Road SFC lesson, (n={len(l1)})',  "HRSFC.png"), (before2, after2, f'All Saints\' Sixth Form lesson, (n={len(l2)})',  "AllSaints.png")]

def parse_logs(logs):
    try:
        return json.loads(logs)
    except:
        return {}
    
logs["data"] = logs["event_data"].apply(parse_logs)
logs["page"] = logs["data"].apply(lambda d: d.get("page"))
logs["created_at"] = pd.to_datetime(logs["created_at"])

#figure for before versus after post/pre
wilcoxon_results = {}

for (before, after, title, filename) in LESSONS_DATA:
    fig, axes = plt.subplots(figsize= (13, 6))
    x = np.arange(len(CONCEPTS))
    width = 0.4
    axes.bar(x - width/2, before.mean(), width, yerr=before.sem()*1.96, capsize=4, color='#A3C1AD', label='Before')
    axes.bar(x + width/2, after.mean(), width, yerr=after.sem()*1.96, capsize=4, color='#ada3c1', label='After')

    for i, concept in enumerate(CONCEPTS):
        paired = pd.DataFrame({'before': before[concept], 'after': after[concept]}).dropna()
        _, p = stats.wilcoxon(paired['before'], paired['after'], alternative='less') #test whether increase
        wilcoxon_results[concept] = {"p_value": p, "n": len(paired)}

    axes.set_xticks(x)
    axes.set_xticklabels(LABELS, fontsize=9, rotation=20, ha="right")
    axes.set_ylim(0,7.9)
    axes.set_ylabel("Mean self reported understanding (1-7 Likert scale)")
    axes.set_title("Pre and post lesson self reported understanding of concepts\n" + title)
    axes.legend(fontsize=9)
    axes.spines[["top", "right"]].set_visible(False)
    axes.axhline(4, color='gray', linestyle='--', linewidth=0.8, alpha=0.5)

    plt.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, filename), dpi=180, bbox_inches='tight')

for (before, after, title, filename) in LESSONS_DATA:
    gains = after-before
    fig, axes = plt.subplots(2,3,figsize= (11, 6))
    axes = axes.flatten()

    for i, (concept, label) in enumerate(zip(CONCEPTS, LABELS)):
        ax = axes[i]
        g = gains[concept].dropna()
        ax.hist(g, bins=[x-0.5 for x in range(-3, 8)], color='#A3C1AD', edgecolor='white', alpha=0.8, linewidth=0.5)
        ax.axvline(g.mean(), color='red', linestyle='--', linewidth=0.8, label=f'Mean gain: {g.mean():.1f}')
        ax.set_title(label)
        ax.set_xlabel("Score gain", fontsize=9)
        ax.set_ylabel("Number of students", fontsize=9)
        ax.set_xticks(range(-3, 8))
        ax.legend(fontsize=8)
        ax.spines[["top", "right"]].set_visible(False)
    
    fig.suptitle("Distribution of score gains (after - before) for each concept\n" + title)
    plt.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, filename.replace(".png", "_score_gains_mid.png")), dpi=180, bbox_inches='tight')

def summary_table(before, after, label):
    print(label)
    print(f"{'Concept':<50} {'Before Mean':<10} {'After Mean':<10} {'Mean Gain':<10}   {'Before Mdn':<10} {'After Mdn':<10} {'Mdn Gain':<10} {'p-value':<10}")
    print("---------------------------------------------------------------")
    for (c, lbl) in zip(CONCEPTS, LABELS):
        paired = pd.DataFrame({'before': before[c], 'after': after[c]}).dropna()
        _, p = stats.wilcoxon(paired['before'], paired['after'], alternative='less')
        before_mean = before[c].mean()
        after_mean = after[c].mean()
        mean_gain = after_mean - before_mean
        beforestd = before[c].std()
        afterstd = after[c].std()
        before_mdn = before[c].median()
        after_mdn = after[c].median()
        mdn_gain = after_mdn - before_mdn
        print(f"{lbl:<50} {before_mean:.2f} ({beforestd:.2f}) {after_mean:.2f} ({afterstd:.2f}) {mean_gain:.2f} {before_mdn:.2f} {after_mdn:.2f} {mdn_gain:.2f} {p:.4f}")
summary_table(before1, after1, "Hills Road SFC lesson")
summary_table(before2, after2, "All Saints' Sixth Form lesson")


qual_records = []
for _, row in qual.iterrows():
    animal = row["pre_animal"] if pd.notna(row["pre_animal"]) else row["post_animal"]
    if pd.isna(animal) or str(animal) in EXCLUDE:
        continue
    cohort = 1 if animal in l1['animal'].values else 2 if animal in l2['animal'].values else None
    if cohort is None:
        continue
    qual_records.append({
        "animal": animal,
        "cohort": cohort,
        "pre": int(row["pre_class"]) if pd.notna(row["pre_class"]) else None,
        "post": int(row["post_class"]) if pd.notna(row["post_class"]) else None
    })
record = pd.DataFrame(qual_records)

Q_COLOURS = {1: "#B9DAC3", 2: "#83B192", 3: "#4F6856", 4: "#174124"}
Q_LABELS = {
    1: "1: Incorrect or incomplete answer",
    2: "2: Some evidence of computational model thinking",
    3: "3: Some specifics of FSMs or Markov chains",
    4: "4: Comparative discussion of FSMs and Markov chains"
}

def count_classes(s):
    counts = {1: 0, 2: 0, 3: 0, 4: 0}
    for val in s.dropna():
        if int(val) in counts:
            counts[int(val)] += 1
    return counts

def draw_stacked_barchart(ax,x,counts):
    bottom = 0
    for category in [1,2,3,4]:
        val = counts.get(category, 0)
        if val > 0:
            ax.bar(x, val, bottom=bottom, color=Q_COLOURS[category],width= 0.5, edgecolor='white', linewidth=0.8) 
            ax.text(x, bottom + val/2, str(val), ha='center', va='center', color='white', fontsize=9)
        bottom += val
    
def make_bar_chart(group_num, title, pre_n, post_n, filename):
    sub = record[record['cohort'] == group_num]
    pre_counts = count_classes(sub['pre'])
    post_counts = count_classes(sub['post'])

    fig, ax = plt.subplots(figsize=(5, 6))
    draw_stacked_barchart(ax, 0, pre_counts)
    draw_stacked_barchart(ax, 1, post_counts)

    ax.set_xticks([0, 1])   
    ax.set_xticklabels([f'Pre-lesson\n(n={pre_n})', f'Post-lesson\n(n={post_n})'], fontsize=10)
    ax.set_ylabel("Number of students", fontsize=10)
    ax.set_title(title, fontsize=11)
    ax.spines[["top", "right"]].set_visible(False)
    patches = [mpatches.Patch(color=Q_COLOURS[cat], label=Q_LABELS[cat]) for cat in [4,3,2,1]]
    ax.legend(handles=patches, loc="upper left", fontsize=9, bbox_to_anchor=(0,-0.18), frameon=False, ncol=1)
    plt.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, filename), dpi=180, bbox_inches="tight")

make_bar_chart(1, "Hills Road SFC lesson", pre_n=record[record['cohort'] == 1]['pre'].dropna().shape[0], post_n=record[record['cohort'] == 1]['post'].dropna().shape[0], filename="HRSFC_qual_comparison.png")
make_bar_chart(2, "All Saints' Sixth Form lesson", pre_n=record[record['cohort'] == 2]['pre'].dropna().shape[0], post_n=record[record['cohort'] == 2]['post'].dropna().shape[0], filename="ALLSAINTS_qual_comparison.png")