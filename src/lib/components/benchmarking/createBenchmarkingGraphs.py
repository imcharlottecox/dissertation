import pandas as pd
import numpy as np
import os
import matplotlib.pyplot as plt

HERE_DIR = os.path.dirname(os.path.abspath(__file__))
FSM_DIR = HERE_DIR + "/results/FSM5sqrt"
MC_DIR = HERE_DIR + "/results/MC5sqrt"
FIG_DIRECTORY = HERE_DIR + "/results/graphs"

C_BUILD = "#A3C1AD"
C_EDGES = "#ada3c1"
C_NODES = "#d1978a"
C_FSM = "#8BACC1"
C_MC = "#4F6861"

PHASE_COLOURS = {
    "buildBaseHGraph": C_BUILD,
    "drawEdges": C_EDGES,
    "drawNodes": C_NODES,
    "drawHalos": "#d6c4c4",
    "drawInterSgArrows": "#dec2f0",
}
PHASE_LABELS = {
    "buildBaseHGraph": "buildBaseHGraph",
    "drawEdges": "drawEdges",
    "drawNodes": "drawNodes",
    "drawHalos": "drawHalos",
    "drawInterSgArrows": "drawInterSgArrows",
}

def load_csvs(directory, prefix, n_values):
    rows = []
    for n in n_values:
        path = os.path.join(directory, f"{prefix}_n{n}.csv")
        if not os.path.exists(path):
            print(f"{path} does not exist")
            continue
        df = pd.read_csv(path)
        df["phase"] = df["name"].str.split(":").str[-1]
        df["n"] = n
        rows.append(df)
    return pd.concat(rows, ignore_index= True) if rows else pd.DataFrame()

def piv_names(df, names):
    sub = df[df["phase"].isin(names)][["n", "phase", "ms"]]
    return sub.pivot_table(index="n", columns="phase", values="ms").reindex(columns = names)

NS = [10,100,500,800,900,1000,1200,1400,1600,1800,2000,2250,2500,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,9500,10000,10500,11000, 11500]
FSM_PREFIX = "FSM_bench_5percent"

fsm_df = load_csvs(FSM_DIR, FSM_PREFIX, NS)
if not fsm_df.empty:
    phases = ["buildBaseHGraph", "drawEdges", "drawNodes"]
    fsm_wide = piv_names(fsm_df, phases)
    totals = fsm_wide.sum(axis=1)
    fig, ax = plt.subplots(figsize=(14, 6))
    x = np.arange(len(fsm_wide))
    bottom = np.zeros(len(fsm_wide))

    for phase in phases:
        vals = fsm_wide[phase].fillna(0).values
        bar = ax.bar(x, vals, bottom=bottom, color=PHASE_COLOURS[phase], label=PHASE_LABELS[phase], edgecolor='white', linewidth=0.5)
        bottom += vals
    for i, tot in enumerate(totals):
        ax.text(x[i], tot + 5, f"{tot:.1f}", ha='center', va='bottom', fontsize=10)

    ax.set_xticks(x)
    ax.set_xticklabels([f"n={n}"for n in fsm_wide.index], fontsize=12, rotation=45, ha="right")
    ax.set_xlabel("Number of nodes (n)", fontsize=16)
    ax.set_ylabel("Time (ms)", fontsize=16)
    ax.set_title("FSM Chain Rendering Times by Phase", fontsize=18)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(fontsize=12, frameon=False)
    plt.tight_layout()
    out = os.path.join(FIG_DIRECTORY, "fsm_bench_5sqrt_2604.png")
    fig.savefig(out, dpi=280, bbox_inches="tight")
    plt.close(fig)



MC_PREFIX = "MC_benchfull_sqrt"

mc_df = load_csvs(MC_DIR, MC_PREFIX, NS)
if not mc_df.empty:
    phases = ["buildBaseHGraph", "drawEdges", "drawNodes",  "drawHalos", "drawInterSgArrows"]
    mc_wide = piv_names(mc_df, phases)
    # total_wide = mc_df[mc_df["phase"] == "totalRender"][["n", "ms"]].set_index("n")
    # total_wide = total_wide.reindex(mc_wide.index)  
    # true_totals = total_wide["ms"].fillna(0).values
    measured_sum = mc_wide.sum(axis=1).values
    # other = np.maximum(true_totals - measured_sum, 0)

    fig, ax = plt.subplots(figsize=(14, 6))
    x = np.arange(len(mc_wide))
    bottom = np.zeros(len(mc_wide))

    for phase in phases:
        vals = mc_wide[phase].fillna(0).values
        bar = ax.bar(x, vals, bottom=bottom, color=PHASE_COLOURS[phase], label=PHASE_LABELS[phase], edgecolor='white', linewidth=0.5)
        bottom += vals
    # ax.bar(x, other, bottom=bottom, color="#cccccc", label="other (drawHalos, interSgArrows)", edgecolor='white', linewidth=0.5)
    for i, tot in enumerate(measured_sum):
        ax.text(x[i], tot + 1, f"{tot:.1f}", ha='center', va='bottom', fontsize=10)

    ax.set_xticks(x)
    ax.set_xticklabels([f"n={n}"for n in mc_wide.index], fontsize=12, rotation=45, ha="right")
    ax.set_xlabel("Number of nodes (n)", fontsize=16)
    ax.set_ylabel("Time (ms)", fontsize=16)
    ax.set_title("Markov Chain Rendering Times by Phase", fontsize=18)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(fontsize=12, frameon=False)
    plt.tight_layout()
    out = os.path.join(FIG_DIRECTORY, "mc_bench_5sqrt_2604.png")
    fig.savefig(out, dpi=280, bbox_inches="tight")
    plt.close(fig)