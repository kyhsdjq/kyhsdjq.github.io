---
title: "LightRAG"
date: 2025-12-03 22:23:00 +0800
categories: [AI, AI Agent]
tags: [subject, computer science, ai, ai agent, rag]     # TAG names should always be lowercase
author: kyhsdjq
description: RAG indexed with a graph.
media_subpath: /imgs/ai-agent
math: true
mermaid: true
---

## 引入

RAG 即 Retrieval-Augmented Generation，旨在通过 **检索** 来增强 LLM 回答的准确性和可靠性，具体参考[这篇](https://kyhsdjq.github.io/posts/RAG/)。

[LightRAG](https://arxiv.org/abs/2410.05779) 在 RAG 基础上做了两个优化：
- index 时将图（graph data structure）和向量（vector representation）相结合
- retrieve 时使用双层检索系统（dual-level retrieval system）

其在以下三个方面实现了性能提升：
- （图 + 向量）减少回应所需时间
- （图 + 向量）增量数据可以无缝加入图中
- （双层检索）针对复杂的、多上下文依赖的问题，能取回更有效的信息

> 此前也有 RAG 尝试引入图（[GraphRAG](https://arxiv.org/abs/2404.16130)），但在以下两方面存在欠缺：
> - 不支持无缝添加新文档
> - 使用暴力搜索，而没有适用于图的 retrieve 算法
{: .prompt-info }

## 架构

### Indexing

Indexing 形式如下：

$$
\hat{\mathcal{D}} = (\hat{\mathcal{V}},\hat{\mathcal{E}}) = \text{Dedupe}\circ\text{Prof}(\mathcal{V}, \mathcal{E}),~~~\mathcal{V}, \mathcal{E} = \cup_{\mathcal{D}_i\in\mathcal{D}} \text{Recog}(\mathcal{D}_i)
$$

简而言之就是将原始数据经过四步加工，：
1. chunk：文档分片
2. recognize：从文档中提取出点和边（依赖 LLM）
3. profile：为每个点和边总结 key-value 信息以加快 retrieve 速度（依赖 LLM）
4. deduplicate：去重

下图是来自原文中的例子，其中 D, P, R 和步骤首字母对应：

![LightRAG Frame](lightrag-frame.svg){: w="1000" }

### Retrieval

Retrieval 过程：
1. 通过 LLM 生成 local keyword 和 global keyword，写作 $$k^{(l)}$$ 和 $$k^{(g)}$$
2. 将 keyword 在图中匹配，$$k^{(l)}$$ 匹配点（entity），$$k^{(g)}$$ 匹配边（relationship）
3. 补充相关点和边

### Generation

生成过程中，LightRAG 将提炼过的点和边上的信息插入 prompt 中（也包含原始文本），最终效果如下：

![LightRAG Example](lightrag-example.png){: w="1000" }

## Prompt

相比起传统 RAG，LightRAG 在很多步骤都需要额外使用 LLM：
- Indexing：建图时，依赖 LLM 提取出点和边并总结
![LightRAG Indexing Prompt](lightrag-indexing-prompt.png){: w="1000" }
- Retrieval：从原始 query 中提取出 local keyword 和 global keyword
![LightRAG Retrieval Promtp](lightrag-retrieval-prompt.png){: w="1000" }

