---
title: "Spring Points"
date: 2025-11-20 21:22:00 +0800
categories: [Back End, Spring]
tags: [interview, computer science, spring, concurrency, back end]     # TAG names should always be lowercase
author: kyhsdjq
description: Summarizing spring knowledge points in one sentence.
math: true
mermaid: true
---

## AOP

### AOP 失效

private、final、static 方法

类内部调用（自调用）、未被 Spring 管理

## 事务

### @Transactional 失效

[AOP 失效](#aop-失效)、多线程调用、异常被捕获、异常类型错误、传播行为不正确、未配置事务管理器