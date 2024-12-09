---
title: "Turing Machine #2"
date: 2024-12-10 02:37:40 +0800
categories: [Note, Formal Language & Automation, Turing Machine]
tags: [computer science]     # TAG names should always be lowercase
author: kyhsdjq
description: RE language's and recursive language's closure properties.
media_subpath: /imgs/note
math: true
# mermaid: true
---

## 前言

图灵机基础见[Turing Machine #0](../TuringMachine)

本文将介绍RE语言和recursive语言的闭包性质。

参考自[南京大学2024形式语言与自动机](https://fla24course.github.io/)和[对应的同步课堂笔记](https://fla.cuijiacai.com/07-tm/)。

## 闭包性质

> 集合对某运算闭包：集合中的任意元素在运算后仍属于该集合
{: .prompt-info }

RE和recursive都对以下运算闭包：
- 交
- 并
- 连接
- 星
- 反转
- 逆同态

RE闭包recursive不闭包：
- 同态

> 同态：$$str\in L \Rightarrow h(str)\in h(L)$$  
> 逆同态：$$h(str)\in L \Rightarrow str\in h^{-1}(L)$$  
> 其中h为同态函数：$$h(c)=c'\quad(c\neq\epsilon)$$
{: .prompt-info }

> recursive语言受限于可停机性
{: .prompt-tip }

RE不闭包recursive闭包：
- 差
- 补

> RE语言不停机情况导致证明构建失败
{: .prompt-tip }

## 闭包证明

通过构造图灵机证明，RE语言和recursive语言的证明略有差别：
- RE语言证明：
    - 原图灵机接受的字符串运算后能被构造的图灵机接受 

    $$str_1\in L(tm_1)\land str_2\in L(tm_2)\Rightarrow f(str_1,str_2)\in L(tm_{new})$$

    - 构造的图灵机接受的字符串能被原图灵机运算后得到

    $$f(str_1,str_2)\in L(tm_{new})\Rightarrow str_1\in L(tm_1)\land str_2\in L(tm_2)$$

- recursive语言证明
    - 原图灵机接受的字符串运算后能被构造的图灵机接受

    $$str_1\in L(tm_1)\land str_2\in L(tm_2)\Rightarrow f(str_1,str_2)\in L(tm_{new})$$
    
    - 原图灵机不接受的字符串运算后也不被构造的图灵机接受

    $$str_1\notin L(tm_1)\land str_2\notin L(tm_2)\Rightarrow f(str_1,str_2)\notin L(tm_{new})$$

### 图灵机组合

#### 交  
- RE：两个图灵机都接受时接受
- recursive：两个图灵机都接受时接受，其他情况拒绝

#### 并
- RE：两个图灵机有至少一个接受时接受
- recursive：两个图灵机都拒绝时拒绝，其他情况接受

#### 差
- RE：图灵机无法确定不接受，不能构造出差集的图灵机
- recursive：第一个图灵机接受第二个图灵机拒绝时接受

#### 补
差集的特殊情况

### 输入分割

#### 拼接
- RE：通过非确定性图灵机（见[Turing Machine #1](../TuringMachineExtension)）枚举分割情况，将两部分移动到两个纸带上分别模拟，结果做交
- recursive：枚举分割情况（有穷），将两部分移动到两个纸带上分别模拟，结果做交

#### 星
多次拼接

### 输入处理

#### 反转

将输入字符串反转后用原图灵机模拟

#### 逆同态

将输入字符串中的每个字符根据同态函数处理后用原图灵机模拟

#### 同态

将输入字符串中的每个字符根据逆同态函数处理

当 $$h(a)=\epsilon$$ 时，可以在字符串中插入无穷多个$$a$$，逆同态结果有无穷多个，无法构造一定停机图灵机

因此只有RE语言对同态闭包，recursive语言不闭包。

