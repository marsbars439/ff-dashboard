import React from 'react';
import { BookOpen } from 'lucide-react';

const renderMarkdown = (text = '') => {
  const lines = text.split('\n');
  const elements = [];
  let currentList = [];
  let inList = false;

  const processInlineFormatting = (value) => {
    const parts = value.split(/(\*\*.*?\*\*)/);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const createSimpleList = (items, key) => (
    <ul key={key} className="mb-4 space-y-1">
      {items.map((item, i) => {
        const indentStyle = {
          marginLeft: `${Math.max(1, 1 + item.indent * 1.5)}rem`,
          listStyleType: 'disc',
          display: 'list-item'
        };

        return (
          <li
            key={i}
            className="text-slate-100 text-sm sm:text-base"
            style={indentStyle}
          >
            {item.content}
          </li>
        );
      })}
    </ul>
  );

  const processLine = (line, index) => {
    const listMatch = line.match(/^(\s*)- (.+)$/);
    if (listMatch) {
      const spaces = listMatch[1].length;
      const content = listMatch[2];
      const indentLevel = Math.floor(spaces / 2);

      if (!inList) {
        inList = true;
      }

      currentList.push({ content: processInlineFormatting(content), indent: indentLevel });
      return;
    }

    if (inList && currentList.length > 0) {
      elements.push(createSimpleList(currentList, `list-${elements.length}`));
      currentList = [];
      inList = false;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="text-2xl sm:text-3xl font-bold text-slate-50 mt-6 sm:mt-8 mb-3 sm:mb-4">
          {processInlineFormatting(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-xl sm:text-2xl font-bold text-slate-100 mt-4 sm:mt-6 mb-2 sm:mb-3">
          {processInlineFormatting(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-lg sm:text-xl font-bold text-slate-200 mt-3 sm:mt-4 mb-2">
          {processInlineFormatting(line.slice(4))}
        </h3>
      );
    } else if (line.trim() === '' || line.trim() === '---') {
      elements.push(<br key={index} />);
    } else if (line.trim() !== '') {
      elements.push(
        <p key={index} className="text-slate-100/90 mb-2 text-sm sm:text-base">
          {processInlineFormatting(line)}
        </p>
      );
    }
  };

  lines.forEach(processLine);

  if (inList && currentList.length > 0) {
    elements.push(createSimpleList(currentList, `list-${elements.length}`));
  }

  return elements;
};

const RulesSection = ({ rulesContent }) => (
  <div className="space-y-4 sm:space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="p-3 rounded-lg bg-indigo-50 text-indigo-700">
          <BookOpen className="w-6 h-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">League Rules</h2>
          <p className="text-gray-600 text-sm sm:text-base">
            Governance, settings, and best practices for every season.
          </p>
        </div>
      </div>
    </div>
    <div className="bg-slate-900/70 rounded-2xl shadow-xl border border-white/10 p-4 sm:p-8">
      <div className="prose prose-sm sm:prose-lg max-w-none text-slate-100">
        {renderMarkdown(rulesContent || '')}
      </div>
    </div>
  </div>
);

export default RulesSection;
