import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

files = {
    10: "results/MC_bench_20pct_n10.csv",
    100: "results/MC_bench_20pct_n100.csv",
    500: "results/MC_bench_20pct_n500.csv",
    750: "results/MC_bench_20pct_n750.csv",
}

dfs = []
for n, file in files.items():
    df = pd.read_csv(file)
    df["ms"] = pd.to_numeric(df["ms"], errors="coerce")
    df["n"] = int(n)
    dfs.append(df)

df = pd.concat(dfs, ignore_index=True)

stages = [
    "mc:layout:adjacency",
    "mc:layout:bfs_levels",
    "mc:layout:node_positioning",
    "mc:layout:pin_start_end_nodes",
    "mc:layout:build_node_map",
    "mc:layout:build_edges",
    "mc:layout:edge_curvature_pairs",
    "mc:calculatePositionLayout",
    "mc:drawNodes",
    "mc:edgeRender:zoomed_edges",
    "mc:edgeRender:join",
    "mc:edgeRender:edges_attrs",
    "mc:edgeRender:edges_titles",
    "mc:drawEdges",
]
stages = [
    "mc:layout:adjacency",
    "mc:layout:bfs_levels",
    "mc:layout:node_positioning",
    "mc:layout:pin_start_end_nodes",
    "mc:layout:build_node_map",
    "mc:layout:build_edges",
    "mc:layout:edge_curvature_pairs",
    "mc:calculatePositionLayout",
    "mc:drawNodes",
    "mc:edgeRender:zoomed_edges",
    "mc:edgeRender:join",
    "mc:edgeRender:edges_attrs",
    "mc:edgeRender:edges_titles",
    "mc:drawEdges",
]
# index = stages
# columns = n
# values = ms

pivot = df[df["name"].isin(stages)].pivot_table(index="name", columns="n", values="ms").reindex(interesting_stages, columns=n_order)

fig, ax = plt.subplots(figsize=(14, 6))
x = np.arange(len(pivot.index))
width = 0.15

for i, n in enumerate(pivot.columns):
    ax.bar(x + i * width, pivot[n], width, label=f"n={n}")


ax.set_xticks(x + width * (len(pivot.columns) - 1) / 2)
ax.set_xticklabels(pivot.index, rotation=45, ha="right")

ax.set_ylabel("Time (ms)")
ax.set_title("Markov Chain Rendering Times")
ax.legend(title="Graph size")
bad = pd.read_csv(file)
bad["ms_num"] = pd.to_numeric(bad["ms"], errors="coerce")
print(file, bad[bad["ms_num"].isna()])

plt.tight_layout()
plt.savefig("results/MC_benchmark_bar_chart.png")
plt.show()
