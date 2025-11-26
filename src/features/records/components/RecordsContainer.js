/**
 * RecordsContainer
 * Container component that fetches data and manages state for RecordsView
 */

import React, { useState } from 'react';
import { useRecords } from '../hooks/useRecords';
import RecordsView from './RecordsView';
import { LoadingSpinner, ErrorMessage } from '../../../shared/components';

const RecordsContainer = () => {
  const [selectedManager, setSelectedManager] = useState('');

  const {
    allRecords,
    mostRecentYear,
    currentChampion,
    currentChumpion,
    currentYearSeasons,
    medalRankings,
    chumpionRankings,
    winPctRankings,
    ppgRankings,
    getCurrentYearChumpionDues,
    loading,
    error
  } = useRecords();

  if (loading) {
    return <LoadingSpinner message="Loading hall of records..." />;
  }

  if (error) {
    return <ErrorMessage message={`Failed to load records: ${error}`} />;
  }

  return (
    <RecordsView
      allRecords={allRecords}
      mostRecentYear={mostRecentYear}
      currentChampion={currentChampion}
      currentChumpion={currentChumpion}
      currentYearSeasons={currentYearSeasons}
      selectedManager={selectedManager}
      onSelectManager={setSelectedManager}
      medalRankings={medalRankings}
      chumpionRankings={chumpionRankings}
      winPctRankings={winPctRankings}
      ppgRankings={ppgRankings}
      getCurrentYearChumpionDues={getCurrentYearChumpionDues}
    />
  );
};

export default RecordsContainer;
