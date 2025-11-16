import React from 'react';

const ActiveTabSection = ({ activeTab, sections }) => {
  if (!sections || !activeTab) {
    return null;
  }

  const sectionRenderer =
    sections[activeTab] ?? sections.records ?? sections.default;

  if (!sectionRenderer) {
    return null;
  }

  if (typeof sectionRenderer === 'function') {
    return sectionRenderer();
  }

  return sectionRenderer;
};

export default ActiveTabSection;
