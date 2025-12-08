---
title: "RAG Evaluation"
date: 2025-12-06 01:34:00 +0800
categories: [AI, AI Agent]
tags: [subject, computer science, ai, ai agent, rag, test]     # TAG names should always be lowercase
author: kyhsdjq
description: How to evaluate a rag system's accuracy and efficiency.
media_subpath: /imgs/rag-evaluation
math: true
mermaid: true
---

## 简介

RAG 系统的评估可以拆分于以下四块：
- Dataset：原始的外部文档
- Question：虚拟用户提问
- Competitor：评估时作为参考的 RAG
- Rate：评分

## Dataset

使用外部搜索引擎
- （RQ-RAG）比较了 DuckDuckGo、Wikipedia 和 Bing Search，最终效果相近

选择单个 Benchmark 的多个数据库
- （HyDE）TREC DL19/20 来自于 MS-MARCO；BEIR 每个子任务都是完整的检索任务；Mr.TyDi 来源于每个语言的维基百科
- （GraphRAG）选用播客文字稿（Behind the Tech with Kevin Scott）和新闻文章
- （LightRAG）UltraDomain 中的 Agriculture，CS，Legal，MIX 数据库

## Question

采用现有的问题集
- （RQ-RAG）Single-Hop 采用 Arc-Challenge，Multi-Hop 参考 [CoT](https://arxiv.org/abs/2212.10509) 中的评估
- （HyDE）TREC DL19/20；MARCO；BEIR；Mr.TyDi

通过 LLM 来生成
- （LightRAG）综合文档内容放入上下文，要求 LLM 生成多个角色及其对应的任务，最后根据每个角色-任务对生成多个提问，prompt 如下：
![LightRAG Question Generation Prompt](lightrag-question-generation-prompt.png){: w="1000" }

## Competitor

综合性能评估时使用 Baseline 来证明性能提升，常见的 Baseline：
- LLM：单纯的 LLM
- CoT LLM：采用 Chain-of-Thought 的 LLM
- Finetuned LLM：根据数据集微调过的 LLM
- Naive RAG：经典的 RAG 实现，采用 chunk 和 vector database
- RQ-RAG：将 query 拆分多个 sub-queries，包括重写、拆解和去歧义
- HyDE：根据 query 生成一篇虚拟文档
- GraphRAG：生成图，在其上构建 communitie report 作为抽象总结

消融实验（Ablation Study）时移除系统的某个组件来证明其贡献：
- （LightRAG）移除双层检索中的某一层，再和 Naive RAG 比较。

## Rate

直接计算得分
- （RQ-RAG）Single-Hop 形式为四选一，可以直接计算正确率；Multi-Hop 通过 F1 分数计算正确召回率
- （HyDE）输出结果为文档排序，可以计算 MAP（平均精确度均值）、nDCG@10（前 10 个结果的归一化折损累积增益）、Recall@100（前 100 个结果中相关文档的召回率）

通过 LLM 比较一对回答
- （GraphRAG）不展示原文，从 Comprehensiveness、Diversity、Directness、Empowerment 四个角度比较，prompt 如下：
    <div style="border:2px solid #bbb;border-radius: 8px;padding:10px;margin:18px 0; background:var(--color-eval-bg, #f8f8fa);">
      <pre style="font-size: 0.8em; line-height: 1.2; margin:0; color:var(--color-eval-fg, #222);"><code>
    ---Role---

    You are a helpful assistant responsible for grading two answers to a question that are provided by two different people.

    ---Goal---
    
    Given a question and two answers (Answer 1 and Answer 2), assess which answer is better according to the following measure:
    
    {criteria}
    
    Your assessment should include two parts:
    - Winner: either 1 (if Answer 1 is better) and 2 (if Answer 2 is better) or 0 if they are fundamentally similar and the differences are immaterial.
    - Reasoning: a short explanation of why you chose the winner with respect to the measure described above.
    
    Format your response as a JSON object with the following structure:
    {{
        "winner": <1, 2, or 0>,
        "reasoning": "Answer 1 is better because <your reasoning>."
    }}
    
    ---Question---
    
    {question}
    
    ---Answer 1---
    
    {answer1}
    
    ---Answer 2---
    
    {answer2}
    
    Assess which answer is better according to the following measure:
    
    {criteria}
    
    Output:
    </code></pre>
    </div>
    <div style="border:2px solid #bbb;border-radius: 8px;padding:10px;margin:18px 0; background:var(--color-eval-bg, #f8f8fa);">
      <pre style="font-size: 0.8em; line-height: 1.2; margin:0; color:var(--color-eval-fg, #222);"><code>
    CRITERIA = {
        "comprehensiveness": "How much detail does the answer provide to cover all the aspects and details of the question? A comprehensive answer should be thorough and complete, without being redundant or irrelevant. For example, if the question is 'What are the benefits and drawbacks of nuclear energy?', a comprehensive answer would provide both the positive and negative aspects of nuclear energy, such as its efficiency, environmental impact, safety, cost, etc. A comprehensive answer should not leave out any important points or provide irrelevant information. For example, an incomplete answer would only provide the benefits of nuclear energy without describing the drawbacks, or a redundant answer would repeat the same information multiple times.",
        "diversity": "How varied and rich is the answer in providing different perspectives and insights on the question? A diverse answer should be multi-faceted and multi-dimensional, offering different viewpoints and angles on the question. For example, if the question is 'What are the causes and effects of climate change?', a diverse answer would provide different causes and effects of climate change, such as greenhouse gas emissions, deforestation, natural disasters, biodiversity loss, etc. A diverse answer should also provide different sources and evidence to support the answer. For example, a single-source answer would only cite one source or evidence, or a biased answer would only provide one perspective or opinion.",
        "directness": "How specifically and clearly does the answer address the question? A direct answer should provide a clear and concise answer to the question. For example, if the question is 'What is the capital of France?', a direct answer would be 'Paris'. A direct answer should not provide any irrelevant or unnecessary information that does not answer the question. For example, an indirect answer would be 'The capital of France is located on the river Seine'.",
        "empowerment": "How well does the answer help the reader understand and make informed judgements about the topic without being misled or making fallacious assumptions. Evaluate each answer on the quality of answer as it relates to clearly explaining and providing reasoning and sources behind the claims in the answer."
    }
    </code></pre>
    </div>
- （LightRAG）不展示原文，从 Comprehensiveness、Diversity、Empowerment 三个角度比较，最后给出综合表现评估 Overall，prompt 如下：
![LightRAG Rate Prompt](lightrag-rate-prompt.png){: w="1000" }

通过 LLM 处理后再计算客观指标
- （GraphRAG）通过 [Claimfy](https://arxiv.org/abs/2502.10855) 提取陈述，然后评估结果的 Comprehensiveness 和 Diversity