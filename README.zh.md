# LeetCode SQL 自动补全

一个 Tampermonkey 油猴脚本，为力扣 SQL 题目的编辑器注入表名和列名的自动补全功能。

[English](README.md)

## 功能

- 自动从题目描述中获取表名和列名，注入编辑器提词框
- 列名旁内联显示字段类型（如 `int`、`varchar`）
- 同时支持 `leetcode.cn` 和 `leetcode.com`

## 安装

[从 GreasyFork 安装](https://greasyfork.org/zh-CN/scripts/572383-leetcode-sql-autocomplete)

## 使用方法

打开任意力扣 SQL 题目，在编辑器中输入时，题目中的表名和列名会自动出现在补全列表中。
