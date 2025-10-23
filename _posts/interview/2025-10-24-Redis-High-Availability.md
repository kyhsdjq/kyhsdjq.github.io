---
title: "Redis High Availability"
date: 2025-10-24 1:59:00 +0800
categories: [Interview, Redis]
tags: [computer science, redis, distributed system]     # TAG names should always be lowercase
author: kyhsdjq
description: Comprehensive guide to Redis memory management, covering expiration policies, eviction strategies, LRU/LFU algorithms, and cache consistency solutions.
media_subpath: /imgs/interview
math: true
mermaid: true
---

## 前言

本文将讨论以下两种保障 redis 的高可用性的方式：
- **主从复制**：多个服务器保存相同的数据，以防单个服务器故障影响服务
- **Cluster 集群**：多个服务器存储不同数据，实现在线扩容和大量数据缓存

本文参考 [小林coding - 图解Redis介绍](https://www.xiaolincoding.com/redis/)。

## 主从复制

在主从复制中，多个服务器保存相同的数据，会遇到以下问题：

|问题|解决方式|
|:---|:---|
|数据不一致|读写分离|
|服务器故障|哨兵机制|

这两个问题的解决是我们理解主从复制的重要部分，一起来看看吧。

### 读写分离

服务器分为 **主服务器** 和 **从服务器** ，所有数据以主服务器为准。客户端只向主服务器发送写入请求，接着数据被同步到从服务器；客户端对主从服务器都可以发送读取请求。

```mermaid
---
title: 主从服务器读写
---
flowchart TD
   Client[客户端]
   Master[(主服务器)]
   SlaveA[(从服务器 A)]
   SlaveB[(从服务器 B)]
   Client -->|写入| Master
   Master -.->|同步| SlaveA
   Master -.->|同步| SlaveB
   Client -->|读取| Master
   Client -->|读取| SlaveA
   Client -->|读取| SlaveB
```

#### 同步实现

读写分离是如何保证 **一致性** 的？由三种同步来实现：
- 首次同步：redis 服务启动或是新的从服务器加入服务器网络后的首次同步
- 命令传播：主从服务器连接建立后，持续进行命令传输
- 增量复制：主从服务器连接断开后进行的一致性恢复

> 主服务器向从服务器不仅要同步 **写入命令**，当某个键被淘汰后，还需要同步对应的 **删除命令**，将从服务器中的内存也释放。
{: .prompt-tip }

##### **首次同步**

分为三个阶段：建立链接，同步数据，补发命令

```mermaid
sequenceDiagram
   participant 主服务器
   participant 从服务器
   Note over 主服务器, 从服务器: 建立链接
   从服务器 ->> 主服务器: psync 协商同步
   主服务器 ->> 从服务器: 回复 runId 和 offset（复制进度）
   Note over 主服务器, 从服务器: 同步数据
   par 同步镜像
   主服务器 ->> 主服务器: bgsave 生成 RDB 文件
   主服务器 ->> 从服务器: 发送 RDB 文件
   从服务器 ->> 从服务器: 加载 RDB 文件
   从服务器 ->> 主服务器: 确认 RDB 文件加载成功
   and 记录命令
   主服务器 ->> 主服务器: 在 replication buffer 中<br>记录写操作命令
   end
   Note over 主服务器, 从服务器: 补发命令
   主服务器 ->> 从服务器: 发送 replication buffer 中<br>记录的命令
   Note over 主服务器, 从服务器: 首次同步完成
```

##### **命令传播**

首次同步后，主从服务器之间维护一条 **长连接的tcp连接**，来进行 **命令传播**。

```mermaid
sequenceDiagram
   participant 主服务器
   participant 从服务器
   主服务器 ->> 从服务器: 命令传播
```

> 主服务器会先将命令写入缓冲区中，再由其他线程 **异步** 地传播给从服务器。
{: .prompt-info }

##### **增量复制**

此时，如果主从服务器之间的连接断开，我们可以通过从服务器中保存的 offset 定位到复制进度，从而进行 **增量复制**，而不用从头 **全量复制**。

```mermaid
sequenceDiagram
   participant 主服务器
   participant 从服务器
   从服务器 ->> 主服务器: psync 协商同步<br>带有过去的 runId 和 offset
   主服务器 ->> 从服务器: 回复 Continue<br>告知采用增量复制
   主服务器 ->> 从服务器: 发送断线期间的命令
   主服务器 ->> 从服务器: 恢复正常命令传播
```

> **主服务器中将写入命令保存在哪里，来帮助从服务器恢复？**<br>
> &emsp;&emsp;命令保存在 repl_backlog_buffer 这个 **环形缓冲区** 中（默认 1MB），其中包含一个指针 master_repl_offset 记录主服务器写到的位置。<br>
> &emsp;&emsp;如果需要同步的数据已经不在 repl_backlog_buffer 中，就会 **降级到全量复制**。
{: .prompt-info }

#### 数据丢失

尽管我们做了同步措施，还是可能存在数据丢失，主要发生在以下两种情况：
- 异步复制前 **主节点崩溃**，主节点中的数据全部丢失
- 主节点失联后恢复，产生两个主节点，导致 **脑裂**

> **脑裂** 发生后，redis 会将较新的主节点作为当前主节点，将它的数据 **全量复制** 给旧的主节点，因此旧的主节点 **在失联后写入的数据** 会全部丢失。
{: .prompt-info }

以上两种情况都不能避免丢失数据，但是可以尽可能减少数据丢失量。

##### **主节点崩溃**

当主节点同步异常时阻止客户端写入。具体而言，主节点通过 **从节点的延迟时长** 来判断未同步的数据量，当延迟时长超过某个阈值（参数 min-slaves-max-lag）后，拒绝新的写入请求。

> 客户端发现 Redis 不可写入后，可以降级为存入本地内存、kafka或数据库。
{: .prompt-tip }

##### **脑裂**

当主节点连接异常时阻止客户端写入。具体而言，主节点通过 **延迟的从节点数** 来判断网络状况，当延迟个数超过某个阈值（参数 min-slaves-to-write）后，拒绝新的写入请求。



### 哨兵模式

**TBD**

## Cluster 集群

**TBD**