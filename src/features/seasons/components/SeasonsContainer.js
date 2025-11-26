/**
 * SeasonsContainer
 * Container component that provides data to SeasonsView using React Query
 */

import React from 'react';
import { useTeamSeasons } from '../../../hooks/useTeamSeasons';
import { SeasonsView } from './SeasonsView';

const SeasonsContainer = () => {
  const { teamSeasons, loading, error } = useTeamSeasons();

  return (
    <SeasonsView
      teamSeasons={teamSeasons}
      loading={loading}
      error={error}
    />
  );
};

export default SeasonsContainer;
