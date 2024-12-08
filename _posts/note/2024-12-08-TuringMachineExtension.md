---
title: "Turing Machine #1"
date: 2024-12-08 03:03:46 +0800
categories: [Note, Formal Language & Automation, Turing Machine]
tags: [computer science]     # TAG names should always be lowercase
author: kyhsdjq
description: Turing machine's extension.
media_subpath: /imgs/note
math: true
# mermaid: true
---

## 前言

图灵机基础见[Turing Machine #0](../TuringMachine)

本文将介绍图灵机的扩展技术，包括符号扩展、结构简化、结构繁化。

参考自[南京大学2024形式语言与自动机](https://fla24course.github.io/)和[对应的同步课堂笔记](https://fla.cuijiacai.com/07-tm/)。



## 图灵机扩展技术

符号扩展（结构不变）：
- 多道
- 标记
- 存储键值对
- 缓存

结构简化：
- 半无穷纸带
- 双栈

结构繁化：
- 多纸带
- 非确定

> 结构简化 $$\rightarrow$$ 转移函数繁化  
> 结构繁化 $$\rightarrow$$ 转移函数简化
{: .prompt-tip }

### 符号扩展

#### 多道

将纸带符号视作向量，向量每个维度称为**磁道**。

#### 标记

将某一磁道作标记用。

#### 存储键值对

通过同一磁道的标记符按顺序存储 key-value 项。

#### 缓存

将状态视作向量，来存储更多静态数据。

> 用纸带来存储动态数据，用状态来存储静态数据
{: .prompt-tip }

### 结构简化

#### 半无穷纸带

将无穷纸带在中间（imput string 开始处）对折，可以得到双纸带的半无穷纸带。  
反之，半无穷纸带也能实现无穷纸带的功能。

多磁道实现：  
- 使用双磁道的半无穷纸带，上磁道对应无穷纸带的右半，下次到对应左半。  
- 通过状态缓存记录当前在哪一磁道。

#### 双栈

一个栈存放读写头左侧符号，一个栈存放读写头右侧符号。

> 从ID表示的移动可以看出：这样存放数据可以完美利用栈的特性
{: .prompt-tip }

> 下推自动机 (PDA) 通过一个栈实现，只能同时对两个数计数，用来定义上下文无关语言 (CFL)。
{: .prompt-info }

### 结构繁化

#### 多纸带

> 和多道不同，多纸带图灵机的每条纸带都有自己的读写头
{: .prompt-tip }

多磁道实现：  
- 每条纸带对应一条标记磁道和一条符号磁道，标记磁道记录对应纸带读写头位置。  
- 每次读写根据标记移动到各纸带的读写头的位置，分别进行状态转移。

#### 非确定

多磁道实现，广搜所有情况： 
- 用队列存放当前可能到达的ID。  
- 新建立两条磁道，一条存储队列，一条标记队列中的项。

