---
title: "SillyTavern"
date: 2025-10-27 7:23:00 +0800
categories: [AI, Prompt Engineering]
tags: [subject, computer science, ai, prompt engineering]     # TAG names should always be lowercase
author: kyhsdjq
description: A single unified interface for many LLM APIs.
math: true
mermaid: true
---

## 简介

[SillyTavern](https://github.com/SillyTavern/SillyTavern) 是一个本地安装的用户界面，允许您与文本生成 LLM、图像生成引擎和 TTS 语音模型进行交互。

一言概之，SillyTavern 将 LLM 的 API 包装为本地的服务，支持通过 **预设**、**人物卡**、**世界书**、**插件** 来快速控制模型的输入输出。

| 设置      | 功能                                       |
| :-------- | :----------------------------------------- |
| 预设/正则 | 控制 LLM 通用性的输出格式，甚至能做到解禁  |
| 人物卡    | 对话的人设，几乎不会脱离                   |
| 世界书    | 对话的背景，似乎会自动填充当前对话所需条目 |
| 插件      | 优化使用体验，美化界面，自动执行脚本       |

此外，SillyTavern 有非常丰富的社区文化，无偿产出人物卡和世界书供他人体验。

## 整体架构

Silly Tavern 由前端（浏览器）和后端（Node.js）组成，单次消息运行流程：

| 步骤 | 前端 (public/)                                     | 后端 (src/)          | 说明                                  |
| ---- | -------------------------------------------------- | -------------------- | ------------------------------------- |
| 1    | 用户点击发送按钮                                   | -                    | 触发事件                              |
| 2    | `sendTextareaMessage()`                            | -                    | 处理输入                              |
| 3    | `Generate()` 构建prompt                            | -                    | 准备数据                              |
| 4    | `fetch('/api/backends/chat-completions/generate')` | -                    | 发起HTTP请求                          |
| 5    | -                                                  | Express路由接收      | `app.post('/api/...')`                |
| 6    | -                                                  | 验证请求、读取密钥   | 安全检查                              |
| 7    | -                                                  | 调用OpenAI API       | `fetch('https://api.openai.com/...')` |
| 8    | -                                                  | 接收LLM响应          | 处理流式/非流式                       |
| 9    | -                                                  | 转发给前端           | `res.json()` 或 SSE流                 |
| 10   | 接收响应数据                                       | -                    | `response.json()`                     |
| 11   | `StreamingProcessor` 处理                          | -                    | 逐token渲染                           |
| 12   | `addOneMessage()` 显示                             | -                    | 更新UI                                |
| 13   | `fetch('/api/chats/save')`                         | -                    | 保存聊天                              |
| 14   | -                                                  | `fs.writeFileSync()` | 写入文件                              |

## prompt 拼装逻辑

prompt 包含以下组成部分：

| 组成部分     | 说明                        | 可提供数据类型                                                                                                                                                    |
| ------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 用户输入     | 当前要发送的消息内容        | 单条消息                                                                                                                                                          |
| 用户角色设定 | 用户自己的人设描述          | `personaDescription`（单个字段）                                                                                                                                  |
| 角色卡 ⭐     | AI 角色的详细信息           | **多个字段**：<br>- `charDescription`（描述）<br>- `charPersonality`（性格）<br>- `scenario`（场景）                                                              |
| 世界书 ⭐     | 背景世界观和设定信息        | **多个条目**：<br>- `worldInfoBefore`（前置）<br>- `worldInfoAfter`（后置）<br>每个可包含多条信息                                                                 |
| 预设 ⭐       | 控制模型行为的系统提示      | **多个提示**：<br>- `main`（主提示）<br>- `jailbreak`（越狱提示）<br>- `nsfw`<br>- `bias`<br>- 等等                                                               |
| 正则         | 对输入/输出进行文本替换处理 | 多个正则表达式规则                                                                                                                                                |
| 插件/扩展 ⭐  | 通过插件系统注入的额外提示  | **多种提示**：<br>- `summary`（总结）<br>- `authorsNote`（作者注释）<br>- `vectorsMemory`（向量记忆）<br>- `smartContext`（智能上下文）<br>- 自定义插件<br>- 等等 |
| 对话历史 ⭐   | 之前的聊天记录              | **多条消息**：<br>- 用户和助手的历史对话                                                                                                                          |
| 对话示例 ⭐   | 演示期望对话风格的示例      | **多组对话**：<br>- 预定义的问答示例对                                                                                                                            |

> ⭐ 标记表示该组成部分可以提供多种/多条数据
{: .prompt-info }

> 特别地，有些预设会将、世界书、角色卡、对话记录、用户输入等信息嵌入其中，以做到完美控制 prompt。
{: .prompt-tip }

聚焦到 openai api 调用的场景，prompt 拼装的流程如下：

```
用户点击发送消息
    ↓
Generate() 函数 (public/script.js:3459)
    ↓
    ├─ 收集所有数据：
    │  • 角色卡信息 (description, personality, scenario)
    │  • 世界信息 (worldInfoBefore, worldInfoAfter)
    │  • 聊天记录 (oaiMessages)
    │  • 对话示例 (oaiMessageExamples)
    │  • 扩展prompts (extension_prompts)
    │  • 系统提示词 (system, jailbreak)
    ↓
prepareOpenAIMessages() (public/scripts/openai.js:1456)
    ↓
    ├─ 1. 创建 ChatCompletion 对象
    ├─ 2. 设置 token 预算
    ↓
    ├─ 3. 调用 preparePromptsForChatCompletion()
    │      (public/scripts/openai.js:1281)
    │      ↓
    │      • 将实际数据与预设标记(identifier)关联
    │      • 创建 systemPrompts 数组
    │      • 从 PromptManager 获取预设配置
    │      • 合并用户自定义的 prompt 顺序
    │      • 返回 PromptCollection 对象
    ↓
    └─ 4. 调用 populateChatCompletion()
           (public/scripts/openai.js:1087)
           ↓
           • 按预设定义的顺序添加各个组件
           • 管理 token 预算
           • 添加聊天历史
           • 添加对话示例
           • 应用深度注入
           • 最终生成完整的消息数组
    ↓
返回最终的 prompt (消息数组)
    ↓
sendOpenAIRequest() (public/scripts/openai.js:2272)
    ↓
发送到 AI API
```

### preparePromptsForChatCompletion

这个函数是 prompt 拼装的核心，负责 **将实际数据与预设标记关联，并合并用户自定义的 prompt 顺序**。

#### 功能概述

`preparePromptsForChatCompletion` 的主要作用是：
1. **收集所有提示信息**：角色信息、世界信息、扩展插件提示等
2. **创建 systemPrompts 数组**：将这些信息包装成标准的消息格式
3. **合并预设配置**：从 PromptManager 获取用户自定义的顺序和配置
4. **应用覆盖规则**：处理角色卡特定的系统提示和越狱提示

#### 关键代码解析

**1. 格式化基础提示信息**

```js
const scenarioText = scenario && oai_settings.scenario_format ? 
    substituteParams(oai_settings.scenario_format) : (scenario || '');
const charPersonalityText = charPersonality && oai_settings.personality_format ? 
    substituteParams(oai_settings.personality_format) : (charPersonality || '');
```

这段代码处理场景和角色性格的格式化。如果在设置中定义了格式化模板（`scenario_format` / `personality_format`），就使用 `substituteParams` 函数替换模板中的变量；否则直接使用原始文本。

**2. 创建核心 systemPrompts 数组**

```js
const systemPrompts = [
    // 有序提示（需要标记）
    { role: 'system', content: formatWorldInfo(worldInfoBefore), identifier: 'worldInfoBefore' },
    { role: 'system', content: formatWorldInfo(worldInfoAfter), identifier: 'worldInfoAfter' },
    { role: 'system', content: charDescription, identifier: 'charDescription' },
    { role: 'system', content: charPersonalityText, identifier: 'charPersonality' },
    { role: 'system', content: scenarioText, identifier: 'scenario' },
    // 无序提示（无标记）
    { role: 'system', content: impersonationPrompt, identifier: 'impersonate' },
    { role: 'system', content: quietPrompt, identifier: 'quietPrompt' },
    { role: 'system', content: groupNudge, identifier: 'groupNudge' },
    { role: 'assistant', content: bias, identifier: 'bias' },
];
```

这是函数的核心数据结构。每个提示都包含：
- `role`: 消息角色（system/user/assistant）
- `content`: 实际的提示内容
- `identifier`: 唯一标识符，用于与 PromptManager 中的配置关联

**3. 处理扩展提示（插件系统）**

```js
// 处理已知扩展
const summary = extensionPrompts['1_memory'];
if (summary && summary.value) systemPrompts.push({
    role: getPromptRole(summary.role),
    content: summary.value,
    identifier: 'summary',
    position: getPromptPosition(summary.position),
});

// 处理未知扩展（动态插件）
for (const key in extensionPrompts) {
    if (knownExtensionPrompts.includes(key)) continue;
    if (!extensionPrompts[key].value) continue;
    
    const hasFilter = typeof prompt.filter === 'function';
    if (hasFilter && !await prompt.filter()) continue;
    
    systemPrompts.push({
        identifier: key.replace(/\W/g, '_'),
        position: getPromptPosition(prompt.position),
        role: getPromptRole(prompt.role),
        content: prompt.value,
        extension: true,
    });
}
```

这部分代码处理两类扩展提示：
- **已知扩展**：如内存摘要（`1_memory`）、作者注释（`2_floating_prompt`）、向量记忆（`3_vectors`）等
- **未知扩展**：任何第三方插件添加的提示，支持异步过滤器函数来决定是否启用

**4. 从 PromptManager 获取用户配置**

```js
const prompts = promptManager.getPromptCollection(type);
```

`promptManager` 是 SillyTavern 的预设管理器，它存储了用户在界面中定义的 prompt 顺序和配置。`type` 参数表示生成类型（如正常对话、续写等）。

**5. 合并系统提示与用户配置**

```js
systemPrompts.forEach(prompt => {
    const collectionPrompt = prompts.get(prompt.identifier);
    
    // 应用用户在预设管理器中的配置
    if (collectionPrompt) {
        prompt.injection_position = collectionPrompt.injection_position ?? prompt.injection_position;
        prompt.injection_depth = collectionPrompt.injection_depth ?? prompt.injection_depth;
        prompt.injection_order = collectionPrompt.injection_order ?? prompt.injection_order;
        prompt.role = collectionPrompt.role ?? prompt.role;
    }
    
    const newPrompt = promptManager.preparePrompt(prompt);
    const markerIndex = prompts.index(prompt.identifier);
    
    if (-1 !== markerIndex) prompts.collection[markerIndex] = newPrompt;
    else prompts.add(newPrompt);
});
```

这是函数的关键逻辑：
- 遍历所有系统提示
- 查找用户是否在预设管理器中配置了该提示
- 如果有配置，应用用户的覆盖设置：
  - `injection_position`: 注入位置（相对/绝对）
  - `injection_depth`: 注入深度（在对话历史中的位置）
  - `injection_order`: 优先级
  - `role`: 消息角色
- 使用 `promptManager.preparePrompt` 进行最终处理
- 如果预设中已存在该标识符，则替换；否则添加

**6. 应用角色卡覆盖**

```js
// 覆盖主提示
const systemPrompt = prompts.get('main') ?? null;
const isSystemPromptDisabled = promptManager.isPromptDisabledForActiveCharacter('main');
if (systemPromptOverride && systemPrompt && systemPrompt.forbid_overrides !== true && !isSystemPromptDisabled) {
    const mainOriginalContent = systemPrompt.content;
    systemPrompt.content = systemPromptOverride;
    const mainReplacement = promptManager.preparePrompt(systemPrompt, mainOriginalContent);
    prompts.override(mainReplacement, prompts.index('main'));
}

// 覆盖越狱提示
const jailbreakPrompt = prompts.get('jailbreak') ?? null;
const isJailbreakPromptDisabled = promptManager.isPromptDisabledForActiveCharacter('jailbreak');
if (jailbreakPromptOverride && jailbreakPrompt && jailbreakPrompt.forbid_overrides !== true && !isJailbreakPromptDisabled) {
    const jbOriginalContent = jailbreakPrompt.content;
    jailbreakPrompt.content = jailbreakPromptOverride;
    const jbReplacement = promptManager.preparePrompt(jailbreakPrompt, jbOriginalContent);
    prompts.override(jbReplacement, prompts.index('jailbreak'));
}
```

这部分允许角色卡自定义系统提示和越狱提示，但需要满足条件：
- 传入了覆盖内容（`systemPromptOverride` / `jailbreakPromptOverride`）
- 提示存在且未禁止覆盖（`forbid_overrides !== true`）
- 该提示没有被用户手动禁用

#### 数据变化示例

为了更好地理解这个函数的运作过程，我们用一个具体的场景来展示数据在各个步骤中的变化。

**假设场景：**
- 角色：艾莉亚（Aria），一位友善的 AI 助手
- 用户启用了内存摘要插件和作者注释
- 用户在预设管理器中配置了自定义的提示顺序

**步骤 1：格式化基础提示信息**

输入数据：
```js
// 原始输入
scenario = "在一个现代科技公司的办公室里";
charPersonality = "友善、专业、乐于助人";

// 用户配置的格式化模板
oai_settings.scenario_format = "场景设定：{{scenario}}";
oai_settings.personality_format = "性格特征：{{char}}的性格是{{personality}}";
```

输出数据：
```js
scenarioText = "场景设定：在一个现代科技公司的办公室里";
charPersonalityText = "性格特征：艾莉亚的性格是友善、专业、乐于助人";
```

**步骤 2：创建核心 systemPrompts 数组**

输入数据：
```js
// 角色卡 ⭐ - 包含多个字段
charDescription = "艾莉亚是一位 AI 助手，擅长回答技术问题";
charPersonality = "友善、专业、乐于助人";
scenario = "在一个现代科技公司的办公室里";

// 世界书 ⭐ - 包含多个条目
worldInfoBefore = "当前时间：2025年\n地点：硅谷科技园";
worldInfoAfter = "公司规定：保持专业且友好的交流方式";
```

输出数据：
```js
systemPrompts = [
    // 世界书 ⭐ - 前置条目
    {
        role: 'system',
        content: '当前时间：2025年\n地点：硅谷科技园',
        identifier: 'worldInfoBefore'
    },
    // 角色卡 ⭐ - scenario 字段
    {
        role: 'system',
        content: '场景设定：在一个现代科技公司的办公室里',
        identifier: 'scenario'
    },
    // 角色卡 ⭐ - description 字段
    {
        role: 'system',
        content: '艾莉亚是一位 AI 助手，擅长回答技术问题',
        identifier: 'charDescription'
    },
    // 角色卡 ⭐ - personality 字段
    {
        role: 'system',
        content: '性格特征：艾莉亚的性格是友善、专业、乐于助人',
        identifier: 'charPersonality'
    },
    // 世界书 ⭐ - 后置条目
    {
        role: 'system',
        content: '公司规定：保持专业且友好的交流方式',
        identifier: 'worldInfoAfter'
    },
    // ... 其他提示
];
```

**步骤 3：处理扩展提示（插件/扩展 ⭐）**

输入数据：
```js
// 插件/扩展 ⭐ - 可以提供多种不同的提示
extensionPrompts = {
    // 内存摘要插件
    '1_memory': {
        value: '对话摘要：用户上次询问了关于 Python 编程的问题',
        role: 'system',
        position: 2  // 相对于 main 的位置
    },
    // 作者注释插件
    '2_floating_prompt': {
        value: '[作者注：保持回答简洁明了]',
        role: 'system',
        position: 1
    },
    // 自定义天气插件
    'custom_weather_plugin': {
        value: '天气信息：今日晴天，温度 22°C',
        role: 'system',
        position: 0,
        extension: true
    }
    // 可以继续添加更多插件：vectorsMemory, smartContext, 等等
};
```

处理后 systemPrompts 数组增加：
```js
systemPrompts = [
    // ... 之前的提示（角色卡、世界书）
    
    // 插件/扩展 ⭐ - 提示 1: 内存摘要
    {
        role: 'system',
        content: '对话摘要：用户上次询问了关于 Python 编程的问题',
        identifier: 'summary',
        position: 2
    },
    // 插件/扩展 ⭐ - 提示 2: 作者注释
    {
        role: 'system',
        content: '[作者注：保持回答简洁明了]',
        identifier: 'authorsNote',
        position: 1
    },
    // 插件/扩展 ⭐ - 提示 3: 自定义天气插件
    {
        role: 'system',
        content: '天气信息：今日晴天，温度 22°C',
        identifier: 'custom_weather_plugin',
        position: 0,
        extension: true
    }
    // ... 可以有更多插件提示
];
```

**步骤 4：从 PromptManager 获取用户配置**

```js
// PromptManager 中存储的用户配置
const prompts = promptManager.getPromptCollection('main');
// prompts.collection 包含用户在界面中配置的顺序和设置
```

假设用户在界面中配置了以下顺序：
```js
// 预设 ⭐ - 包含多个提示配置
prompts.collection = [
    { identifier: 'main', order: 0, enabled: true },              // 预设提示 1
    { identifier: 'worldInfoBefore', order: 1, enabled: true },
    { identifier: 'charDescription', order: 2, enabled: true },
    { identifier: 'scenario', order: 3, enabled: true, injection_depth: 4 },
    { identifier: 'charPersonality', order: 4, enabled: false },  // 用户禁用了
    { identifier: 'jailbreak', order: 5, enabled: true },         // 预设提示 2
    { identifier: 'nsfw', order: 6, enabled: false },             // 预设提示 3（未启用）
    { identifier: 'bias', order: 7, enabled: true },              // 预设提示 4
    // ... 更多预设提示
];
```

**步骤 5：合并系统提示与用户配置**

输入：systemPrompts（来自步骤 3）+ prompts（来自步骤 4）

处理过程示例：
```js
// 遍历 systemPrompts[2]（charPersonality）
const prompt = systemPrompts[2];  // charPersonality
const collectionPrompt = prompts.get('charPersonality');

// 应用用户配置
if (collectionPrompt) {
    prompt.injection_depth = collectionPrompt.injection_depth ?? prompt.injection_depth;
    prompt.enabled = collectionPrompt.enabled;  // false
}
```

输出的 prompts.collection：
```js
prompts.collection = [
    {
        identifier: 'main',
        role: 'system',
        content: 'You are a helpful AI assistant...',
        order: 0,
        enabled: true,
        injection_position: 'relative'
    },
    {
        identifier: 'worldInfoBefore',
        role: 'system',
        content: '当前时间：2025年\n地点：硅谷科技园',
        order: 1,
        enabled: true,
        injection_position: 'relative'
    },
    {
        identifier: 'charDescription',
        role: 'system',
        content: '艾莉亚是一位 AI 助手，擅长回答技术问题',
        order: 2,
        enabled: true,
        injection_position: 'relative'
    },
    {
        identifier: 'scenario',
        role: 'system',
        content: '场景设定：在一个现代科技公司的办公室里',
        order: 3,
        enabled: true,
        injection_position: 'relative',
        injection_depth: 4  // 用户自定义：注入到历史消息倒数第4条
    },
    {
        identifier: 'charPersonality',
        role: 'system',
        content: '性格特征：艾莉亚的性格是友善、专业、乐于助人',
        order: 4,
        enabled: false,  // 已被用户禁用
        injection_position: 'relative'
    },
    {
        identifier: 'summary',
        role: 'system',
        content: '对话摘要：用户上次询问了关于 Python 编程的问题',
        position: 2,
        enabled: true
    },
    {
        identifier: 'authorsNote',
        role: 'system',
        content: '[作者注：保持回答简洁明了]',
        position: 1,
        enabled: true
    },
    // ...
];
```

**步骤 6：应用角色卡覆盖**

输入数据：
```js
// 角色卡中定义了自定义的系统提示
systemPromptOverride = "艾莉亚是一个专注于技术支持的 AI，始终提供详细的代码示例";

// 当前 main 提示
prompts.get('main') = {
    identifier: 'main',
    content: 'You are a helpful AI assistant...',
    forbid_overrides: false  // 允许覆盖
};
```

处理后：
```js
prompts.collection[0] = {
    identifier: 'main',
    content: '艾莉亚是一个专注于技术支持的 AI，始终提供详细的代码示例',  // 已被覆盖
    order: 0,
    enabled: true,
    injection_position: 'relative',
    overridden: true  // 标记为已覆盖
};
```

**最终返回值**

函数返回完整的 `PromptCollection` 对象：
```js
return {
    collection: [
        {
            identifier: 'main',
            role: 'system',
            content: '艾莉亚是一个专注于技术支持的 AI，始终提供详细的代码示例',
            order: 0,
            enabled: true
        },
        {
            identifier: 'worldInfoBefore',
            role: 'system',
            content: '当前时间：2025年\n地点：硅谷科技园',
            order: 1,
            enabled: true
        },
        {
            identifier: 'charDescription',
            role: 'system',
            content: '艾莉亚是一位 AI 助手，擅长回答技术问题',
            order: 2,
            enabled: true
        },
        {
            identifier: 'scenario',
            role: 'system',
            content: '场景设定：在一个现代科技公司的办公室里',
            order: 3,
            enabled: true,
            injection_depth: 4
        },
        // charPersonality 被跳过（enabled: false）
        {
            identifier: 'summary',
            role: 'system',
            content: '对话摘要：用户上次询问了关于 Python 编程的问题',
            position: 2
        },
        {
            identifier: 'authorsNote',
            role: 'system',
            content: '[作者注：保持回答简洁明了]',
            position: 1
        },
        // ... 其他启用的提示
    ],
    overriddenPrompts: ['main']  // 记录被覆盖的提示
};
```

这个 `PromptCollection` 对象将被传递给 `populateChatCompletion()`，用于构建最终发送给 LLM 的消息数组。

#### 返回值

函数返回一个 `PromptCollection` 对象，包含：
- 所有已排序的提示信息
- 每个提示的注入位置、深度、优先级配置
- 应用了所有覆盖规则后的最终结果

这个对象会被传递给下一个函数 `populateChatCompletion()`，用于实际构建发送给 LLM 的消息数组。

### populateChatCompletion

这个函数负责 **将 `PromptCollection` 中的所有提示按正确顺序填充到 `ChatCompletion` 对象中**，最终生成发送给 LLM 的完整消息数组。

#### 功能概述

`populateChatCompletion` 的主要作用是：
1. **管理 token 预算**：为各种特殊消息（如 tool 调用、控制提示）预留 token 空间
2. **按顺序添加提示**：基础提示、系统提示、扩展提示按优先级和注入位置添加
3. **处理特殊场景**：支持续写模式（continue）、模仿模式（impersonate）等
4. **插入深度注入**：将特定提示注入到历史消息的指定位置
5. **填充对话历史**：根据 token 预算智能截断历史消息

#### 关键代码解析

**1. 辅助函数：`addToChatCompletion`**

```js
const addToChatCompletion = async (source, target = null) => {
    // 检查提示是否存在
    if (false === prompts.has(source)) return;
    
    // 检查是否被禁用（main 除外）
    if (promptManager.isPromptDisabledForActiveCharacter(source) && source !== 'main') {
        promptManager.log(`Skipping prompt ${source} because it is disabled`);
        return;
    }
    
    const prompt = prompts.get(source);
    
    // 跳过绝对位置注入的提示（稍后单独处理）
    if (prompt.injection_position === INJECTION_POSITION.ABSOLUTE) {
        promptManager.log(`Skipping prompt ${source} because it is an absolute prompt`);
        return;
    }
    
    // 确定插入位置
    const index = target ? prompts.index(target) : prompts.index(source);
    const collection = new MessageCollection(source);
    const message = await Message.fromPromptAsync(prompt);
    collection.add(message);
    chatCompletion.add(collection, index);
};
```

这是核心辅助函数，负责将单个提示添加到 `chatCompletion` 中：
- 检查提示是否存在和启用
- 过滤掉绝对位置注入的提示（它们有专门的处理逻辑）
- 将提示转换为 `Message` 对象并添加到正确位置

**2. 预留 Token 预算**

```js
chatCompletion.reserveBudget(3); // every reply is primed with <|start|>assistant<|message|>
```

为模型的回复预留 3 个 token（模型响应的起始标记）。

**3. 按顺序添加基础提示**

```js
// Character and world information
await addToChatCompletion('worldInfoBefore');
await addToChatCompletion('main');
await addToChatCompletion('worldInfoAfter');
await addToChatCompletion('charDescription');
await addToChatCompletion('charPersonality');
await addToChatCompletion('scenario');
await addToChatCompletion('personaDescription');
```

这些是最基础的提示，按照预设的顺序添加：
- `worldInfoBefore`: 世界信息前置部分
- `main`: 主系统提示
- `worldInfoAfter`: 世界信息后置部分
- `charDescription`: 角色描述
- `charPersonality`: 角色性格
- `scenario`: 场景设定
- `personaDescription`: 用户角色描述

**4. 创建控制提示集合**

```js
chatCompletion.setOverriddenPrompts(prompts.overriddenPrompts);
const controlPrompts = new MessageCollection('controlPrompts');

const impersonateMessage = await Message.fromPromptAsync(prompts.get('impersonate')) ?? null;
if (type === 'impersonate') controlPrompts.add(impersonateMessage);

// 静默提示（总是在最后）
const quietPromptMessage = await Message.fromPromptAsync(prompts.get('quietPrompt')) ?? null;
if (quietPromptMessage && quietPromptMessage.content) {
    if (isImageInliningSupported() && quietImage) {
        await quietPromptMessage.addImage(quietImage);
    }
    controlPrompts.add(quietPromptMessage);
}

chatCompletion.reserveBudget(controlPrompts);
```

控制提示是一组特殊的提示，总是位于消息数组的末尾：
- `impersonate`: 模仿模式提示（当 `type === 'impersonate'` 时）
- `quietPrompt`: 静默提示（用于 Tavern Extras，可以包含图像）

**5. 添加系统和用户相对提示**

```js
const systemPrompts = ['nsfw', 'jailbreak'];
const userRelativePrompts = prompts.collection
    .filter((prompt) => false === prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE)
    .reduce((acc, prompt) => {
        acc.push(prompt.identifier);
        return acc;
    }, []);

for (const identifier of [...systemPrompts, ...userRelativePrompts]) {
    await addToChatCompletion(identifier);
}
```

这部分处理：
- 固定的系统提示：`nsfw`、`jailbreak`
- 动态的用户相对提示：所有非系统提示且非绝对位置的提示

**6. 处理特殊扩展提示（深度注入）**

```js
// Summary (总结)
if (prompts.has('summary')) {
    const summary = prompts.get('summary');
    if (summary.position) {
        const message = await Message.fromPromptAsync(summary);
        chatCompletion.insert(message, 'main', summary.position);
    }
}

// Authors Note (作者注释)
if (prompts.has('authorsNote')) {
    const authorsNote = prompts.get('authorsNote');
    if (authorsNote.position) {
        const message = await Message.fromPromptAsync(authorsNote);
        chatCompletion.insert(message, 'main', authorsNote.position);
    }
}

// Vectors Memory (向量记忆)
if (prompts.has('vectorsMemory')) {
    const vectorsMemory = prompts.get('vectorsMemory');
    if (vectorsMemory.position) {
        const message = await Message.fromPromptAsync(vectorsMemory);
        chatCompletion.insert(message, 'main', vectorsMemory.position);
    }
}

// Other relative extension prompts (其他扩展提示)
for (const prompt of prompts.collection.filter(p => p.extension && p.position)) {
    const message = await Message.fromPromptAsync(prompt);
    chatCompletion.insert(message, 'main', prompt.position);
}
```

这些扩展提示使用 `insert` 方法而不是 `add`，因为它们需要插入到特定位置（深度注入）：
- `summary`: Tavern Extras 的对话总结
- `authorsNote`: 作者注释（用户自定义的指导性文本）
- `vectorsMemory`: 向量数据库检索的记忆
- `vectorsDataBank`: 向量数据库检索的知识库
- `smartContext`: ChromaDB 智能上下文
- 其他插件提供的扩展提示

**7. Tool 调用支持**

```js
if (ToolManager.canPerformToolCalls(type)) {
    const toolData = {};
    await ToolManager.registerFunctionToolsOpenAI(toolData);
    const toolMessage = [{ role: 'user', content: JSON.stringify(toolData) }];
    const toolTokens = await tokenHandler.countAsync(toolMessage);
    chatCompletion.reserveBudget(toolTokens);
}
```

如果启用了 Function Calling（工具调用），预先计算工具定义所需的 token 并预留预算。

**8. 续写模式的 Assistant Prefill**

```js
if (type === 'continue' && oai_settings.continue_prefill && messages.length) {
    const chatMessage = messages.shift();
    const isAssistantRole = chatMessage.role === 'assistant';
    const supportsAssistantPrefill = oai_settings.chat_completion_source === chat_completion_sources.CLAUDE;
    const namesInCompletion = oai_settings.names_behavior === character_names_behavior.COMPLETION;
    const assistantPrefill = isAssistantRole && supportsAssistantPrefill ? 
        substituteParams(oai_settings.assistant_prefill) : '';
    const messageContent = [assistantPrefill, chatMessage.content].filter(x => x).join('\n\n');
    const continueMessage = await Message.createAsync(chatMessage.role, messageContent, 'continuePrefill');
    chatMessage.name && namesInCompletion && 
        await continueMessage.setName(promptManager.sanitizeName(chatMessage.name));
    controlPrompts.add(continueMessage);
    chatCompletion.reserveBudget(continueMessage);
}
```

在续写模式下，特殊处理最后一条消息：
- 从消息列表中取出最后一条消息
- 如果是 assistant 消息且模型支持（如 Claude），添加 assistant prefill
- 将处理后的消息添加到控制提示集合中

**9. 绝对位置注入（In-chat Injections）**

```js
messages = await populationInjectionPrompts(absolutePrompts, messages);
```

将 `injection_position === ABSOLUTE` 的提示注入到历史消息的绝对位置（如从底部数第 3 条消息之前）。

**10. 填充对话历史和示例**

```js
if (power_user.pin_examples) {
    await populateDialogueExamples(prompts, chatCompletion, messageExamples);
    await populateChatHistory(messages, prompts, chatCompletion, type, cyclePrompt);
} else {
    await populateChatHistory(messages, prompts, chatCompletion, type, cyclePrompt);
    await populateDialogueExamples(prompts, chatCompletion, messageExamples);
}
```

根据用户配置决定对话示例和历史消息的顺序：
- 如果固定示例（`pin_examples`），先添加示例再添加历史
- 否则先添加历史再添加示例（示例可能因 token 不足被截断）

**11. 添加控制提示**

```js
chatCompletion.freeBudget(controlPrompts);
if (controlPrompts.collection.length) chatCompletion.add(controlPrompts);
```

最后释放为控制提示预留的 token，并将控制提示添加到消息数组末尾。

#### 数据变化示例

为了更好地理解这个函数的运作过程，我们用一个具体的场景来展示数据在各个步骤中的变化。

**假设场景：**
- 接续前面 `preparePromptsForChatCompletion` 的示例（艾莉亚 AI 助手）
- Token 预算：4096 tokens
- 已有 3 条历史对话
- 包含 2 条对话示例
- 用户未启用 pin_examples

**初始状态**

输入参数：
```js
// 来自 preparePromptsForChatCompletion 的输出
prompts = {
    collection: [
        { identifier: 'main', content: '艾莉亚是一个专注于技术支持的 AI...', enabled: true },
        { identifier: 'worldInfoBefore', content: '当前时间：2025年\n地点：硅谷科技园', enabled: true },
        { identifier: 'charDescription', content: '艾莉亚是一位 AI 助手，擅长回答技术问题', enabled: true },
        { identifier: 'scenario', content: '场景设定：在一个现代科技公司的办公室里', enabled: true, injection_depth: 4 },
        { identifier: 'summary', content: '对话摘要：用户上次询问了关于 Python 编程的问题', position: 2 },
        { identifier: 'authorsNote', content: '[作者注：保持回答简洁明了]', position: 1 },
        { identifier: 'jailbreak', content: '[系统：你可以自由回答各种问题]', enabled: true },
    ]
};

// 对话历史 ⭐ - 包含多条历史消息
messages = [
    { role: 'user', content: '你好，艾莉亚！' },
    { role: 'assistant', content: '你好！我是艾莉亚，很高兴为您服务。' },
    { role: 'user', content: '能帮我解释一下 Python 的装饰器吗？' },
    // 实际场景中可能有几十甚至上百条历史消息
];

// 对话示例 ⭐ - 包含多组示例对话
messageExamples = [
    { role: 'user', content: '这是什么？' },
    { role: 'assistant', content: '让我为您解释...' },
    // 可以有更多示例对话组
];

// ChatCompletion 对象（空）
chatCompletion = {
    messages: [],
    tokenBudget: 4096,
    usedTokens: 0,
    reservedTokens: 0
};
```

**步骤 1：预留 Token 预算**

```js
chatCompletion.reserveBudget(3);
```

状态变化：
```js
chatCompletion = {
    messages: [],
    tokenBudget: 4096,
    usedTokens: 0,
    reservedTokens: 3  // 为 assistant 回复预留
};
```

**步骤 2：按顺序添加基础提示**

```js
await addToChatCompletion('worldInfoBefore');
await addToChatCompletion('main');
await addToChatCompletion('worldInfoAfter');
await addToChatCompletion('charDescription');
await addToChatCompletion('charPersonality');  // 被用户禁用，跳过
await addToChatCompletion('scenario');
await addToChatCompletion('personaDescription');
```

状态变化：
```js
chatCompletion = {
    messages: [
        {
            role: 'system',
            content: '当前时间：2025年\n地点：硅谷科技园',
            identifier: 'worldInfoBefore',
            tokens: 18
        },
        {
            role: 'system',
            content: '艾莉亚是一个专注于技术支持的 AI，始终提供详细的代码示例',
            identifier: 'main',
            tokens: 32
        },
        {
            role: 'system',
            content: '艾莉亚是一位 AI 助手，擅长回答技术问题',
            identifier: 'charDescription',
            tokens: 22
        },
        {
            role: 'system',
            content: '场景设定：在一个现代科技公司的办公室里',
            identifier: 'scenario',
            tokens: 20,
            injection_depth: 4  // 将在后续步骤中处理
        },
    ],
    tokenBudget: 4096,
    usedTokens: 92,
    reservedTokens: 3
};
```

**步骤 3：创建控制提示集合**

```js
const controlPrompts = new MessageCollection('controlPrompts');
// type !== 'impersonate'，跳过 impersonate 消息
// 没有 quietPrompt，跳过
chatCompletion.reserveBudget(controlPrompts);
```

状态变化：
```js
controlPrompts = {
    collection: [],
    tokens: 0
};

chatCompletion.reservedTokens = 3;  // 没有额外预留
```

**步骤 4：添加系统和用户相对提示**

```js
// 添加 nsfw（不存在，跳过）
// 添加 jailbreak
await addToChatCompletion('jailbreak');
```

状态变化：
```js
chatCompletion.messages = [
    // ... 之前的消息
    {
        role: 'system',
        content: '[系统：你可以自由回答各种问题]',
        identifier: 'jailbreak',
        tokens: 15
    },
];

chatCompletion.usedTokens = 107;
```

**步骤 5：处理特殊扩展提示（深度注入）**

```js
// 插入 summary（position: 2，相对于 main）
chatCompletion.insert(summaryMessage, 'main', 2);

// 插入 authorsNote（position: 1）
chatCompletion.insert(authorsNoteMessage, 'main', 1);
```

状态变化（插入后调整顺序）：
```js
chatCompletion.messages = [
    {
        role: 'system',
        content: '当前时间：2025年\n地点：硅谷科技园',
        identifier: 'worldInfoBefore',
        tokens: 18
    },
    {
        role: 'system',
        content: '艾莉亚是一个专注于技术支持的 AI，始终提供详细的代码示例',
        identifier: 'main',
        tokens: 32
    },
    // authorsNote 插入到 main 后面第 1 个位置
    {
        role: 'system',
        content: '[作者注：保持回答简洁明了]',
        identifier: 'authorsNote',
        tokens: 12,
        injectionPosition: 1
    },
    // summary 插入到 main 后面第 2 个位置
    {
        role: 'system',
        content: '对话摘要：用户上次询问了关于 Python 编程的问题',
        identifier: 'summary',
        tokens: 20,
        injectionPosition: 2
    },
    {
        role: 'system',
        content: '艾莉亚是一位 AI 助手，擅长回答技术问题',
        identifier: 'charDescription',
        tokens: 22
    },
    {
        role: 'system',
        content: '场景设定：在一个现代科技公司的办公室里',
        identifier: 'scenario',
        tokens: 20,
        injection_depth: 4
    },
    {
        role: 'system',
        content: '[系统：你可以自由回答各种问题]',
        identifier: 'jailbreak',
        tokens: 15
    },
];

chatCompletion.usedTokens = 139;
```

**步骤 6：Tool 调用支持（未启用，跳过）**

```js
// ToolManager.canPerformToolCalls(type) 返回 false
// 跳过此步骤
```

**步骤 7：续写模式（不是续写，跳过）**

```js
// type !== 'continue'
// 跳过此步骤
```

**步骤 8：绝对位置注入**

```js
// 没有 absolutePrompts（injection_position === ABSOLUTE）
messages = await populationInjectionPrompts([], messages);
// messages 保持不变
```

**步骤 9：填充对话历史和示例**

由于 `pin_examples = false`，先添加历史再添加示例：

```js
// 先添加对话历史
await populateChatHistory(messages, prompts, chatCompletion, type, cyclePrompt);

// 再添加对话示例
await populateDialogueExamples(prompts, chatCompletion, messageExamples);
```

9.1 添加对话历史（对话历史 ⭐）：
```js
chatCompletion.messages = [
    // ... 之前的系统提示
    
    // 对话历史 ⭐ - 消息 1
    {
        role: 'user',
        content: '你好，艾莉亚！',
        tokens: 8
    },
    // 对话历史 ⭐ - 消息 2
    {
        role: 'assistant',
        content: '你好！我是艾莉亚，很高兴为您服务。',
        tokens: 15
    },
    // 对话历史 ⭐ - 消息 3
    {
        role: 'user',
        content: '能帮我解释一下 Python 的装饰器吗？',
        tokens: 12
    },
    // 实际场景中可能有更多历史消息，会根据 token 预算智能截断
];

chatCompletion.usedTokens = 174;
```

9.2 处理 `scenario` 的 `injection_depth: 4`：

scenario 需要注入到历史消息倒数第 4 条之前：
```js
// 倒数第 4 条是 "你好，艾莉亚！"
// scenario 将被插入到这条消息之前
```

调整后：
```js
chatCompletion.messages = [
    {
        role: 'system',
        content: '当前时间：2025年\n地点：硅谷科技园',
        identifier: 'worldInfoBefore',
        tokens: 18
    },
    {
        role: 'system',
        content: '艾莉亚是一个专注于技术支持的 AI，始终提供详细的代码示例',
        identifier: 'main',
        tokens: 32
    },
    {
        role: 'system',
        content: '[作者注：保持回答简洁明了]',
        identifier: 'authorsNote',
        tokens: 12
    },
    {
        role: 'system',
        content: '对话摘要：用户上次询问了关于 Python 编程的问题',
        identifier: 'summary',
        tokens: 20
    },
    {
        role: 'system',
        content: '艾莉亚是一位 AI 助手，擅长回答技术问题',
        identifier: 'charDescription',
        tokens: 22
    },
    // scenario 被注入到这里（历史消息之前）
    {
        role: 'system',
        content: '场景设定：在一个现代科技公司的办公室里',
        identifier: 'scenario',
        tokens: 20,
        injectedAtDepth: 4
    },
    {
        role: 'system',
        content: '[系统：你可以自由回答各种问题]',
        identifier: 'jailbreak',
        tokens: 15
    },
    {
        role: 'user',
        content: '你好，艾莉亚！',
        tokens: 8
    },
    {
        role: 'assistant',
        content: '你好！我是艾莉亚，很高兴为您服务。',
        tokens: 15
    },
    {
        role: 'user',
        content: '能帮我解释一下 Python 的装饰器吗？',
        tokens: 12
    },
];
```

9.3 添加对话示例（检查 token 预算）：
```js
// 当前已用：174 tokens
// 预留：3 tokens
// 剩余预算：4096 - 174 - 3 = 3919 tokens
// 示例所需：约 20 tokens
// 预算充足，添加示例

chatCompletion.messages.splice(7, 0, ...exampleMessages);  // 插入到历史消息之前
```

最终添加示例后：
```js
chatCompletion.messages = [
    // ... 之前的系统提示（0-6）
    
    // 对话示例 ⭐ - 示例对话组 1
    {
        role: 'user',
        content: '这是什么？',
        tokens: 5,
        isExample: true
    },
    {
        role: 'assistant',
        content: '让我为您解释...',
        tokens: 8,
        isExample: true
    },
    // 可以有更多示例对话组
    
    // 对话历史 ⭐ - 历史消息（7-9 → 9-11）
    {
        role: 'user',
        content: '你好，艾莉亚！',
        tokens: 8
    },
    {
        role: 'assistant',
        content: '你好！我是艾莉亚，很高兴为您服务。',
        tokens: 15
    },
    {
        role: 'user',
        content: '能帮我解释一下 Python 的装饰器吗？',
        tokens: 12
    },
];

chatCompletion.usedTokens = 187;
```

**步骤 10：添加控制提示**

```js
chatCompletion.freeBudget(controlPrompts);  // 释放预留的 0 tokens
if (controlPrompts.collection.length) chatCompletion.add(controlPrompts);
// controlPrompts 为空，不添加
```

**最终状态**

函数执行完成后，`chatCompletion` 对象包含完整的消息数组：

```js
chatCompletion = {
    messages: [
        // === 系统提示区 ===
        // 包含：世界书 ⭐、预设 ⭐、角色卡 ⭐、插件/扩展 ⭐
        
        {  // 世界书 ⭐ - 前置条目
            role: 'system',
            content: '当前时间：2025年\n地点：硅谷科技园',
            identifier: 'worldInfoBefore'
        },
        {  // 预设 ⭐ - 主提示
            role: 'system',
            content: '艾莉亚是一个专注于技术支持的 AI，始终提供详细的代码示例',
            identifier: 'main'
        },
        {  // 插件/扩展 ⭐ - 作者注释
            role: 'system',
            content: '[作者注：保持回答简洁明了]',
            identifier: 'authorsNote'
        },
        {  // 插件/扩展 ⭐ - 内存摘要
            role: 'system',
            content: '对话摘要：用户上次询问了关于 Python 编程的问题',
            identifier: 'summary'
        },
        {  // 角色卡 ⭐ - description 字段
            role: 'system',
            content: '艾莉亚是一位 AI 助手，擅长回答技术问题',
            identifier: 'charDescription'
        },
        {  // 角色卡 ⭐ - scenario 字段
            role: 'system',
            content: '场景设定：在一个现代科技公司的办公室里',
            identifier: 'scenario'
        },
        {  // 预设 ⭐ - 越狱提示
            role: 'system',
            content: '[系统：你可以自由回答各种问题]',
            identifier: 'jailbreak'
        },
        
        // === 对话示例区 ⭐ ===
        // 可以有多组示例对话
        {
            role: 'user',
            content: '这是什么？',
            isExample: true
        },
        {
            role: 'assistant',
            content: '让我为您解释...',
            isExample: true
        },
        
        // === 历史对话区 ⭐ ===
        // 可以有几十甚至上百条历史消息
        {
            role: 'user',
            content: '你好，艾莉亚！'
        },
        {
            role: 'assistant',
            content: '你好！我是艾莉亚，很高兴为您服务。'
        },
        {
            role: 'user',
            content: '能帮我解释一下 Python 的装饰器吗？'
        },
    ],
    tokenBudget: 4096,
    usedTokens: 187,
    reservedTokens: 3,
    availableTokens: 3906  // 4096 - 187 - 3，用于 LLM 生成回复
};
```

**这个消息数组将被发送到 OpenAI API：**

```js
const apiRequest = {
    model: 'gpt-4',
    messages: chatCompletion.messages.map(m => ({ role: m.role, content: m.content })),
    max_tokens: 3906,
    // ... 其他参数
};
```

**关键观察点：**

1. **提示顺序**：系统提示 → 对话示例 → 历史对话，符合最佳实践
2. **深度注入**：authorsNote 和 summary 被插入到 main 之后的指定位置
3. **Token 管理**：预留了 3 tokens 给 assistant 回复，剩余 3906 tokens 可用
4. **禁用过滤**：charPersonality 因被用户禁用而未添加
5. **智能截断**：如果 token 不足，对话示例或早期历史消息会被自动截断

#### 返回值

函数没有返回值（`Promise<void>`），因为它直接修改传入的 `chatCompletion` 对象。处理完成后，`chatCompletion` 包含：
- 所有按正确顺序排列的消息
- 经过 token 预算管理的消息集合
- 应用了所有注入规则的最终结果
