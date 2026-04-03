// ==UserScript==
// @name         LeetCode SQL Autocomplete
// @namespace    linyisu
// @version      1.0.0
// @description  通过 Monaco CompletionItemProvider API 注册表名/列名
// @author       linyisu
// @match        https://leetcode.cn/problems/*
// @match        https://leetcode.com/problems/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

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
      try { disposable.dispose(); } catch (_) {}
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

          const schemaLabels = new Set(
            items.map(i => typeof i.label === 'string' ? i.label : i.label.label)
          );
          const docWords = new Set(
            (model.getValue().match(/\b[a-zA-Z_]\w*\b/g) || [])
              .filter(w => w.length > 1 && w !== currentWord && !schemaLabels.has(w))
          );

          return {
            suggestions: [
              ...items.map(item => ({ ...item, range })),
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
