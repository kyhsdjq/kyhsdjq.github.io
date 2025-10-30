---
title: "Redis Steam"
date: 2025-10-30 18:36:00 +0800
categories: [Interview, Redis]
tags: [computer science, redis, data structure, message queue]     # TAG names should always be lowercase
author: kyhsdjq
description: Introduction to redis stream and how it works.
media_subpath: /imgs/interview
math: true
mermaid: true
---

## 前言

**Redis Stream** 已经在 [Redis Data Structure](https://kyhsdjq.github.io/posts/Redis-Data-Structure/) 中初步介绍，本文针对它如何实现详细介绍。

## 介绍

**Stream** 是专为 **消息队列** 设计的数据类型，来看看它提供哪些命令：
- `XADD`：插入消息，自动生成全局 ID 并返回
- `XREAD`：读取下一条消息，可配置阻塞读
- `XGROUP`：创建消费组
- `XACK`：通知消息处理完成
- `XPENDING`：宕机后查看尚未处理完成的命令

**Stream** 解决了 **List** 实现 **消息队列** 的一些问题，整理一下它的优点：
- 自动维护 **全局 ID**
- 支持 **消费组**
- 提供完善的 **PENDING List** 操作

### 问题

#### 消息丢失

消息队列包含三个环节：**消息生产**、**消息存储**、**消息消费**。

在 **消息生产** 环节，是否丢失主要取决于 **生产者**，只要能正常受到 redis 返回的 ack 确认，就代表生产成功。

在 **消息生产** 环节，**可能丢失消息**。单机情况下，因为 AOF 不一定是实时写入，宕机时可能丢失数据；主从复制情况下，节点同步异步，可能丢失数据。

> AOF 提供 3 种写回策略：always，everysec，no，安全性递减，后两者丢失数据风险较大。
{: .prompt-info }

在 **消息生产** 环节，Stream 提供了 PENDING List 留存信息，因此消费者宕机后还能够还原，**不会丢失消息**。

#### 消息堆积

为防止消息堆积导致 OOM (out of memory)，redis 可以指定消息队列的 **最大长度**。如果消息过多，旧消息会被删除，导致丢失消息。

> Kafka、RabbitMQ 等专业的消息队列中间件将数据存储在 **磁盘** 上，可以积压大量消息。
{: .prompt-info }

### 应用场景

因为上面的问题，通过 stream 来实现消息队列适合以下业务场景：
- 对消息丢失不敏感
- 消息积压概率较小

> **为什么不用 Redis 发布/订阅机制来实现消息队列？**
> - 发布/订阅机制不支持持久化，宕机后消息全部丢失
> - 发布/订阅机制发后即忘，消费者短暂离线后过去的消息全部丢失
> - 消费者消息积压会直接断开连接
> 综上，Redis 发布/订阅机制只适合 **即时通讯**，例如哨兵集群中的通讯。
{: .prompt-tip }

## 生产与消费

### 核心数据结构

参考源码位置：[stream.h](https://github.com/redis/redis/blob/8.4/src/stream.h)

Stream 整体结构：

```c
typedef struct stream {
    rax *rax;               /* The radix tree holding the stream. */
    uint64_t length;        /* Current number of elements inside this stream. */
    streamID last_id;       /* Zero if there are yet no items. */
    streamID first_id;      /* The first non-tombstone entry, zero if empty. */
    streamID max_deleted_entry_id;  /* The maximal ID that was deleted. */
    uint64_t entries_added; /* All time count of elements added. */
    size_t alloc_size;      /* Total allocated memory (in bytes) by this stream. */
    rax *cgroups;           /* Consumer groups dictionary: name -> streamCG */
    rax *cgroups_ref;       /* Index mapping message IDs to their consumer groups. */
    streamID min_cgroup_last_id;  /* The minimum ID of consume group. */
    unsigned int min_cgroup_last_id_valid: 1;
} stream;
```

#### StreamID

StreamID 就是消息队列的全局 ID，它的源码：

```c
/* Stream item ID: a 128 bit number composed of a milliseconds time and
 * a sequence counter. IDs generated in the same millisecond (or in a past
 * millisecond if the clock jumped backward) will use the millisecond time
 * of the latest generated ID and an incremented sequence. */
typedef struct streamID {
    uint64_t ms;        /* Unix time in milliseconds. */
    uint64_t seq;       /* Sequence number. */
} streamID;
```

#### rax 数据结构

**rax**（Radix Tree）即 **压缩前缀树**，用来高速存储和检索 Stream 条目。来看看它的 [源码](https://github.com/redis/redis/blob/unstable/src/rax.h#L113)：

```c
/* Representation of a radix tree as implemented in this file, that contains
 * the strings "foo", "foobar" and "footer" after the insertion of each
 * word. When the node represents a key inside the radix tree, we write it
 * between [], otherwise it is written between ().
 *
 * This is the vanilla representation:
 *
 *              (f) ""
 *                \
 *                (o) "f"
 *                  \
 *                  (o) "fo"
 *                    \
 *                  [t   b] "foo"
 *                  /     \
 *         "foot" (e)     (a) "foob"
 *                /         \
 *      "foote" (r)         (r) "fooba"
 *              /             \
 *    "footer" []             [] "foobar"
 *
 * However, this implementation implements a very common optimization where
 * successive nodes having a single child are "compressed" into the node
 * itself as a string of characters, each representing a next-level child,
 * and only the link to the node representing the last character node is
 * provided inside the representation. So the above representation is turned
 * into:
 *
 *                  ["foo"] ""
 *                     |
 *                  [t   b] "foo"
 *                  /     \
 *        "foot" ("er")    ("ar") "foob"
 *                 /          \
 *       "footer" []          [] "foobar"
 *
 * However this optimization makes the implementation a bit more complex.
 * For instance if a key "first" is added in the above radix tree, a
 * "node splitting" operation is needed, since the "foo" prefix is no longer
 * composed of nodes having a single child one after the other. This is the
 * above tree and the resulting node splitting after this event happens:
 *
 *
 *                    (f) ""
 *                    /
 *                 (i o) "f"
 *                 /   \
 *    "firs"  ("rst")  (o) "fo"
 *              /        \
 *    "first" []       [t   b] "foo"
 *                     /     \
 *           "foot" ("er")    ("ar") "foob"
 *                    /          \
 *          "footer" []          [] "foobar"
 *
 * Similarly after deletion, if a new chain of nodes having a single child
 * is created (the chain must also not include nodes that represent keys),
 * it must be compressed back into a single node.
 *
 */

#define RAX_NODE_MAX_SIZE ((1<<29)-1)
typedef struct raxNode {
    uint32_t iskey:1;     /* Does this node contain a key? */
    uint32_t isnull:1;    /* Associated value is NULL (don't store it). */
    uint32_t iscompr:1;   /* Node is compressed. */
    uint32_t size:29;     /* Number of children, or compressed string len. */
    /* Data layout is as follows:
     *
     * If node is not compressed we have 'size' bytes, one for each children
     * character, and 'size' raxNode pointers, point to each child node.
     * Note how the character is not stored in the children but in the
     * edge of the parents:
     *
     * [header iscompr=0][abc][a-ptr][b-ptr][c-ptr](value-ptr?)
     *
     * if node is compressed (iscompr bit is 1) the node has 1 child.
     * In that case the 'size' bytes of the string stored immediately at
     * the start of the data section, represent a sequence of successive
     * nodes linked one after the other, for which only the last one in
     * the sequence is actually represented as a node, and pointed to by
     * the current compressed node.
     *
     * [header iscompr=1][xyz][z-ptr](value-ptr?)
     *
     * Both compressed and not compressed nodes can represent a key
     * with associated data in the radix tree at any level (not just terminal
     * nodes).
     *
     * If the node has an associated key (iskey=1) and is not NULL
     * (isnull=0), then after the raxNode pointers pointing to the
     * children, an additional value pointer is present (as you can see
     * in the representation above as "value-ptr" field).
     */
    unsigned char data[];
} raxNode;

typedef struct rax {
    raxNode *head;
    uint64_t numele;
    uint64_t numnodes;
    size_t *alloc_size;
    void *metadata[];
} rax;
```

可以看到，`raxNode` 的 `data` 可以存储一个 **值指针**（value-ptr），也就是说我们可以把 `rax` 作为 **字典**，将键值对存入其中。

Stream 中就包含这样的三个字典：`rax`，`cgroups`，`cgroups_ref`：

| name          | key             | value                        |
| :------------ | :-------------- | :--------------------------- |
| `rax`         | StreamID        | listpack（其中包含多条消息） |
| `cgroups`     | 消费组名称      | 消费组                       |
| `cgroups_ref` | 索引映射消息 ID | 消费组                       |

#### rax 表

以下信息参考 [t_stream.c](https://github.com/redis/redis/blob/8.4/src/t_stream.c) 中的注释。

Stream 中最重要的一张表是 `rax`，它维护了 StreamID 到 listpack 的映射，做了一些特殊的优化。

从上面 StreamID 的实现可以看出：添加时间越晚，StreamID 越大，因此查询最近添加的消息只需查看 `rax` 尾部。

`rax` 中的每个 listpack 中可能包含多条消息。每个 listpack 都有且仅有一个 **主条目**，用于 **优化存储**。

```
+-------+---------+------------+---------+--/--+---------+---------+-+
| count | deleted | num-fields | field_1 | field_2 | ... | field_N |0|
+-------+---------+------------+---------+--/--+---------+---------+-+
```

| 字段                           | 含义                           |
| :----------------------------- | :----------------------------- |
| count                          | 当前 listpack 中有效条目的数量 |
| deleted                        | 被标记为删除的条目数量         |
| num-fields                     | 字段数量                       |
| field_1, field_2, ..., field_N | 字段名列表                     |
| 0                              | 终止符                         |

主条目通过 **字段压缩** 的方式来优化存储，例子如下：

```
条目1: {name: "张三", age: "25", city: "北京"}
条目2: {name: "李四", age: "30", city: "上海"}  
条目3: {name: "王五", age: "28", city: "广州"}
```

压缩后：

```
主条目: {fields: ["name", "age", "city"]}
条目1: {flag: SAMEFIELDS, values: ["张三", "25", "北京"]}
条目2: {flag: SAMEFIELDS, values: ["李四", "30", "上海"]}
条目3: {flag: SAMEFIELDS, values: ["王五", "28", "广州"]}
```

此外，条目的 StreamID 也只会保存 ms（毫秒）和 seq（序列号），表示相对于 `rax` 中的 key 的偏移量。结构如下：

```
+-----+--------+-------+-/-+-------+--------+
|flags|entry-id|value-1|...|value-N|lp-count|
+-----+--------+-------+-/-+-------+--------+
```

| 字段                           | 含义                                                                                                    |
| :----------------------------- | :------------------------------------------------------------------------------------------------------ |
| flags                          | 编码，标识字段名是否完全相同                                                                            |
| entry-id                       | 上面提到的 ms 和 seq                                                                                    |
| value_1, value_2, ..., value_N | 字段值列表                                                                                              |
| lp-count                       | 放在字段末尾的长度，用处参考 [listpack](https://kyhsdjq.github.io/posts/Redis-Data-Structure/#listpack) |

### 添加条目

参考源码位置：[t_stream.c](https://github.com/redis/redis/blob/8.4/src/t_stream.c#L439)

函数描述：

```c
/* Adds a new item into the stream 's' having the specified number of
 * field-value pairs as specified in 'numfields' and stored into 'argv'.
 * Returns the new entry ID populating the 'added_id' structure.
 *
 * If 'use_id' is not NULL, the ID is not auto-generated by the function,
 * but instead the passed ID is used to add the new entry. In this case
 * adding the entry may fail as specified later in this comment.
 * 
 * When 'use_id' is used alongside with a zero 'seq-given', the sequence
 * part of the passed ID is ignored and the function will attempt to use an
 * auto-generated sequence.
 *
 * The function returns C_OK if the item was added, this is always true
 * if the ID was generated by the function. However the function may return
 * C_ERR in several cases:
 * 1. If an ID was given via 'use_id', but adding it failed since the
 *    current top ID is greater or equal. errno will be set to EDOM.
 * 2. If a size of a single element or the sum of the elements is too big to
 *    be stored into the stream. errno will be set to ERANGE. */
int streamAppendItem(stream *s, robj **argv, int64_t numfields, streamID *added_id, streamID *use_id, int seq_given);
```

其中介绍了很多 StreamID 生成的细节，我们只要关注：
- `s` 是要添加条目的流
- `argv` 和 `numfields` 存放条目的值
- 结果的 StreamID 存入 `added_id` 中
- 成功返回 `C_OK`，失败返回 `C_ERR`

接下来我们看看插入的核心逻辑：

1. 获取尾部 listpack（StreamId 字典序最大的，也就是最新的）
    ```c
    raxIterator ri;
    raxStart(&ri,s->rax);
    raxSeek(&ri,"$",NULL,0);
    size_t lp_bytes = 0;
    unsigned char *lp = NULL;
    if (!raxEOF(&ri)) {
        lp = ri.data;
        lp_bytes = lpBytes(lp);
    }
    raxStop(&ri);
    ```
2. 判断是否要创建新节点
    ```c
    if (lp != NULL) {
        int new_node = 0;
        size_t node_max_bytes = server.stream_node_max_bytes;
        // 检查字节数限制
        if (lp_bytes + totelelen >= node_max_bytes) {
            new_node = 1;
        } 
        // 检查条目数限制
        else if (server.stream_node_max_entries) {
            // 统计当前节点的条目数
            if (count >= server.stream_node_max_entries) new_node = 1;
        }
    }    
    ```
3. 处理 listpack 节点
    ```c
    if (lp == NULL) { // 创建新节点
        master_id = id;
        streamEncodeID(rax_key,&id);
        // 创建新listpack，包含主条目
        lp = lpNew(prealloc);
        lp = lpAppendInteger(lp,1); // 条目计数
        lp = lpAppendInteger(lp,0); // 删除计数
        lp = lpAppendInteger(lp,numfields); // 字段数
        // 添加字段名作为主条目
        for (int64_t i = 0; i < numfields; i++) {
            sds field = argv[i*2]->ptr;
            lp = lpAppend(lp,(unsigned char*)field,sdslen(field));
        }
        lp = lpAppendInteger(lp,0); // 主条目终止符
    }
    else { // 使用现有节点
        // 更新条目计数
        int64_t count = lpGetInteger(lp_ele);
        lp = lpReplaceInteger(lp,&lp_ele,count+1);
        // 检查字段是否与主条目相同
        if (numfields == master_fields_count) {
            // 比较每个字段名
            if (i == master_fields_count) flags |= STREAM_ITEM_FLAG_SAMEFIELDS;
        }
    }
    ```
4. 添加新条目
    ```c
    // 添加条目标志
    lp = lpAppendInteger(lp,flags);
    // 添加时间戳和序列号的差值（相对于主条目）
    lp = lpAppendInteger(lp,id.ms - master_id.ms);
    lp = lpAppendInteger(lp,id.seq - master_id.seq);

    // 如果字段不同于主条目，需要存储字段名
    if (!(flags & STREAM_ITEM_FLAG_SAMEFIELDS))
        lp = lpAppendInteger(lp,numfields);

    // 添加字段和值
    for (int64_t i = 0; i < numfields; i++) {
        sds field = argv[i*2]->ptr, value = argv[i*2+1]->ptr;
        if (!(flags & STREAM_ITEM_FLAG_SAMEFIELDS))
            lp = lpAppend(lp,(unsigned char*)field,sdslen(field));
        lp = lpAppend(lp,(unsigned char*)value,sdslen(value));
    }

    // 计算并存储lp-count字段
    int64_t lp_count = numfields + 3; // 值数量 + 3个固定字段
    if (!(flags & STREAM_ITEM_FLAG_SAMEFIELDS)) {
        lp_count += numfields + 1; // 字段名 + 字段数量字段
    }
    lp = lpAppendInteger(lp,lp_count);
    ```

最后看看函数整体执行流程：
1. 生成 StreamID
2. 验证新ID的有效性
3. 检查数据大小限制
4. 获取尾部 listpack
5. 判断是否需要创建新节点
6. 处理 listpack 节点
7. 编码并添加新条目
8. 更新流状
9. 返回成功

### 总结

Stream 通过 **rax $$+$$ listpack** 的方式实现消息的存储，此外在 **listpack** 中 **抽取相同的字段名** 来节约存储空间。

## TBD

### 4. 消费者组实现

#### 4.1 消费者组结构
```c
typedef struct streamCG {
    streamID last_id;          // 消费者组最后交付的ID
    uint64_t entries_read;     // 已读取条目计数
    rax *pel;                  // 待确认条目列表(PEL)
    rax *pel_by_time;          // 按时间索引的PEL
    rax *consumers;            // 消费者列表
} streamCG;
```

#### 4.2 消费者结构
```c
typedef struct streamConsumer {
    mstime_t seen_time;        // 最后活跃时间
    mstime_t active_time;      // 最后请求时间
    sds name;                  // 消费者名称
    rax *pel;                  // 消费者专属的PEL
} streamConsumer;
```

#### 4.3 待确认条目(NACK)结构
```c
typedef struct streamNACK {
    mstime_t delivery_time;     // 交付时间
    uint64_t delivery_count;    // 交付次数
    streamConsumer *consumer;   // 所属消费者
    unsigned char *cgroup_ref_node;  // 消费者组引用节点
} streamNACK;
```

### 5. 关键操作实现

#### 5.1 条目添加 (`streamAppendItem`)
1. **ID生成**：确保单调递增
2. **节点选择**：找到合适的Listpack节点或创建新节点
3. **压缩编码**：使用delta编码和字段压缩
4. **元数据更新**：更新长度、最后ID等

#### 5.2 范围查询优化
- **基数树遍历**：利用前缀匹配快速定位
- **Listpack解析**：增量解码条目
- **迭代器模式**：`streamIterator`提供统一接口

#### 5.3 消费者组管理
- **PEL管理**：双重索引（ID索引 + 时间索引）
- **消费者跟踪**：自动清理长时间不活跃的消费者
- **消息分发**：基于消费者组的负载均衡

### 6. 性能优化设计

#### 6.1 内存优化
- **Listpack紧凑存储**：比传统linked list节省60-70%内存
- **字段名去重**：相同字段名只存储一次
- **增量编码**：StreamID使用差值存储

#### 6.2 查询优化
- **基数树索引**：O(log n)复杂度的范围查询
- **缓存友好**：Listpack连续内存布局
- **懒惰解析**：按需解码条目内容

#### 6.3 并发优化
- **读写分离**：迭代器不影响写操作
- **原子操作**：确保多客户端环境下的数据一致性

### 7. 总结

Redis Stream 通过精心设计的多层数据结构实现了高性能的日志数据存储：

**核心设计原则：**
1. **时间有序性**：基于时间戳的StreamID确保条目的自然排序
2. **内存效率**：Radix Tree + Listpack 的组合最大化内存利用率
3. **查询性能**：基数树提供高效的范围查询能力
4. **可扩展性**：支持消费者组的分布式消费模式

**技术亮点：**
- 基数树提供O(log n)的查询复杂度
- Listpack紧凑存储减少内存碎片
- 多级索引支持复杂的消费者组管理
- 增量编码大幅降低存储开销

这种设计使得Redis Stream既保持了Redis一贯的高性能特色，又提供了企业级消息队列所需的丰富功能。