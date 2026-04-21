// ==UserScript==
// @name         LeetCode SQL Autocomplete
// @namespace    https://github.com/linyisu/leetcode-sql-autocomplete
// @version      1.1.1
// @author       linyisu
// @match        https://leetcode.cn/problems/*
// @match        https://leetcode.com/problems/*
// @license      MIT
// @description  一个为力扣 SQL 题目编辑器自动注入表名、列名的插件
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const KEYWORDS = [
    // query
    'SELECT', 'FROM', 'WHERE', 'AS', 'DISTINCT', 'LIMIT', 'OFFSET', 'ALL', 'ANY',
    // join
    'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN', 'NATURAL JOIN', 'ON', 'USING',
    // logic / comparison
    'AND', 'OR', 'NOT', 'IN', 'NOT IN', 'EXISTS', 'NOT EXISTS',
    'BETWEEN', 'LIKE', 'REGEXP', 'IS NULL', 'IS NOT NULL', 'NULL',
    // grouping / ordering
    'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC',
    // set operations
    'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
    // CTE
    'WITH', 'RECURSIVE',
    // conditional
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'IF', 'IFNULL', 'NULLIF', 'COALESCE', 'GREATEST', 'LEAST', 'ISNULL',
    // aggregate
    'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
    'GROUP_CONCAT', 'SEPARATOR',
    // math
    'ROUND', 'FLOOR', 'CEIL', 'CEILING', 'ABS', 'MOD', 'POW', 'POWER', 'SQRT', 'TRUNCATE', 'SIGN',
    // string
    'CONCAT', 'CONCAT_WS', 'LENGTH', 'CHAR_LENGTH', 'SUBSTRING', 'SUBSTR',
    'LEFT', 'RIGHT', 'TRIM', 'LTRIM', 'RTRIM', 'UPPER', 'LOWER',
    'REPLACE', 'LOCATE', 'INSTR', 'LPAD', 'RPAD', 'REPEAT', 'REVERSE', 'FORMAT',
    // type conversion
    'CAST', 'CONVERT',
    // date / time
    'NOW', 'CURDATE', 'CURTIME', 'CURRENT_DATE', 'CURRENT_TIMESTAMP',
    'DATE', 'DATE_ADD', 'DATE_SUB', 'DATEDIFF', 'DATE_FORMAT', 'STR_TO_DATE',
    'TIMESTAMPDIFF', 'EXTRACT',
    'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'WEEK', 'QUARTER', 'LAST_DAY',
    // window functions
    'RANK', 'DENSE_RANK', 'ROW_NUMBER', 'NTILE',
    'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
    'PERCENT_RANK', 'CUME_DIST',
    'OVER', 'PARTITION BY', 'ROWS BETWEEN', 'RANGE BETWEEN',
    'UNBOUNDED PRECEDING', 'CURRENT ROW', 'UNBOUNDED FOLLOWING',
  ];

  function extractSchema() {
    const tableNames = [];
    const columns = [];
    const seenTables = new Set();
    const seenCols = new Set();

    const descEl =
      document.querySelector('[data-track-load="description_content"]') ||
      document.querySelector('.question-content__JfgR') ||
      document.querySelector('.question-content') ||
      document.querySelector('[class*="description"]');

    if (!descEl) return { tableNames, columns };

    for (const pre of descEl.querySelectorAll('pre')) {
      const lines = pre.textContent.split('\n');
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/column\s+name/i.test(lines[i])) { headerIdx = i; break; }
      }
      if (headerIdx === -1) continue;

      let sibling = pre.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === 'PRE') break;
        if (/(\btable\s*|表\s*)[:：]/i.test(sibling.textContent)) {
          const codes = sibling.querySelectorAll('code');
          if (codes.length > 0) {
            for (const code of codes) {
              const name = code.textContent.trim();
              if (/^\w+$/.test(name) && name.length > 1 && !seenTables.has(name)) {
                seenTables.add(name);
                tableNames.push(name);
              }
            }
          } else {
            const m = sibling.textContent.match(/(\w+)\s*表\s*[:：]/i) ||
              sibling.textContent.match(/(?:\btable\s*)[:：]\s*(\w+)/i);
            if (m && m[1].length > 1 && !seenTables.has(m[1])) {
              seenTables.add(m[1]);
              tableNames.push(m[1]);
            }
          }
          break;
        }
        sibling = sibling.previousElementSibling;
      }

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*\+/.test(line)) continue;
        if (!/\|/.test(line)) break;
        const parts = line.split('|');
        if (parts.length >= 2) {
          const colName = parts[1].trim();
          const colType = parts.length >= 3 ? parts[2].trim() : '';
          if (colName && !seenCols.has(colName)) {
            seenCols.add(colName);
            columns.push({ name: colName, type: colType });
          }
        }
      }
    }

    for (const pre of descEl.querySelectorAll('pre')) {
      const lines = pre.textContent.split('\n');
      let inOutput = false;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (/^(?:input|inputs)\b/i.test(trimmed) || /^输入/.test(trimmed)) inOutput = false;
        if (/^(?:output|outputs)\b/i.test(trimmed) || /^输出/.test(trimmed)) inOutput = true;

        if (!inOutput) {
          const nameMatch = trimmed.match(/(\w+)\s*(?:table|表)\s*[:：]/i);
          if (nameMatch) {
            const name = nameMatch[1];
            if (name.length > 1 && !/^(input|output|inputs|outputs|example|explanation|note|follow|hint|return)$/i.test(name) && !seenTables.has(name)) {
              seenTables.add(name);
              tableNames.push(name);
            }
          }
        }

        if (/^\+[-+]+$/.test(trimmed)) {
          let j = i + 1;
          while (j < lines.length && /^\+/.test(lines[j].trim())) j++;
          if (j < lines.length && /^\|/.test(lines[j].trim()) && !/column\s+name/i.test(lines[j])) {
            for (const part of lines[j].split('|').slice(1, -1)) {
              const colName = part.trim();
              if (colName && colName.length > 1 && /^[a-zA-Z_]\w*$/.test(colName) && !seenCols.has(colName)) {
                seenCols.add(colName);
                columns.push({ name: colName, type: '' });
              }
            }
          }
          i = j;
          while (i + 1 < lines.length && /^[|+]/.test(lines[i + 1].trim())) i++;
        }
      }
    }

    return { tableNames, columns };
  }

  let disposable = null;
  let lastSchemaKey = '';

  function registerProvider(monaco, tableNames, columns) {
    if (disposable) {
      try { disposable.dispose(); } catch (_) { }
      disposable = null;
    }

    if (tableNames.length === 0 && columns.length === 0) return;

    const { CompletionItemKind } = monaco.languages;

    const items = [
      ...tableNames.map(name => ({
        label: { label: name, description: 'table' },
        kind: CompletionItemKind.Class,
        insertText: name,
        sortText: '0_' + name,
      })),
      ...columns.map(({ name, type }) => ({
        label: { label: name, description: type },
        kind: CompletionItemKind.Field,
        insertText: name,
        sortText: '1_' + name,
      })),
    ];

    const langs = ['mysql', 'sql', 'pgsql', 'plaintext'];
    const providers = langs.map(lang =>
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems(model, position) {
          const textUntilPos = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });
          const wordMatch = textUntilPos.match(/\w+$/);
          const currentWord = wordMatch ? wordMatch[0] : '';
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordMatch ? position.column - currentWord.length : position.column,
            endColumn: position.column,
          };

          const isLower = currentWord.length > 0 && /[a-z]/.test(currentWord) && currentWord === currentWord.toLowerCase();
          const kwItems = KEYWORDS.map(kw => ({
            label: isLower ? kw.toLowerCase() : kw,
            kind: CompletionItemKind.Keyword,
            insertText: isLower ? kw.toLowerCase() : kw,
            sortText: '5_' + kw,
            range,
          }));

          const schemaLabels = new Set([
            ...items.map(i => typeof i.label === 'string' ? i.label : i.label.label),
            ...KEYWORDS,
            ...KEYWORDS.map(kw => kw.toLowerCase()),
          ]);
          const docWords = new Set(
            (model.getValue().match(/\b[a-zA-Z_]\w*\b/g) || [])
              .filter(w => w.length > 1 && w !== currentWord && !schemaLabels.has(w))
          );

          return {
            suggestions: [
              ...items.map(item => ({ ...item, range })),
              ...kwItems,
              ...[...docWords].map(w => ({
                label: w,
                kind: CompletionItemKind.Text,
                insertText: w,
                sortText: '9_' + w,
                range,
              })),
            ],
          };
        },
      })
    );

    disposable = { dispose() { providers.forEach(p => p.dispose()); } };

    monaco.editor.getEditors().forEach(editor => {
      editor.updateOptions({
        quickSuggestions: { other: true, comments: false, strings: false },
      });
    });
  }

  function waitForMonaco(timeout = 30_000) {
    return new Promise((resolve, reject) => {
      if (window.monaco?.languages?.registerCompletionItemProvider) return resolve(window.monaco);
      const interval = setInterval(() => {
        if (window.monaco?.languages?.registerCompletionItemProvider) {
          clearInterval(interval);
          resolve(window.monaco);
        }
      }, 500);
      setTimeout(() => { clearInterval(interval); reject(new Error('Monaco timeout')); }, timeout);
    });
  }

  async function main() {
    let monaco;
    try {
      monaco = await waitForMonaco();
    } catch (_) {
      console.warn('[SQ] Monaco 未就绪，退出');
      return;
    }

    doInject(monaco);

    let lastUrl = location.href;
    let debounceTimer = null;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastSchemaKey = '';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => doInject(monaco), 2000);
      }
    }).observe(document.body, { childList: true, subtree: true });

    let descTimer = null;
    new MutationObserver(() => {
      clearTimeout(descTimer);
      descTimer = setTimeout(() => {
        const { tableNames, columns } = extractSchema();
        const key = tableNames.join(',') + '|' + columns.map(c => c.name).join(',');
        if ((tableNames.length > 0 || columns.length > 0) && key !== lastSchemaKey) {
          lastSchemaKey = key;
          registerProvider(monaco, tableNames, columns);
        }
      }, 800);
    }).observe(document.body, { childList: true, subtree: true });
  }

  function doInject(monaco) {
    setTimeout(() => {
      const { tableNames, columns } = extractSchema();
      const key = tableNames.join(',') + '|' + columns.map(c => c.name).join(',');
      if (key !== lastSchemaKey) {
        lastSchemaKey = key;
        registerProvider(monaco, tableNames, columns);
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => main());
  } else {
    main();
  }
})();
