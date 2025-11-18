---
title: "Java Points"
date: 2025-11-18 1:50:00 +0800
categories: [Interview, Java]
tags: [computer science, java, concurrency]     # TAG names should always be lowercase
author: kyhsdjq
description: Summarizing java knowledge points in one sentence.
media_subpath: /imgs/interview
math: true
mermaid: true
---

## 数据结构

### ConcurrentHashMap

弱一致性；对头结点加读写锁（非传统，写时也可读）；扩容时多线程协助。

使用红黑树的同时维护双向链表，读操作时如果有写操作正在进行，则选择查询双向链表。

#### 在 jdk 1.8 的优化

新增红黑树，分段锁 -> 头结点锁，协助扩容

#### 初始化

类似单例 DCL

#### hash 函数

(hash ^ (hash \>>> 16)) & HASH_BITS：充分打散，确保正数（也导致数组大小必须为 2 的幂）

#### 计算元素数量

并发量很大时，不同线程通过 CAS 在不同的 counterCell 上计数，求值时再做统计

## 锁

### 可重入

支持同一线程多次获取同一把锁。

### 悲观、乐观

悲观：先拿锁，再操作。乐观：先操作，再拿锁。

### 公平、非公平

公平：先休眠排队，再获取锁。非公平：先尝试获取锁，失败再休眠排队。

### synchronized

悲观，可重入，非公平。

JDK 1.6 的优化：锁消除（优化掉不用的锁）、锁膨胀（扩大锁的范围）、锁优化（见下图）

```mermaid
flowchart TD
    Start[线程尝试获取锁] --> CheckMark{检查Mark Word}
    
    CheckMark -->|001无锁| TryBias[尝试偏向]
    CheckMark -->|101偏向锁| CheckThread{是当前线程?}
    CheckMark -->|00轻量级| TryCAS[CAS竞争]
    CheckMark -->|10重量级| EnterMonitor[进入Monitor<br/>（操作系统）]
    
    TryBias --> SetBias[CAS设置偏向]
    SetBias -->|成功| Success[获取锁成功]
    SetBias -->|失败| Revoke[撤销偏向锁]
    
    CheckThread -->|是| Success
    CheckThread -->|否| Revoke
    
    Revoke --> Inflate1[升级为轻量级锁<br/>Mark Word: 101→00]
    Inflate1 --> TryCAS
    
    TryCAS -->|CAS成功| Success
    TryCAS -->|自旋| SpinWait{自旋次数<br/>是否超限?}
    SpinWait -->|未超限| TryCAS
    SpinWait -->|超限| Inflate2[膨胀为重量级锁<br/>Mark Word: 00→10]
    
    Inflate2 --> CreateMonitor[创建ObjectMonitor]
    CreateMonitor --> EnterMonitor
    
    EnterMonitor --> MonitorCheck{Monitor<br/>是否空闲?}
    MonitorCheck -->|是| Success
    MonitorCheck -->|否| Block[线程阻塞<br/>加入_EntryList队列]
    
    Block --> WaitNotify[等待notify唤醒]
    WaitNotify --> MonitorCheck
    
    Success --> Execute[执行同步代码块]
    Execute --> Release[释放锁]
    
    Release --> ReleaseEnd[锁释放但不降级<br/>保持重量级状态]
    
    style Success fill:#90EE90
    style Block fill:#FFB6C6
    style Inflate1 fill:#FFE4B5
    style Inflate2 fill:#FFE4B5
    style ReleaseEnd fill:#87CEEB
```

### AQS

AQS 是一个框架：状态 + 队列（双向链表） + 方法

#### 队列插入

为确保原子性，AQS 插入 node 时：先设置 node 的 prev，再通过 CAS 将 tail 替换为 node，最后补齐剩余指针。因此唤醒节点时一般从尾向头找，以免遗漏。

### ReentrantLock

基于 AQS 实现，可选公平或非公平、等待时间。

### ReentrantReadWriteLock

AQS 状态高位存读操作，低位存写操作。

读操作额外通过 ThreadLocal 记录线程持有哪些锁。

为避免写锁饥饿，读锁获取时先查询是否有写锁在等待。

## 线程池

### JDK 线程池

newFixedThreadPool（固定线程数：k/k）

newFixedThreadPool（单线程：1/1）

newCachedThreadPool（无核心线程：0/k）

newScheduledThreadPool（定时任务）

newWorkingStealingPool（每个线程一个自己的阻塞队列，手动分配）

### 核心参数

核心工作线程数、最大工作线程数、非核心工作线程最大生存时间（及单位）

阻塞队列、线程工厂、拒绝策略（抛异常、调用者处理、直接丢弃、丢弃最旧任务）

### 核心参数设置

通过压测观察 CPU 占用率决定（线程池参数支持动态修改）

### 添加任务流程

```mermaid
flowchart TD
    Start[提交任务] --> CheckCore{核心线程数<br/>是否已满?}
    
    CheckCore -->|未满| CreateCore[创建核心线程<br/>执行任务]
    CheckCore -->|已满| CheckQueue{阻塞队列<br/>是否已满?}
    
    CheckQueue -->|未满| AddQueue[任务加入队列]
    CheckQueue -->|已满| CheckMax{最大线程数<br/>是否已满?}
    
    CheckMax -->|未满| CreateNonCore[创建非核心线程<br/>执行任务]
    CheckMax -->|已满| Reject[执行拒绝策略]
    
    CreateCore --> Success[任务执行成功]
    AddQueue --> WaitExec[等待核心线程<br/>从队列取任务执行]
    WaitExec --> Success
    CreateNonCore --> Success
    
    style Success fill:#90EE90
    style Reject fill:#FFB6C6
    style CreateCore fill:#87CEEB
    style CreateNonCore fill:#FFE4B5
```

### 空任务的非核心线程

避免情况：阻塞队列里有任务，但没有工作线程。

这种情况的产生原因：核心线程数设置为 0，或设置核心线程也有生存时间

### 线程池状态

running（正常）

shutdown（停止接收新的任务）、stop（线程全部中断，队列中的任务忽略）

tidying（过渡）

terminated（被销毁）

### 线程池关闭（shutdown/shutdownNow）

目的：释放内存

实现：更新状态，唤醒挂起的工作线程（shutdown）/直接中断（shutdownNow）

### 异常处理

execute 提交：工作线程直接异常结束。submit 提交：捕获异常。