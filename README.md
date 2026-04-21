## LeetCode SQL Autocomplete

A userscript that automatically injects table names and column names into the LeetCode SQL editor.

[中文](README.zh.md)

### Features

- Automatically extracts table and column names from the problem description and injects them into the editor's completion provider
- Inline type hints next to column names (e.g. `int`, `varchar`)
- Suggests common MySQL keywords; automatically adapts casing based on your input
- Supports both `leetcode.cn` and `leetcode.com`

### Installation

[Install from GreasyFork](https://greasyfork.org/zh-CN/scripts/574888-leetcode-sql-autocomplete)

### Usage

Open any LeetCode SQL problem. As you type in the editor, table and column names from the problem description will automatically appear in the completion list.