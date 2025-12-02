/**
 * RecordsContainer
 * Container component that fetches data and manages state for RecordsView
 */

import React, { useState } from 'react';
import { useRecords } from '../hooks/useRecords';
import RecordsView from './RecordsView';
import { ErrorMessage, SkeletonCard, SkeletonRankingCard } from '../../../shared/components';
import DashboardSection from '../../../components/DashboardSection';
import { Trophy } from 'lucide-react';

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
    return (
      <DashboardSection
        title="Hall of Records"
        description="League champions, medal counts, and manager-by-manager performance snapshots."
        icon={Trophy}
        bodyClassName="space-y-2 sm:space-y-4"
      >
        {/* Champion and Chumpion Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Medal Rankings and Chumpion Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
          <div className="card-primary">
            <div className="space-y-1.5 sm:space-y-2.5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <SkeletonRankingCard key={`skeleton-medal-${idx}`} />
              ))}
            </div>
          </div>
          <div className="card-primary">
            <div className="space-y-1.5 sm:space-y-2.5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <SkeletonRankingCard key={`skeleton-chumpion-${idx}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Win % and PPG Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
          <div className="card-primary">
            <div className="space-y-0.5 sm:space-y-1.5">
              {Array.from({ length: 10 }).map((_, idx) => (
                <SkeletonRankingCard key={`skeleton-winpct-${idx}`} />
              ))}
            </div>
          </div>
          <div className="card-primary">
            <div className="space-y-0.5 sm:space-y-1.5">
              {Array.from({ length: 10 }).map((_, idx) => (
                <SkeletonRankingCard key={`skeleton-ppg-${idx}`} />
              ))}
            </div>
          </div>
        </div>
      </DashboardSection>
    );
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
