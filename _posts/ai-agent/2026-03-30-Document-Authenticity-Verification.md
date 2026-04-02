---
title: "Document Authenticity Verification"
date: 2026-03-30 13:37:00 +0800
categories: [AI, AI Agent]
tags: [subject, computer science, ai, ai agent]     # TAG names should always be lowercase
author: kyhsdjq
description: Verifying the authenticity of the documents using LLM.
media_subpath: /imgs/document-authenticity-verification
math: true
mermaid: true
---

## 简介

随着 LLM 兴起，**文档真实性** 的验证变得更加方便。同时，LLM 的训练以及 RAG 的数据库对可靠文档的需求也在增加，催生出更多相关研究。

## 论文概述

### [CrediRAG](https://arxiv.org/abs/2410.12061) 

CrediRAG 特别针对 Reddit 的虚假信息检测。其利用 Reddit 本身的 **社区评论** 来辨别信息是否真实。

具体而言，CrediRAG 通过 RAG 查找相似的帖子，加权平均得到可信度评分。在此基础上，通过社区评论（同一个用户评论多条帖子）训练图注意力网络，从而得到更准确的结果。

### [MSuf](https://arxiv.org/abs/2502.14383)

MSuf 用来检测 twitter 的帖子是否为谣言。和 CrediRAG 不同，它针对某条特定的帖子，提取 **原帖和评论的相对情感** 随时间的变化趋势。随后训练模型根据该趋势判断帖子是否为谣言。

### [Self-Checker](https://arxiv.org/abs/2305.14623)

![Self-Checker Example](Self-Checker-example.png){: w="1000" }

Self-Checker 专门核查 LLM 生成的文本。其通过多个即插即用的模块实现：
- Policy Agent：该模块是必要的核心模块，负责根据当前系统状态和观察结果，从预定义动作中选择下一步操作，实现高效的事实核查流程决策。
- Claim Processor：用于从输入文本中抽取需要验证的主张，或将复杂主张拆解为易验证的单条主张，便于后续处理。
- Query Generator：根据待验证主张生成搜索查询，帮助从外部知识库中检索相关材料。
- Evidence Seeker：从检索到的材料中筛选出能够证明或反驳主张的证据句，辅助准确判定主张真假。
- Verdict Counselor：结合所有主张和证据，给出每个主张的真实性判决（如支持/部分支持/不支持/反驳），并汇总为最终结论。

### [TrumorGPT](https://arxiv.org/abs/2505.07891)

TrumorGPT 专为验证健康相关信息。其通过 LLM 将来自可信数据源的信息转化为知识图谱，随后根据该图谱判断用户提问是否可信。

### [MADR](https://arxiv.org/abs/2402.07401)

MADR 通过 multi-agent 辩论来检验真实性，不针对特定的领域。其分别设置两个辩论者，一个根据错误类型体系找错，一个开放性地找错，两者持续辩论直到结果收敛（由另一个 LLM 来判断）。

> 除了 **真实性**，**有效性** 也值得关注。
> [GroGU](https://arxiv.org/abs/2601.23129) 专为衡量 RAG 过程中，特定文档对于特定模型的有效性。首先，在有文档的情况下生成回答，随后在无文档的情况下观察同一个 token 的概率，概率越高说明模型越确定，熵越低。以此来判断文档是否有效。
{: .prompt-info }

## 方法论

要验证文档的真实性，LLM 需要依赖于外界的其他信息。

|论文|来源信息|结合方式|
|:---|:---|:---|
|CrediRAG (1)|已标注是否真实的帖子|RAG 查询相关帖子|
|CrediRAG (2)|相同用户在不同帖子中的评论|图注意力网络|
|MSuf|随时间变化的评论情绪|线性层多任务训练|
|Self-Checker|网络|搜索工具|
|TrumorGPT|官方可靠信息|知识图谱|
|MADR|用户提供的信息|multi-agent 辩论|

## 参考文献

1. Ashwin Ram, Yigit Ege Bayiz, Arash Amini, Mustafa Munir, Radu Marculescu. "**CrediRAG: Network-Augmented Credibility-Based Retrieval for Misinformation Detection in Reddit.**" *arXiv preprint arXiv:2410.12061v2* (2024). [\[Paper\]](https://arxiv.org/abs/2410.12061)
2. Zhiwei Liu, Kailai Yang, Eduard Hovy, Sophia Ananiadou. "**Rumor Detection by Multi-task Suffix Learning based on Time-series Dual Sentiments.**" *arXiv preprint arXiv:2502.14383v2* (2025). [\[Paper\]](https://arxiv.org/abs/2502.14383)
3. Miaoran Li, Baolin Peng, Michel Galley, Jianfeng Gao, Zhu Zhang. "**Self-Checker: Plug-and-Play Modules for Fact-Checking with Large Language Models.**" *arXiv preprint arXiv:2305.14623v2* (2024). [\[Paper\]](https://arxiv.org/abs/2305.14623)
4. Ching Nam Hang, Pei-Duo Yu, Chee Wei Tan. "**TrumorGPT: Graph-Based Retrieval-Augmented Large Language Model for Fact-Checking.**" *arXiv preprint arXiv:2505.07891v2* (2025). [\[Paper\]](https://arxiv.org/abs/2505.07891)
5. Kyungha Kim, Sangyun Lee, Kung-Hsiang Huang, Hou Pong Chan, Manling Li, Heng Ji. "**Can LLMs Produce Faithful Explanations For Fact-checking? Towards Faithful Explainable Fact-Checking via Multi-Agent Debate.**" *arXiv preprint arXiv:2402.07401v1* (2024). [\[Paper\]](https://arxiv.org/abs/2402.07401)
6. Yilun Hua, Giuseppe Castellucci, Peter Schulam, Heba Elfardy, Kevin Small. "**Evaluating the Utility of Grounding Documents with Reference-Free LLM-based Metrics.**" *arXiv preprint arXiv:2601.23129v1* (2026). [\[Paper\]](https://arxiv.org/abs/2601.23129)
{: .bib}
