---
title: "Turing Machine #0"
date: 2024-12-03 20:20:00 +0800
categories: [Note, Formal Language & Automation, Turing Machine]
tags: [computer science]     # TAG names should always be lowercase
author: kyhsdjq
description: Turing machine's definition and basic properties.
media_subpath: /imgs/note
math: true
# mermaid: true
---

## 前言

本文旨在构建对图灵机的抽象认识，会省略诸多细节，如需详细例子见下面两个链接。

参考自[南京大学2024形式语言与自动机](https://fla24course.github.io/)和[对应的同步课堂笔记](https://fla.cuijiacai.com/07-tm/)。


## 认识图灵机

图灵机是计算机的基础模型。

在量子计算机出现前，所有传统计算机的计算能力都和图灵机相同。也就是说，任何能被传统计算机解决的问题同样能被图灵机解决。

和其他的自动机相同，图灵机的本质是状态机加上数据结构。

### 静态结构

在每个瞬间，图灵机都是一条无限长的纸带，上面扣着一个读写头。

![turing machine](turing-machine-raw.svg){: w="700" }

于是图灵机可以通过三个部分来描述：
- 读写头状态
- 读写头在纸带上的位置
- 纸带上的符号

它们可以被简单表示为$$\alpha q\beta$$（称为ID）
- $$\alpha$$：纸带中在读写头左侧的符号（不包括读写头下的）
- $$q$$：读写头状态
- $$\beta$$：纸带在读写头右侧的符号（包括读写头下的）

![turing machine ID](turing-machine-ID.svg){: w="700" }

### 状态转移

除去状态机本身的状态转移，图灵机还考虑当前读写头下的符号，并且决定是否修改它以及移动读写头。

状态转移函数
- 输入：
    - 读写头状态
    - 读写头下的符号
- 输出：
    - 读写头状态
    - 读写头下的符号
    - 读写头移动方向

一次移动：$$ID_1\vdash ID_2$$，用来描述状态转移前后整个图灵机的变化

多次移动：$$ID_1\vdash^* ID_2$$，由$$\vdash$$递归定义

> 状态转移函数 $$\rightarrow$$ 公式  
> 移动 $$\rightarrow$$ 通过公式化简算式
{: .prompt-tip }

### 生成语言

#### 生成方式

想要通过图灵机生成语言，需要先决定它接受哪些输入。

两种接受输入的方式：
- 终止状态：读写头状态到达终止状态
- 停机：未定义当前描述的转移函数

它们表示语言的能力相同。

##### 终止状态$$\rightarrow$$停机

删除终止状态的所有状态转移方程

> Q: 会不会影响到达终止状态前的移动？  
> A: 只要考虑输入到达的第一个终止状态，之后到达的状态不再影响结果。
{: .prompt-tip }

##### 停机$$\rightarrow$$终止状态

引入新状态作为终止状态，将所有未定义的状态转移方程输出设为它。

#### 语言

- 递归可枚举语言 (RE language)：由图灵机定义的语言
- 递归语言 (recursive language)：由算法定义的语言

> 算法：一定会停机的图灵机（通过终止状态接受）
{: .prompt-info}

## 图灵机的能力

### 自动机视角

和先前（更简单的）自动机不同，图灵机把输入放在纸带上并自由地操作它们，可能会不停地运行下去。因此它只能确认哪些输入被接受，而不一定能确认输入不被接受。

> 停机问题：不存在统一的方法证明某个图灵机是否停机
{: .prompt-info}

不过，针对特定的算法（状态转移函数），可以在更高层次证明其可停机。

### 算法视角

图灵机对数据结构有足够灵活的操作能力，可以直接在纸带上打印输出。

因此，对图灵机编程和普通编程相同，只是不得不操作一个只能一格格移动的数据结构。

