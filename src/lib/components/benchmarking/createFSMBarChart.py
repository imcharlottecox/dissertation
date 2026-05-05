import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

files = {
    10: "results/FSM_bench_monitoringDraw_n10.csv",
    100: "results/FSM_bench_monitoringDraw_n100.csv",
    500: "results/FSM_bench_monitoringDraw_n500.csv",
    1000: "results/FSM_bench_monitoringDraw_n1000.csv",
}

dfs = []
for n, file in files.items():
    df = pd.read_csv(file)
    df["ms"] = pd.to_numeric(df["ms"], errors="coerce")
    df["n"] = int(n)
    dfs.append(df)

df = pd.concat(dfs, ignore_index=True)

full_stages = [
    "fsm:buildBase:reset_graph",
    "fsm:buildBaseHGraph:gWidth_1",
    "fsm:buildBaseHGraph:gWidth_2",
    "fsm:buildBaseHGraph:setStart",
    "computeLevelsMap:adjacency_build",
    "computeLevelsMap:bfs_levels_init",
    "computeLevelsMap:bfs_levels_compute",
    "computeLevelsMap:compute_unreachable_nodes",
    "fsm:buildBase:computeLevelsMap",
    "computeNodePositionsWithBackbone:group_nodes_by_level",
    "computeNodePositionsWithBackbone:find_straight_path",
    "computeNodePositionsWithBackbone:node_positioning_loop",
    "fsm:buildBase:computeNodePositionsWithBackbone",
    "fsm:buildBase:setNodes",
    "fsm:buildBase:setEdges",
    "fsm:buildBase:snapshotBasePos",
    "fsm:buildBaseHGraph",
    "fsm:runCollisionAvoidance",
]
selected_stages = [
    "fsm:buildBase:reset_graph",
    "fsm:buildBaseHGraph:setStart",
    "fsm:buildBaseHGraph:computeLevelsMap",
    "fsm:buildBase:computeNodePositionsWithBackbone",
    "fsm:buildBase:setNodes",
    "fsm:buildBase:setEdges",
    "fsm:buildBase:snapshotBasePos",
    "fsm:buildBaseHGraph",
    "fsm:rerender:ZoomTransform",
    "fsm:rerender:makeContext",
    "fsm:rerender:drawEdges",
    "fsm:rerender:drawNodes",
    "fsm:totalRender",
]
interesting_stages = [
    "computeLevelsMap:adjacency_build",
    "computeLevelsMap:bfs_levels_compute",
    "fsm:buildBase:computeLevelsMap",
    "fsm:buildBase:computeNodePositionsWithBackbone",
    "fsm:buildBase:setEdges",
    "fsm:buildBaseHGraph",
]
total_render = [
    "fsm:totalRender",
]

n_order = [10, 100, 500, 1000]
pivot = df[df["name"].isin(selected_stages)].pivot_table(index="name", columns="n", values="ms").reindex(selected_stages, columns=n_order)
pivot = pivot.reindex(columns=n_order)

fig, ax = plt.subplots(figsize=(14, 6))
x = np.arange(len(pivot.index))
width = 0.15

for i, n in enumerate(n_order):
    ax.bar(x + i * width, pivot[n], width, label=f"n={n}")


ax.set_xticks(x + width * (len(pivot.columns) - 1) / 2)
ax.set_xticklabels(pivot.index, rotation=45, ha="right")

ax.set_ylabel("Time (ms)")
ax.set_title("FSM Chain Rendering Times")
ax.legend(title="Graph size")


plt.tight_layout()
plt.savefig("results/FSM_selected_stages_aftrOnDsChanges_benchmark_bar_chart.png")
plt.show()
